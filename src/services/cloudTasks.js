const { client, queuePath, hostName, oidcToken } = require('../../src/config/cloudTasks');

class CloudTasksService {

  async createTask(workflowId, executionId, timestamp, runCount) {

    const name = `${queuePath}/tasks/` + `${workflowId}-${executionId}-${runCount}`;

    const url = `${hostName}/execute` + `/${workflowId}/${executionId}/${runCount}`;

    const scheduleTime = timestamp
      ? { seconds: timestamp.getTime() / 1000 }
      : undefined;

    const taskConfig = { name, httpRequest: { httpMethod: 'GET', url, oidcToken }, scheduleTime };

    try {
      await client.createTask({ parent: queuePath, task: taskConfig });
    } catch (error) {
      if(error.code !== 6) // Requested entity already exists
        throw error;
    }

  }

}

module.exports = CloudTasksService;
