const { client, queuePath, hostName } = require('../config/cloudTasks');

class CloudTasksService {

  async createTask(workflowId, executionId, timestamp, runCount) {

    const name = `${queuePath}/tasks/${taskName}` + (runCount
        ? `${workflowId}-${executionId}-${runCount}`
        : `${workflowId}-${executionId}`);

    const url = hostName + (runCount
        ? `/${workflowId}/${executionId}/${runCount}`
        : `/${workflowId}/${executionId}`);
    
    const scheduleTime = timestamp
        ? { seconds: timestamp.getTime() / 1000 }
        : undefined;

    const taskConfig = { name, httpRequest: { httpMethod: 'GET', url }, scheduleTime };

    return await client.createTask({ parent: queuePath, task: taskConfig });

  }

}
