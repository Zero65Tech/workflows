const express = require('express');

// Services and Controllers
const CloudTasksService   = require('./services/cloudTasks');
const WorkflowsService    = require('./services/workflows');
const WorkflowsController = require('./controllers/workflows');

// DAOs
const workflowDao  = require('./firestore/workflow');
const versionDao   = require('./firestore/version');
const executionDao = require('./firestore/execution');

// Dependency Injection
const cloudTasksService   = new CloudTasksService();
const workflowsService    = new WorkflowsService(workflowDao, versionDao, executionDao, cloudTasksService);
const workflowsController = new WorkflowsController(workflowsService);

// Express App
const app = express();
app.use(express.json());

// Routes
app.post('/create', workflowsController.createWorkflow);
app.post('/update/:workflowId', workflowsController.updateWorkflow);
app.post('/trigger/:workflowId', workflowsController.triggerWorkflow);
app.post('/process/:workflowId/:executionId/:runCount', workflowsController.processWorkflow);

// Export App
module.exports = app;
