
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

exports.executeWorkflow = async (workflowId, refId, params) => {

  const version = Version.getLatest(workflowId);

  // TODO: Create a Google Cloud Task with id as <workflowId>$<refId>

  return await Execution.create(workflowId, refId, version.id, params);

}

exports.executeWorkflowStep = async (workflowId, refId, step, retry) => {

  let execution; // Get execution by workflowId and refId

  if(!step) {
    /*
      - Create a Google Cloud Task with id as <workflowId>$<refId>$<step>
      - Update execution with next step
        next = { step: <first-step-name>, retry: 0, scheduled: new Date() };
    */
  } else {
    /*
      - Fetch tasks' url
      - if task(s) are successfule, update execution with next step
        next = { step: <next-step-name>, retry: 0, scheduled: new Date() };
      - if one or more task(s) failed, throw error
      - if one or more task request reschedule
        Create a Google Cloud Task with id as <workflowId>$<refId>$<step>$<retry>
        next = { step: <current-step-name>, retry: 1, scheduled: new Date() };
    */
  }

}
