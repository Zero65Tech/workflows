exports.createWorkflow = async (name, owner) => {

  const workflow = await Workflow.getLatestByNameAndOwner(name, owner);
  if(workflow) // Required for backfilling data from firestore folder. TODO: Remove this after backfilling.
    return workflow.id;

  const data = { name, owner, created: new Date(), updated: new Date() };
  return await Workflow.create(data);

}
  
exports.updateWorkflow = async (workflowId, name, params, steps) => {

  const checksum = Utils.generateChecksum({ params: JSON.parse(params), steps: JSON.parse(steps) });

  const version = Version.getLatestByChecksum(workflowId, checksum);
  if(version) {
    const updates = { name, params, steps, updated: new Date() };
    return (await Version.update(workflowId, version.id, updates)).id;
  }

  const data = { name, params, steps, checksum, created: new Date(), updated: new Date() }
  return await Version.create(workflowId, data);

}

exports.triggerWorkflow = async (workflowId, params) => {

  const version = Version.getLatest(workflowId);

  const data = {
    versionId: version.id,
    params: params,
    next: {
      step: version.steps[0].name,
      scheduled: new Date()
    },
    count: 0,
    runs: [],
    state: 'queued',
    created: new Date(),
    updated: new Date()
  }

  const executionId = await Execution.create(workflowId, data);

  // TODO:
  // Create a Google Cloud Task with id as <workflowId>$<executionId>
  // Proceed if the task is created successfully
  // throw error otherwise

}

exports.processWorkflow = async (workflowId, executionId, count) => {

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
      - Won't do anything as Execution `count` will less than the Run `count`
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


  const execution = await Execution.get(workflowId, executionId);
  if(execution.state == 'completed' || execution.state == 'failed')
    return;

  if(count < execution.count) {
    // TODO: Create next Run if not already created
    return;
  }

  assert(execution.count == count);

  const version = Version.get(workflowId, execution.versionId);
  
  for(let s = version.steps.findIndex(step => step.name === execution.next.step); s < version.steps.length; s++) {

    const step = version.steps[s];
    const tasks = step.tasks;
    // TODO: filter out tasks that are already run based on execution

    const runs = tasks.map(task => ({
        step      : step.name,
        task      : task.name,
        scheduled : execution.next.scheduled,
        started   : new Date(),
        ended     : null,
        response  : null
    }));

    const updates = { runs: [ ...execution.runs, ...runs ], state: 'running', updated: new Date() };
    await Execution.update(workflowId, executionId, updates);

    // TODO: Fetch tasks' url
    // TODO: Update tasks' runs with ended and response

    let nextRun = null; // Re-run requested by one or more task at a certain time

    updates.updated = new Date();
    if(nextRun) {
      updates['next.scheduled'] = new Date() + response.eta;
      updates.count = count + 1;
      updates.state = 'waiting';
      await Execution.update(workflowId, executionId, updates);
      // Create a Google Cloud Task with id as <workflowId>$<executionId>$<runCount+1>
      return;
    } else if(version.steps[s + 1]) {
      updates['next.step'] = step[s + 1].name;
      await Execution.update(workflowId, executionId, updates);
    } else {
      updates.next = null;
      updates.count = count + 1;
      updates.state = 'completed';
      await Execution.update(workflowId, executionId, updates);
    }
  
  }

}
