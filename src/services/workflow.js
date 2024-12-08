const workflowRepository = require('../repositories/workflow');

exports.getByNameAndOwner = async (name, owner) => {

  return await workflowRepository.getByNameAndOwner(name, owner);

}

exports.add = async (data) => {
  data.create = new Date();
  data.update = new Date();
  return workflowRepository.add(data);
}
