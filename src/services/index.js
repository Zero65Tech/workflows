const { assert } = require("joi");

exports.createWorkflow = async (name, owner) => {

  const workflow = await Workflow.getLatestByNameAndOwner(name, owner);
  if(workflow)
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

exports.triggerWorkflow = async (workflowId, refId, params) => {

  const execution = await Execution.getLatestByRefId(workflowId, refId);
  if(execution) {
    if(execution.state == 'running' || execution.state == 'waiting')
      return execution.id;
    assert(execution.state == 'completed' || execution.state == 'failed');
  }

  // TODO:
  // Create a Google Cloud Task with id as <workflowId>$<refId>$step-0
  // Proceed only if the task is created successfully
  // throw error otherwise

  const version = Version.getLatest(workflowId);

  const data = {
    refId: refId,
    versionId: version.id,
    params: params,
    next: {
      step: version.steps[0].name,
      retry: 0,
      scheduled: new Date()
    },
    runs: [],
    state: 'waiting',
    created: new Date(),
    updated: new Date()
  }

  return await Execution.create(workflowId, data);

}

exports.processWorkflow = async (workflowId, refId, step, retry) => {

  const execution = await Execution.getLatestByRefId(workflowId, refId);
  if(!execution)
    throw new Error('Execution not found');
  else if(execution.state == 'completed' || execution.state == 'failed')
    throw new Error('Execution not found');
  
  assert(execution.state == 'running' || execution.state == 'waiting');

  if(step != execution.next.step || retry == execution.next.retry || new Date() < execution.next.scheduled)
    throw new Error('Execution not found');


  const version = Version.get(workflowId, execution.versionId);
  const tasks = version.steps.find(s => s.name == step).tasks;
  const runs = tasks.map(t => ({ ...execution.next, task: t.name, started: new Date(), ended: null, response: null }));

  await Execution.update(workflowId, { runs: [ ...execution.runs, ...runs ], state: 'running', updated: new Date() });

  // TODO: Fetch tasks' url
  // TODO: Update tasks' runs with ended and response

  const next = { step: version.steps.find(s => s.name == step).next, retry: 0, scheduled: new Date() };
  // TODO: Create a Google Cloud Task with id as <workflowId>$<refId>$<next.step>
  await Execution.update(workflowId, { next, runs: [ ...execution.runs, ...runs ], state: 'waiting', updated: new Date() });

}
