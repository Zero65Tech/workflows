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

  describe('should not process at all', () => {
    for(const state of [ 'completed', 'failed', 'error' ]) {
      it(`execution.state: ${state}`, async () => {

        const execution = { state: state };

        executionDao.get.mockResolvedValue(execution);

        const workflowId = 'wId';
        const executionId = 'eId';
        const runCount = undefined;

        await workflowsService.processWorkflow(workflowId, executionId, runCount);

        expect(executionDao.get).toHaveBeenCalledTimes(1);
        expect(versionDao.get).not.toHaveBeenCalled();
        expect(executionDao.update).not.toHaveBeenCalled();
        expect(cloudTasksService.createTask).not.toHaveBeenCalled();

        expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      });
    }
  });

  describe('should only create a new task if runCount < execution.count', () => {
    for(const runCount of [ undefined, null, 0, 1, 2]) {
      for(const state of [ 'running', 'waiting' ]) {
        it(`execution.state: ${state}, runCount: ${runCount}`, async () => {

          const execution = { scheduled: new Date(), count: 2, state: state };

          executionDao.get.mockResolvedValue(execution);

          const workflowId = 'wId';
          const executionId = 'eId';
          const runCount = undefined;

          await workflowsService.processWorkflow(workflowId, executionId, runCount);

          expect(executionDao.get).toHaveBeenCalledTimes(1);
          expect(versionDao.get).not.toHaveBeenCalled();
          expect(executionDao.update).not.toHaveBeenCalled();
          expect(cloudTasksService.createTask).toHaveBeenCalledTimes(1);

          expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);
          expect(cloudTasksService.createTask).toHaveBeenCalledWith(workflowId, executionId, execution.scheduled, execution.count);

        });
      }
    }
  });

  describe('should execute workflow tasks and update execution data', () => {

    it('single task', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([{ name: 'task_1', url: 'http://example.com', needs: [] }])
      };

      const execution = {
        versionId: 'vId',
        params: {},
        scheduled: new Date(),
        count: 0,
        tasks: [],
        state: 'waiting',
        created: new Date(),
        updated: new Date()
      };

      const taskUrlResponse = { code: 200, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.processWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(3);
      expect(cloudTasksService.createTask).not.toHaveBeenCalled();

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, {
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: null,
          response: null
        }],
        state: 'running',
        updated: expect.any(Date)
      }]);

      expect(executionDao.update.mock.calls[1]).toEqual([ workflowId, executionId, expect.objectContaining({
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: null,
        count: 1,
        state: 'completed',
        updated: expect.any(Date)
      })]);

    });

    it('single task deferred', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([{ name: 'task_1', url: 'http://example.com', needs: [] }])
      };

      const execution = {
        versionId: 'vId',
        params: {},
        scheduled: new Date(),
        count: 0,
        tasks: [],
        state: 'waiting',
        created: new Date(),
        updated: new Date()
      };

      const taskUrlResponse = { code: 404, data: { retryAfter: 60 } }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.processWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(3);
      expect(cloudTasksService.createTask).toHaveBeenCalledTimes(1);

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, {
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: null,
          response: null
        }],
        state: 'running',
        updated: expect.any(Date)
      }]);

      expect(executionDao.update.mock.calls[1]).toEqual([ workflowId, executionId, expect.objectContaining({
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[0].ended.getTime() + taskUrlResponse.data.retryAfter * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

    it('should retry task execution if response code is 500', async () => {
      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 2;

      const execution = {
        state: 'running',
        count: 2,
        tasks: [],
        versionId: 'vId'
      };
      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([{ name: 'task1', url: 'http://example.com', needs: [] }])
      };

      executionDao.get.mockResolvedValue(execution);
      versionDao.get.mockResolvedValue(version);
      utils.doHttpGet.mockResolvedValue({ code: 500, data: {} });

      await workflowsService.processWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);
      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);
      expect(executionDao.update).toHaveBeenCalledWith(workflowId, executionId, expect.objectContaining({ state: 'running' }));
      expect(cloudTasksService.createTask).toHaveBeenCalled();
    });

    it('should fail if task response code is unexpected', async () => {
      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 2;

      const execution = {
        state: 'running',
        count: 2,
        tasks: [],
        versionId: 'vId'
      };
      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([{ name: 'task1', url: 'http://example.com', needs: [] }])
      };

      executionDao.get.mockResolvedValue(execution);
      versionDao.get.mockResolvedValue(version);
      utils.doHttpGet.mockResolvedValue({ code: 403, data: {} });

      await expect(workflowsService.processWorkflow(workflowId, executionId, runCount)).rejects.toThrow();

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);
      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);
    });
  });

});