const executionRepository = require('../repositories/execution');

exports.getByStepAndTask = async (workflowId, step, task) => {

  return await executionRepository.getByStepAndTask(workflowId, step, task);

}

exports.add = async (data) => {
  data.create = new Date();
  data.update = new Date();
  return executionRepository.add(data);
}
