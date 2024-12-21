const assert = require('assert');

class MainService {

  constructor(cloudTasksService) {
    this.cloudTasksService = cloudTasksService;
  }

  createWorkflow = async (name, owner) => {

    // Required for backfilling data from the firestore folder. TODO: Remove this after backfilling.
    const workflow = await Workflow.getLatestByNameAndOwner(name, owner);
    if(workflow)
      return workflow.id;

    const data = { name, owner, created: new Date(), updated: new Date() };
    return await Workflow.create(data);

  }
  
  updateWorkflow = async (workflowId, versionName, params, steps) => {

    const checksum = Utils.generateChecksum(JSON.parse(steps));

    const version = Version.getLatestByChecksum(workflowId, checksum);
    if(version) {
      const updates = { name:versionName, params, steps, updated: new Date() };
      return (await Version.update(workflowId, version.id, updates)).id;
    }

    const data = { name:versionName, params, steps, checksum, created: new Date(), updated: new Date() }
    return await Version.create(workflowId, data);

  }

  triggerWorkflow = async (workflowId, params, scheduled) => {

    const version = Version.getLatest(workflowId);

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

    const executionId = await Execution.create(workflowId, executionData);

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
        - Won't do anything as Execution `count` will less than the Run `runCount`
      - Should happen very rarely
    3. Next Run is triggered before the current Run is completed:
      - As execution `count` is updated before the next Run is created, hence, no issues

    Error Conditions:
    1. Run crashed before updating the Execution `count`:
      - Run will be re-tried
      - Will try to pick up from where it left
    2. Run crashed after updating the Execution `count`:
      - Run will be re-tried
      - Shall create the next Run (if not already created) and return

    */


    const execution = await Execution.get(workflowId, executionId);
    if(execution.state == 'completed' || execution.state == 'failed')
      return;

    if(runCount < execution.count)
      return this.cloudTasksService.createTask(workflowId, execution.id, execution.next.scheduled, execution.count);

    assert.strictEqual(runCount, execution.count);

    const version = Version.get(workflowId, execution.versionId);
    
    for(let s = version.steps.findIndex(step => step.name === execution.next.step); s < version.steps.length; s++) {

      const step = version.steps[s];

      // Task runs for the current step
      let runs = execution.tasks.filter(task => task.step === step.name && task.response.code >= 200 && task.response.code <= 299);

      // Tasks that are yet to run
      let tasks = step.tasks.filter(task => !runs.find(run => run.task === task.name));
      runs = tasks.map(task => {
        const run = {
          step      : step.name,
          task      : task.name,
          scheduled : execution.next.scheduled,
          started   : new Date(),
          ended     : null,
          response  : null
        };
        task.run = run;
        return run;
      });

      const updates = { tasks: [ ...execution.tasks, ...runs ], state: 'running', updated: new Date() };
      await Execution.update(workflowId, executionId, updates);

      for(let task of tasks) {
        new Promise(async (resolve, reject) => {
          task.response = await axios.get(task.url, task.params);
          resolve();
        });
      }

      let response = { code: 200, data: null };
      while (tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
        for(let task of tasks) {
          if(!task.response)
            continue;
          if(task.run.ended)
            continue;
          task.run.ended = new Date();
          if(task.response.code < response)
            continue;
          response.code = task.response.code;
          response.data = task.response.data;
        }
        tasks = tasks.filter(task => !task.run.ended);
      }

      let nextRun = null; // Re-run requested by one or more task at a certain time

      if(nextRun) {
        const nexRun = execution.next.scheduled.getTime() / 1000 + response.minEta * 60;
        updates['next.scheduled'] = nexRun;
        updates['count']          = runCount + 1;
        updates['tasks']          = [ ...execution.tasks, ...runs ];
        updates['state']          = 'waiting';
        updates['updated']        = new Date();
        await Execution.update(workflowId, executionId, updates);
        return this.cloudTasksService.createTask(workflowId, execution.id, nexRun, runCount + 1);
      } else if(version.steps[s + 1]) {
        updates['next.step']      = step[s + 1].name;
        updates['tasks']          = [ ...execution.tasks, ...runs ];
        updates['updated']        = new Date();
        await Execution.update(workflowId, executionId, updates);
      } else {
        updates['next']           = null;
        updates['count']          = runCount + 1;
        updates['tasks']          = [ ...execution.tasks, ...runs ];
        updates['state']          = 'completed';
        updates['updated']        = new Date();
        await Execution.update(workflowId, executionId, updates);
      }
    
    } // for

  }

}