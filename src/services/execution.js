const executionRepository = require('../repositories/execution');

exports.get = async (workflowId, executionId) => {

  return await executionRepository.get(workflowId, executionId);

}

exports.add = async (data) => {
  data.created = new Date();
  data.updated = new Date();
  return executionRepository.add(data);
}
