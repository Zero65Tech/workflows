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

exports.processWorkflow = async (workflowId, executionId, runCount) => {

  const execution = await Execution.get(workflowId, executionId);
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

    await Execution.update(workflowId, executionId, { runs: [ ...execution.runs, ...runs ], state: 'running', updated: new Date() });

    // TODO: Fetch tasks' url
    // TODO: Update tasks' runs with ended and response

    const updates = { runs: [ ...execution.runs, ...runs ], updated: new Date() };

    let response = { eta: 0, wait: false };

   if(response.eta) {
      updates['next.scheduled'] = new Date() + response.eta;
      updates.state = 'waiting';
      await Execution.update(workflowId, executionId, updates);
      // Create a Google Cloud Task with id as <workflowId>$<executionId>$<runCount+1>
      return;
    } else if(version.steps[s + 1]) {
      updates['next.step'] = step[s + 1].name;
      await Execution.update(workflowId, executionId, updates);
    } else {
      updates.next = null;
      updates.state = 'completed';
      await Execution.update(workflowId, executionId, updates);
    }
  
  }

}
