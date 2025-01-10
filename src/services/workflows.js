const assert = require('assert');
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

  updateWorkflow = async (workflowId, versionName, params, steps) => {

    const checksum = utils.generateChecksum(JSON.parse(steps));

    const version = await this.versionDao.getLatestByChecksum(workflowId, checksum);
    if(version) {
      const updates = { name:versionName, params, steps, updated: new Date() };
      await this.versionDao.update(workflowId, version.id, updates);
      return version.id;
    }

    const data = { name:versionName, params, steps, checksum, created: new Date(), updated: new Date() }
    return await this.versionDao.add(workflowId, data);

  }

  triggerWorkflow = async (workflowId, params, timestamp) => {

    const version = this.versionDao.getLatest(workflowId);

    const executionData = {
      versionId: version.id,
      params: params,
      scheduled: timestamp,
      count: 0,
      tasks: [],
      state: 'queued',
      created: new Date(),
      updated: new Date()
    }

    const executionId = await this.executionDao.create(workflowId, executionData);

    await this.cloudTasksService.createTask(workflowId, executionId);

  }

  processWorkflow = async (workflowId, executionId, runCount) => {

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
    if(execution.state == 'completed' || execution.state == 'failed')
      return;

    if(runCount < execution.count)
      return this.cloudTasksService.createTask(workflowId, executionId, execution.next.scheduled, execution.count);

    assert.strictEqual(runCount, execution.count);

    const version = this.versionDao.get(workflowId, execution.versionId);
    version.params = JSON.parse(version.params);
    version.tasks = JSON.parse(version.tasks);

    while(true) {

      const taskRunInfoMap = {};

      for(const task of version.tasks)
        taskRunInfoMap[task.name] = { errorCount: 0, deferCount: 0, nextRun: 0, done: false };

      for(const taskRun of execution.tasks) {
        if(taskRun.response.code == 200) {
          taskRunInfoMap[task.name].done = true;
        } else if(taskRun.response.code == 404) {
          assert.ok(response.data.retryAfter);
          taskRunInfoMap[task.name].errorCount = 0;
          taskRunInfoMap[task.name].deferCount++;
          taskRunInfoMap[task.name].nextRun = task.ended.getTime() + task.response.data.retryAfter * 1000;
        } else if(taskRun.response.code == 500) {
          taskRunInfoMap[task.name].errorCount++;
          taskRunInfoMap[task.name].nextRun = task.ended.getTime() + taskRunInfoMap[task.name].errorCount * 60 * 1000;
        } else {
          assert.fail();
        }
      }

      const tasksToRun = version.tasks.filter(task => {
        if(taskRunInfoMap[task.name].done)
          return false;
        if(taskRunInfoMap[task.name].nextRun > new Date().getTime())
          return false;
        if(task.needs.some(need => !taskRunInfoMap[need].done))
          return false;
        return true;
      });

      if(tasksToRun.length) {

        const taskRuns = [];
        for(let task of tasksToRun) {

          const taskRun = {
            name      : task.name,
            scheduled : execution.scheduled,
            started   : new Date(),
            ended     : null,
            response  : null
          };

          utils.doHttpGet(task.url, version.params)
              .then(response => {
                task.response = { code: response.code, data: response.data };
                task.ended = new Date();
              })
              .catch(error => {
                console.error('Error:', error.message);
                console.error(err.stack);
              });

          taskRuns.push(taskRun);
          execution.tasks.push(taskRun);

        }
  
        // Updating the execution with the task runs (in progress)
        const updates = { 'tasks': execution.tasks, 'state': 'running', 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);
  
        while(taskRuns.some(taskRun => !taskRun.ended))
          await new Promise(resolve => setTimeout(resolve, 100));

        // Updating the execution with the task runs (completed)
        const updates = { 'tasks': execution.tasks, 'updated': new Date() };
        await this.executionDao.update(workflowId, executionId, updates);
        
        
      } else {

        const nextRun = Math.max(0, ...Object.values(taskRunInfoMap).filter(info => !info.done).map(info => info.nextRun));

        if(nextRun) {
          const updates = {
            'scheduled' : new Date(nextRun),
            'count'     : runCount + 1,
            'state'     : 'waiting',
            'updated'   : new Date()
          }
          await this.executionDao.update(workflowId, executionId, updates);
          this.cloudTasksService.createTask(workflowId, executionId, new Date(nextRun), runCount + 1);
        } else {
          const updates = {
            'scheduled' : null,
            'count'     : runCount + 1,
            'state'     : 'completed',
            'updated'   : new Date()
          }
          await this.executionDao.update(workflowId, executionId, updates);
        }
  
      }

    } // while(true)

  } // processWorkflow

}

module.exports = WorkflowsService;
