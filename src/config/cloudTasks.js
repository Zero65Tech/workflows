const { CloudTasksClient } = require('@google-cloud/tasks');

const projectId = process.env.STAGE === 'prod' || process.env.STAGE === 'gamma'
    ? 'zero65-workflows'
    : 'zero65-test'; // beta & alpha
const location = 'asia-south1';
const queue = 'default';

const client = new CloudTasksClient();

module.exports = {
  client,
  queuePath: client.queuePath(project, location, queue)
};
