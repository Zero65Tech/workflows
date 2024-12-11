
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

exports.executeWorkflow = async (workflowId, params) => {

  const version = Version.getLatest(workflowId);

  return await Execution.create(workflowId, version.id, params);

}

exports.processTasks = async () => {
  const executions = Execution.getAllAtive();
  for(const execution of executions) {
    const version = Version.getLatest(workflowId);
    // iterate over steps
    // if task(s) is already created, update task status
    // create task for next step
    await Task.create(execution.workflowId, { executionId: execution.id, status: 'pending', host: 'localhost', params: execution.params });
    // if all steps are completed, update execution status
  }
}
