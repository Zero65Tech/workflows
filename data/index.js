const fs = require('fs');
const path = require('path');

// Environment Variables
process.env.STAGE = process.env.STAGE || 'alpha';

// Services
const CloudTasksService = require('../src/services/cloudTasks');
const WorkflowsService  = require('../src/services/workflows');

// DAOs
const workflowDao  = require('../src/firestore/workflow');
const versionDao   = require('../src/firestore/version');
const executionDao = require('../src/firestore/execution');

// Dependency Injection
const cloudTasksService = new CloudTasksService();
const workflowsService  = new WorkflowsService(workflowDao, versionDao, executionDao, cloudTasksService);

// Workflows' Data
const owner = 'zero65';
const workflows = fs.readdirSync(__dirname)
    .filter(file => path.extname(file) === '.json')
    .map(file => path.basename(file, '.json'));

(async () => {

  for(const name of workflows) {

    console.log(name);

    const workflowId = await workflowsService.createWorkflow(name, owner);

    let { params, tasks } = require(`./${name}.json`);
    params = JSON.stringify(params);
    tasks = JSON.stringify(tasks);

    await workflowsService.updateWorkflow(workflowId, null, params, tasks);

  }

})();