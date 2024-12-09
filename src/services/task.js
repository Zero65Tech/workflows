const taskRepository = require('../repositories/task');

exports.getByExecutionStepAndTask = async (workflowId, executionId, step, task) => {

  return await taskRepository.findOneByExecutionStepAndTask(workflowId, executionId, step, task);

}

exports.add = async (data) => {
  data.created = new Date();
  data.updated = new Date();
  return taskRepository.add(data);
}
