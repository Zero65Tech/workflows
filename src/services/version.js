const versionRepository = require('../repositories/version');

exports.getByChecksum = async (workflowId, checksum) => {

  return await versionRepository.findOneByChecksum(workflowId, checksum);

}

exports.add = async (workflowId, data) => {
  data.created = new Date();
  data.updated = new Date();
  return versionRepository.add(workflowId, data);
}
