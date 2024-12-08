const versionRepository = require('../repositories/version');

exports.getByChecksum = async (workflowId, checksum) => {

  return await versionRepository.getByChecksum(workflowId, checksum);

}

exports.add = async (data) => {
  data.create = new Date();
  data.update = new Date();
  return versionRepository.add(data);
}
