const workflowRepository = require('../repositories/workflow');

exports.getByNameAndOwner = async (name, owner) => {

  return await workflowRepository.getByNameAndOwner(name, owner);

}

exports.add = async (data) => {
  data.created = new Date();
  data.updated = new Date();
  return workflowRepository.add(data);
}
