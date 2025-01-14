const assert = require('assert');
const _ = require('lodash');
const utils = require('../utils');

class WorkflowsService {

  constructor(workflowDao, versionDao, executionDao, cloudTasksService) {
    this.workflowDao = workflowDao;
    this.versionDao = versionDao;
    this.executionDao = executionDao;
    this.cloudTasksService = cloudTasksService;
  }

  createWorkflow = async (name, owner) => {

    const workflow = await this.workflowDao.getLatestByNameAndOwner(name, owner);
    if(workflow)
      return workflow.id;

    const data = { name, owner, created: new Date(), updated: new Date() };
    return await this.workflowDao.add(data);

  }

  updateWorkflow = async (workflowId, versionName, params, tasks) => {

    const checksum = utils.generateChecksum(JSON.parse(tasks));

    const version = await this.versionDao.getLatestByChecksum(workflowId, checksum);
    if(version) {
      const updates = { name:versionName, params, tasks, updated: new Date() };
      await this.versionDao.update(workflowId, version.id, updates);
      return version.id;
    }

    const data = { name:versionName, params, tasks, checksum, created: new Date(), updated: new Date() }
    return await this.versionDao.add(workflowId, data);

  }

  triggerWorkflow = async (workflowId, params, timestamp) => {

    const version = await this.versionDao.getLatest(workflowId);

    const executionData = {
      versionId: version.id,
      params: params,
      scheduled: timestamp || new Date(),
      count: 0,
      tasks: [],
      state: 'queued',
      created: new Date(),
      updated: new Date()
    }

    const executionId = await this.executionDao.create(workflowId, executionData);

    await this.cloudTasksService.createTask(workflowId, executionId, timestamp, 0);

    return executionId;

  }

  executeWorkflow = async (workflowId, executionId, runCount = 0) => {

    /*

    # Run == Google Cloud Task

    Race Conditions:
    1. Run is triggered more than once, parallely:
      - Runs will overwrite each other's data
      - Should happen rarely
    2. Run is triggered more than once, one after completion of the other:
      - Case: Execution `state` is `completed` or `failed`
        - Won't do anything
      - Case: Execution `state` is `running` or `waiting`
        - Won't do anything as `runCount` would be less than Execution `count`
      - Should happen very rarely
    3. Next Run is triggered before the current Run is completed:
      - Execution `count` is updated before the next Run is created, hence, no issues

    Error Conditions:
    1. Run crashed before updating the Execution `count`:
      - Run will be re-tried
      - Will try to pick up from where it left
    2. Run crashed after updating the Execution `count`:
      - Run will be re-tried
      - Shall create the next Run (if not already created) and return

    */

    const execution = await this.executionDao.get(workflowId, executionId);
    if(execution.state == 'completed' || execution.state == 'failed' || execution.state == 'error')
      return;

    assert.ok(execution.state === 'queued' || execution.state === 'running' || execution.state === 'waiting');

    if(runCount < execution.count) {
      this.cloudTasksService.createTask(workflowId, executionId, execution.scheduled, execution.count);
      return;
    }

    assert.strictEqual(runCount, execution.count);

    const version = await this.versionDao.get(workflowId, execution.versionId);
    version.params = JSON.parse(version.params);
    version.tasks = JSON.parse(version.tasks);

    while(true) {

      const taskRunInfoMap = {};

      for(const task of version.tasks)
        taskRunInfoMap[task.name] = { errorCount: 0, deferCount: 0, nextRun: 0, done: false };

      for(const taskRun of execution.tasks) {
        if(taskRun.response === null) {
          continue;
        } else if(taskRun.response.status == 200) {
          taskRunInfoMap[taskRun.name].done = true;
        } else if(taskRun.response.status == 404) {
          assert.ok(taskRun.response.data.retryAfter);
          assert.equal(taskRunInfoMap[taskRun.name].done, false);
          taskRunInfoMap[taskRun.name].errorCount = 0;
          taskRunInfoMap[taskRun.name].deferCount++;
          taskRunInfoMap[taskRun.name].nextRun = taskRun.ended.getTime() + taskRun.response.data.retryAfter * 1000;
        } else if(taskRun.response.status == 500 || taskRun.response.status == 503) {
          assert.equal(taskRunInfoMap[taskRun.name].done, false);
          taskRunInfoMap[taskRun.name].errorCount++;
          taskRunInfoMap[taskRun.name].nextRun = taskRun.ended.getTime() + taskRunInfoMap[taskRun.name].errorCount * 60 * 1000;
        } else {
          assert.fail();
        }
      }

      const tasksPending = version.tasks.filter(task => !taskRunInfoMap[task.name].done);
      const tasksNotBlocked = tasksPending.filter(task => !task.needs || task.needs.every(need => taskRunInfoMap[need].done));
      const tasksToRunNow = tasksNotBlocked.filter(task => taskRunInfoMap[task.name].nextRun <= new Date().getTime());

      if(tasksToRunNow.length) {

        const taskRuns = [];
        for(let task of tasksToRunNow) {

          const taskRun = {
            name      : task.name,
            scheduled : execution.scheduled,
            started   : new Date(),
            ended     : null,
            response  : null
          };

          utils.doHttpGet(task.url, execution.params)
              .then(response => {
                taskRun.response = { status: response.status, data: response.data };
                taskRun.ended = new Date();
              })
              .catch(error => {
                console.error('Error:', error.message);
                console.error(error.stack);
              });

          taskRuns.push(taskRun);
          execution.tasks.push(taskRun);

        }

        // Updating the execution with the task runs (in progress)
        let updates = { 'tasks': _.cloneDeep(execution.tasks), 'state': 'running', 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);

        while(taskRuns.some(taskRun => !taskRun.ended))
          await new Promise(resolve => setTimeout(resolve, 100));

        // Updating the execution with the task runs (completed)
        updates = { 'tasks': _.cloneDeep(execution.tasks), 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);

      } else if(tasksNotBlocked.length) {

        const nextRun = Math.min(...tasksNotBlocked.map(task => taskRunInfoMap[task.name].nextRun));

        const updates = { 'scheduled': new Date(nextRun), 'count': runCount + 1, 'state': 'waiting', 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);

        this.cloudTasksService.createTask(workflowId, executionId, new Date(nextRun), runCount + 1);

        break;

      } else if(tasksPending.length) {

        const updates = { 'scheduled': null, 'count': runCount + 1, 'state': 'error', 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);

        break;

      } else {

        const updates = { 'scheduled': null, 'count': runCount + 1, 'state': 'completed', 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);

        break;

      }

    } // while(true)

  } // processWorkflow

}

module.exports = WorkflowsService;
