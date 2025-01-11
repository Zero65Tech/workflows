const WorkflowsService = require('../src/services/workflows');
const utils = require('../src/utils');

jest.mock('../src/utils');

describe('WorkflowsService', () => {

  let workflowDao, versionDao, executionDao, cloudTasksService, workflowsService;

  beforeEach(() => {
    workflowDao = {
      getLatestByNameAndOwner: jest.fn(),
      add: jest.fn()
    };
    versionDao = {
      getLatestByChecksum: jest.fn(),
      update: jest.fn(),
      add: jest.fn(),
      getLatest: jest.fn(),
      get: jest.fn()
    };
    executionDao = {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn()
    };
    cloudTasksService = {
      createTask: jest.fn()
    };
    workflowsService = new WorkflowsService(workflowDao, versionDao, executionDao, cloudTasksService);
  });
/*
  describe('createWorkflow', () => {
    it('should return existing workflow id if workflow already exists', async () => {
      const name = 'testWorkflow';
      const owner = 'testOwner';
      const existingWorkflow = { id: '123' };

      workflowDao.getLatestByNameAndOwner.mockResolvedValue(existingWorkflow);

      const result = await workflowsService.createWorkflow(name, owner);

      expect(result).toBe(existingWorkflow.id);
      expect(workflowDao.getLatestByNameAndOwner).toHaveBeenCalledWith(name, owner);
    });

    it('should create a new workflow if it does not exist', async () => {
      const name = 'testWorkflow';
      const owner = 'testOwner';
      const newWorkflowId = '123';

      workflowDao.getLatestByNameAndOwner.mockResolvedValue(null);
      workflowDao.add.mockResolvedValue(newWorkflowId);

      const result = await workflowsService.createWorkflow(name, owner);

      expect(result).toBe(newWorkflowId);
      expect(workflowDao.getLatestByNameAndOwner).toHaveBeenCalledWith(name, owner);
      expect(workflowDao.add).toHaveBeenCalledWith(expect.objectContaining({ name, owner }));
    });
  });

  describe('updateWorkflow', () => {
    it('should update existing version if checksum matches', async () => {
      const workflowId = '123';
      const versionName = 'v1';
      const params = {};
      const tasks = JSON.stringify([]);
      const checksum = 'checksum';
      const existingVersion = { id: '456' };

      utils.generateChecksum.mockReturnValue(checksum);
      versionDao.getLatestByChecksum.mockResolvedValue(existingVersion);

      const result = await workflowsService.updateWorkflow(workflowId, versionName, params, tasks);

      expect(result).toBe(existingVersion.id);
      expect(versionDao.getLatestByChecksum).toHaveBeenCalledWith(workflowId, checksum);
      expect(versionDao.update).toHaveBeenCalledWith(workflowId, existingVersion.id, expect.objectContaining({ name: versionName, params, tasks }));
    });

    it('should create a new version if checksum does not match', async () => {
      const workflowId = '123';
      const versionName = 'v1';
      const params = {};
      const tasks = JSON.stringify([]);
      const checksum = 'checksum';
      const newVersionId = '456';

      utils.generateChecksum.mockReturnValue(checksum);
      versionDao.getLatestByChecksum.mockResolvedValue(null);
      versionDao.add.mockResolvedValue(newVersionId);

      const result = await workflowsService.updateWorkflow(workflowId, versionName, params, tasks);

      expect(result).toBe(newVersionId);
      expect(versionDao.getLatestByChecksum).toHaveBeenCalledWith(workflowId, checksum);
      expect(versionDao.add).toHaveBeenCalledWith(workflowId, expect.objectContaining({ name: versionName, params, tasks, checksum }));
    });
  });

  describe('triggerWorkflow', () => {
    it('should create a new execution and trigger a cloud task', async () => {
      const workflowId = '123';
      const params = {};
      const timestamp = new Date();
      const version = { id: '456' };
      const executionId = '789';

      versionDao.getLatest.mockResolvedValue(version);
      executionDao.create.mockResolvedValue(executionId);

      await workflowsService.triggerWorkflow(workflowId, params, timestamp);

      expect(versionDao.getLatest).toHaveBeenCalledWith(workflowId);
      expect(executionDao.create).toHaveBeenCalledWith(workflowId, expect.objectContaining({ versionId: version.id, params, scheduled: timestamp }));
      expect(cloudTasksService.createTask).toHaveBeenCalledWith(workflowId, executionId);
    });
  });
*/

  describe('should not process', () => {
    for(const state of [ 'completed', 'failed', 'error' ]) {
      it(`execution.state: ${state}`, async () => {

        const workflowId = 'wId';
        const executionId = 'eId';
        const runCount = undefined;

        const execution = { state: state };
        executionDao.get.mockResolvedValue(execution);

        await workflowsService.processWorkflow(workflowId, executionId, runCount);

        expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

        expect(versionDao.get).not.toHaveBeenCalled();
        expect(executionDao.update).not.toHaveBeenCalled();
        expect(cloudTasksService.createTask).not.toHaveBeenCalled();

      });
    }
  });

  describe('should create a new task if runCount < execution.count', () => {
    for(const runCount of [ undefined, null, 0, 1, 2]) {
      for(const state of [ 'running', 'waiting' ]) {
        it(`execution.state: ${state}, runCount: ${runCount}`, async () => {

          const workflowId = 'wId';
          const executionId = 'eId';
          const runCount = undefined;

          const execution = { scheduled: new Date(), count: 2, state: state };
          executionDao.get.mockResolvedValue(execution);

          await workflowsService.processWorkflow(workflowId, executionId, runCount);

          expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);
          expect(cloudTasksService.createTask).toHaveBeenCalledWith(workflowId, executionId, execution.scheduled, execution.count);

          expect(versionDao.get).not.toHaveBeenCalled();
          expect(executionDao.update).not.toHaveBeenCalled();

        });
      }
    }
  });

  // Add more tests for different scenarios in processWorkflow

});