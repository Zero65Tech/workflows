const { client, queuePath, hostName, oidcToken } = require('../../src/config/cloudTasks');

class CloudTasksService {

  async createTask(workflowId, executionId, timestamp, runCount) {

    const name = `${queuePath}/tasks/` + (runCount
      ? `${workflowId}-${executionId}-${runCount}`
      : `${workflowId}-${executionId}`);

    const url = `${hostName}/process` + (runCount
      ? `/${workflowId}/${executionId}/${runCount}`
      : `/${workflowId}/${executionId}`);

    const scheduleTime = timestamp
      ? { seconds: timestamp.getTime() / 1000 }
      : undefined;

    const taskConfig = { name, httpRequest: { httpMethod: 'GET', url, oidcToken }, scheduleTime };

    return await client.createTask({ parent: queuePath, task: taskConfig });

  }

}

module.exports = CloudTasksService;
