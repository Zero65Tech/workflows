const workflowRepository = require('../repositories/workflow');

exports.getByNameAndOwner = async (name, owner) => { // Needed for back-filling data from GitHub repository

  return await workflowRepository.findOneByNameAndOwner(name, owner);

}

exports.add = async (data) => {
  data.created = new Date();
  data.updated = new Date();
  return workflowRepository.add(data);
}
