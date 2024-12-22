const { CloudTasksClient } = require('@google-cloud/tasks');

const projectId = process.env.STAGE === 'prod' || process.env.STAGE === 'gamma'
    ? 'zero65-workflows'
    : 'zero65-test'; // beta & alpha
const location = 'asia-south1';
const queue = 'default';

const client = new CloudTasksClient();
const hostName = 'https://workflows.zero65.in';
const queuePath = client.queuePath(projectId, location, queue);

module.exports = { client, queuePath, hostName };
