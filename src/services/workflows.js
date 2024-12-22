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

  triggerWorkflow = async (workflowId, params, scheduled) => {

    const version = this.versionDao.getLatest(workflowId);

    const executionData = {
      versionId: version.id,
      params: params,
      next: {
        step: version.steps[0].name,
        scheduled: scheduled
      },
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
    version.steps = JSON.parse(version.steps);

    for(let s = version.steps.findIndex(step => step.name === execution.next.step); s < version.steps.length; s++) {

      const step = version.steps[s];

      // Tasks that are yet to run
      let tasks = step.tasks.filter(
          task => !execution.tasks.find(
              run => run.step === step.name && run.task === task.name && run.response.code == 200));

      // Runs for the tasks
      for(const task of tasks) {
        const run = {
          step      : step.name,
          task      : task.name,
          scheduled : execution.next.scheduled,
          started   : new Date(),
          ended     : null,
          response  : null
        };
        task.run = run;
        execution.tasks.push(run);
      }

      // Hitting the task url with params
      for(const task of tasks)
        utils.doHttpGet(task.url, version.params)
            .then(response => { task.response = response; })
            .catch(error => { console.error('Error:', error.message); }); // TODO: Use logger

      // Updating the execution with the task runs (in progress)
      const updates = { tasks: execution.tasks, state: 'running', updated: new Date() };
      await this.executionDao.update(workflowId, executionId, updates);

      let response = { code:200 };
      while(tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
        for(let task of tasks) {

          if(!task.response)
            continue;

          if(task.run.ended)
            continue;

          task.run.ended = new Date();
          task.run.response = { code: task.response.code, data: task.response.data };

          // Updating the execution task run (completed)
          const updates = { tasks: execution.tasks, updated: new Date() };
          await this.executionDao.update(workflowId, executionId, updates);

          if(response.code < task.response.code)
            response = task.response;

        }
        tasks = tasks.filter(task => !task.run.ended);
      }

      if(response.code >= 500 || response.code < 200) { // 0-199 & 500-599
        throw new Error(`Task ${step.name} failed with code ${response.code}`); // TODO:
      } else if(response.code >= 400) { // 400-499
        assert.ok(response.headers['Retry-After']);
        const nexRun = new Date(new Date().getTime() + response.headers['Retry-After'] * 1000);
        const updates = {
          'next.scheduled' : nexRun,
          'count'          : runCount + 1,
          'state'          : 'waiting',
          'updated'        : new Date()
        }
        await this.executionDao.update(workflowId, executionId, updates);
        return this.cloudTasksService.createTask(workflowId, executionId, nexRun, runCount + 1);
      } else if(response.code >= 300) { // 300-399
        assert.fail(); // TODO:
      } else if(version.steps[s + 1]) {
        const updates = {
          'next.step'      : step[s + 1].name,
          'updated'        : new Date()
        }
        await this.executionDao.update(workflowId, executionId, updates);
      } else {
        const updates = {
          'next'           : null,
          'count'          : runCount + 1,
          'state'          : 'completed',
          'updated'        : new Date()
        }
        await this.executionDao.update(workflowId, executionId, updates);
      }

    } // for

  } // processWorkflow

}

module.exports = WorkflowsService;
