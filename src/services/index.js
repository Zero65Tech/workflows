const { update } = require("../models/execution");

exports.createNewWorkflow = async (name, owner) => {

  const data = { name, owner, created: new Date(), updated: new Date };
  const workflowId = await Workflow.create(data);

  const versionId = await exports.updateWorkflow(workflowId, 'sample workflow', '[]', '[]');

  return { workflowId, versionId };

}
  
exports.updateWorkflow = async (workflowId, name, params, steps) => {

  const checksum = Utils.generateChecksum({ params: JSON.parse(params), steps: JSON.parse(steps) });

  const version = Version.getLatestByChecksum(workflowId, checksum);
  
  if(version) {
    const data = { name, params, steps, updated: new Date() };
    await Version.update(workflowId, version.id, data);
    return version.id;
  } else {
    const data = { name, params, steps, checksum, created: new Date(), updated: new Date() }
    return await Version.create(workflowId, data);
  }

}

exports.createExecution = async (workflowId, refId, params) => {

  const execution = await Execution.getLatestByRefId(workflowId, refId);
  if(execution.state == 'queued' || execution.state == 'running' || execution.state == 'waiting')
    return;

  // TODO: Create a Google Cloud Task with id as <workflowId>$<refId>

}

exports.processExecution = async (workflowId, refId, step, retry) => {

  const execution = await Execution.getLatestByRefId(workflowId, refId);

  if(!step) {

    assert(!execution || execution.state == 'completed' || execution.state == 'failed');
  
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
      state: 'queued',
      created: new Date(),
      updated: new Date()
    }

    // TODO: Create a Google Cloud Task with id as <workflowId>$<refId>$<version.steps[0].name>

    return await Execution.create(workflowId, data);

  } else if(step == execution.next.step && retry == execution.next.retry) {

    const version = Version.get(workflowId, execution.versionId);
    const tasks = version.steps.find(s => s.name == step).tasks;
    const runs = tasks.map(t => ({ ...execution.next, task: t.name, started: new Date(), ended: null, response: null }));

    await Execution.update(workflowId, { runs: [ ...execution.runs, ...runs ], state: 'running', updated: new Date() });

    // TODO: Fetch tasks' url
    // TODO: Update tasks' runs with ended and response

    const next = { step: version.steps.find(s => s.name == step).next, retry: 0, scheduled: new Date() };
    // TODO: Create a Google Cloud Task with id as <workflowId>$<refId>$<next.step>
    await Execution.update(workflowId, { next, runs: [ ...execution.runs, ...runs ], state: 'waiting', updated: new Date() });

  } else {

    // Can not proceed
    // Throw error

  }

}
