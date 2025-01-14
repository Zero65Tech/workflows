const { CloudTasksClient } = require('@google-cloud/tasks');

const projectId = process.env.STAGE === 'prod' || process.env.STAGE === 'gamma'
  ? 'zero65-workflows'
  : 'zero65-test'; // beta & alpha

const location = 'asia-south1';
const queue = 'default';

const client = new CloudTasksClient();
const queuePath = client.queuePath(projectId, location, queue);

const hostName = 'https://workflows-649905653454.asia-south1.run.app';

const oidcToken = {
  serviceAccountEmail: `cloud-tasks@${projectId}.iam.gserviceaccount.com`
};

module.exports = { client, queuePath, hostName, oidcToken };
