class WorkflowsController {

  constructor(workflowService) {
    this.workflowService = workflowService;
  }

  createWorkflow = async (req, res) => {
    const { name, owner } = req.body;
    const workflowId = this.workflowService.createWorkflow(name, owner);
    res.send({ workflowId });
  };

  updateWorkflow = async (req, res) => {
    const { workflowId } = req.params;
    const { versionName, params, steps } = req.body;
    const versionId = this.workflowService.updateWorflow(workflowId, versionName, params, steps);
    res.send({ versionId });
  };

  triggerWorkflow = async (req, res) => {
    const { workflowId } = req.params;
    const { params, scheduled } = req.body;
    const executionId = this.workflowService.triggerWorkflow(workflowId, params, scheduled);
    res.send({ executionId });
  };

  executeWorkflow = async (req, res) => {
    const { workflowId, executionId, runCount } = req.params;
    this.workflowService.executeWorkflow(workflowId, executionId, runCount);
    res.sendStatus(204);
  };

}

module.exports = WorkflowsController;