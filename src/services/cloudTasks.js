const { client, queuePath, hostName } = require('../config/cloudTasks');

class CloudTasksService {

  async createTask(workflowId, executionId, runCount) {

    const taskName = runCount ? `${workflowId}-${executionId}-${runCount}` : `${workflowId}-${executionId}`;
    const path = runCount ? `/${workflowId}/${executionId}/${runCount}` : `/${workflowId}/${executionId}`;

    const taskConfig = {
      name: `${queuePath}/tasks/${taskName}`,
      httpRequest: {
        httpMethod: 'GET',
        url: hostName + path,
      },
    };

    const [createdTask] = await client.createTask({ parent: queuePath, task: taskConfig });

  }

}