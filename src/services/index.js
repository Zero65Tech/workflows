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
      step: 0,
      retry: 0,
      scheduled: new Date()
    },
    runs: [],
    state: 'waiting',
    created: new Date(),
    updated: new Date()
  }

  const executionId = await Execution.create(workflowId, data);

  // TODO:
  // Create a Google Cloud Task with id as <workflowId>$<executionId>$step-0
  // Proceed if the task is created successfully
  // throw error otherwise

}

exports.processWorkflow = async (workflowId, executionId, step, retry) => {

  const execution = await Execution.get(workflowId, executionId);

  assert(execution.state == 'running' || execution.state == 'waiting');
  assert(step == execution.next.step && retry == execution.next.retry && new Date() >= execution.next.scheduled);

  const version = Version.get(workflowId, execution.versionId);
  const tasks = version.steps[step].tasks;
  // TODO: filter out tasks that are already run

  const runs = tasks.map(task => ({
      step      : version.steps[execution.next.step].name,
      task      : task.name,
      scheduled : execution.next.scheduled,
      started   : new Date(),
      ended     : null,
      response  : null
  }));

  await Execution.update(workflowId, executionId, { runs: [ ...execution.runs, ...runs ], state: 'running', updated: new Date() });

  // TODO: Fetch tasks' url
  // TODO: Update tasks' runs with ended and response

  await Execution.update(workflowId, executionId, { runs: [ ...execution.runs, ...runs ], state: 'waiting', updated: new Date() });

  // If any of the task requests for a retry
    // Create a Google Cloud Task with id as <workflowId>$<executionId>$step-<step>$retry-<retry+1>
    await Execution.update(workflowId, executionId, { next: { step: step, retry: 1, scheduled: new Date() + response.eta }, state: 'waiting', updated: new Date() });
  else if(version.steps[step + 1])
    // Create a Google Cloud Task with id as <workflowId>$<executionId>$step-<step+1>
    await Execution.update(workflowId, executionId, { next: { step: step+1, retry: 0, scheduled: new Date() }, state: 'waiting', updated: new Date() });
  else
    await Execution.update(workflowId, executionId, { state: 'completed', updated: new Date() });
  
}
