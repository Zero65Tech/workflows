const WorkflowsService = require('../src/services/workflows');
const utils = require('../src/utils');

jest.mock('../src/utils');

describe('executeWorkflow', () => {

  let workflowDao, versionDao, executionDao, cloudTasksService, workflowsService;

  beforeEach(() => {

    workflowDao = {},

    versionDao = {
      get: jest.fn()
    };

    executionDao = {
      get: jest.fn(),
      update: jest.fn()
    };

    cloudTasksService = {
      createTask: jest.fn()
    };

    workflowsService = new WorkflowsService(workflowDao, versionDao, executionDao, cloudTasksService);

  });

  describe('should not execute at all', () => {
    for(const state of [ 'completed', 'failed', 'error' ]) {
      it(`execution.state: ${state}`, async () => {

        const execution = { state: state };

        executionDao.get.mockResolvedValue(execution);

        const workflowId = 'wId';
        const executionId = 'eId';
        const runCount = undefined;

        await workflowsService.executeWorkflow(workflowId, executionId, runCount);

        expect(executionDao.get).toHaveBeenCalledTimes(1);
        expect(versionDao.get).not.toHaveBeenCalled();
        expect(executionDao.update).not.toHaveBeenCalled();
        expect(cloudTasksService.createTask).not.toHaveBeenCalled();

        expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      });
    }
  });

  describe('should only create a new task if runCount < execution.count', () => {
    for(const runCount of [ undefined, null, 0, 1 ]) {
      for(const state of [ 'queued', 'running', 'waiting' ]) {
        it(`execution.state: ${state}, runCount: ${runCount}`, async () => {

          const execution = { scheduled: new Date(), count: 2, state: state };

          executionDao.get.mockResolvedValue(execution);

          const workflowId = 'wId';
          const executionId = 'eId';

          await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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

  describe('should execute workflow with single task', () => {

    it('success', async () => {

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

      const taskUrlResponse = { status: 200, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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

    it('deferred', async () => {

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

      const taskUrlResponse = { status: 404, data: { retryAfter: 5 * 60 } }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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

    it('errored', async () => {

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

      const taskUrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        scheduled: new Date(execution.tasks[0].ended.getTime() + 60 * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

  });

  describe('should execute workflow with two independent tasks', () => {

    it('both success', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const taskUrlResponse = { status: 200, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
        }, {
          name: 'task_2',
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

    it('both deferred', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const taskUrlResponse = { status: 404, data: { retryAfter: 5 * 60 } }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
        }, {
          name: 'task_2',
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

    it('both errored', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const taskUrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[0].ended.getTime() + 60 * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

    it('success & deferred', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const task1UrlResponse = { status: 200, data: { } }
      const task2UrlResponse = { status: 404, data: { retryAfter: 5 * 60 } }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet
          .mockResolvedValueOnce(task1UrlResponse)
          .mockResolvedValueOnce(task2UrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
          response: task1UrlResponse
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: task2UrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[0].ended.getTime() + task2UrlResponse.data.retryAfter * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

    it('success & errored', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const task1UrlResponse = { status: 200, data: {} }
      const task2UrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet
          .mockResolvedValueOnce(task1UrlResponse)
          .mockResolvedValueOnce(task2UrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
          response: task1UrlResponse
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: task2UrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[0].ended.getTime() + 60 * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

    it('deferred & errored', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [] }
        ])
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

      const task1UrlResponse = { status: 404, data: { retryAfter: 5 * 60 } }
      const task2UrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet
          .mockResolvedValueOnce(task1UrlResponse)
          .mockResolvedValueOnce(task2UrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        }, {
          name: 'task_2',
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
          response: task1UrlResponse
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: task2UrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[0].ended.getTime() + 60 * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

  });

  describe('should execute workflow with two dependent tasks', () => {

    it('both success', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_1' ] }
        ])
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

      const taskUrlResponse = { status: 200, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(5);
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

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, {
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: null,
          response: null
        }],
        state: 'running',
        updated: expect.any(Date)
      }]);

      expect(executionDao.update.mock.calls[3]).toEqual([ workflowId, executionId, expect.objectContaining({
        tasks: [{
          name: 'task_1',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }, {
          name: 'task_2',
          scheduled: execution.scheduled,
          started: expect.any(Date),
          ended: expect.any(Date),
          response: taskUrlResponse
        }],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[4]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: null,
        count: 1,
        state: 'completed',
        updated: expect.any(Date)
      })]);

    });

    it('deferred & skip', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_1' ] }
        ])
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

      const taskUrlResponse = { status: 404, data: { retryAfter: 5 * 60 } }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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

    it('errored & skip', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_1' ] }
        ])
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

      const taskUrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        scheduled: new Date(execution.tasks[0].ended.getTime() + 60 * 1000),
        count: 1,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

    });

  });

  describe('should error workflow with circular dependency', () => {

    it('two circular', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [ 'task_2' ] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_1' ] }
        ])
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

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(1);
      expect(cloudTasksService.createTask).not.toHaveBeenCalled();

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: null,
        count: 1,
        state: 'error',
        updated: expect.any(Date)
      })]);

    });

    it('three circular', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [ 'task_2' ] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_3' ] },
          { name: 'task_3', url: 'http://example.com', needs: [ 'task_1' ] }
        ])
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

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(1);
      expect(cloudTasksService.createTask).not.toHaveBeenCalled();

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: null,
        count: 1,
        state: 'error',
        updated: expect.any(Date)
      })]);

    });

    it('one + three circular', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task_1', url: 'http://example.com', needs: [] },
          { name: 'task_2', url: 'http://example.com', needs: [ 'task_1', 'task_4' ] },
          { name: 'task_3', url: 'http://example.com', needs: [ 'task_2' ] },
          { name: 'task_4', url: 'http://example.com', needs: [ 'task_3' ] }
        ])
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

      const taskUrlResponse = { status: 200, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 0;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

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
        state: 'error',
        updated: expect.any(Date)
      })]);

    });

  });

  describe('should retry errored task', () => {

    it('one + one errored', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task', url: 'http://example.com' }
        ])
      };

      const timestamp = new Date().getTime() - (1 + 60) * 1000;
      const execution = {
        versionId: 'vId',
        params: {},
        scheduled: new Date(timestamp),
        count: 1,
        tasks: [
          { name: 'task', scheduled: new Date(timestamp), started: new Date(timestamp), ended: new Date(timestamp + 1000), response: { status: 503, data: {} } }
        ],
        state: 'waiting',
        created: new Date(),
        updated: new Date()
      };

      const taskUrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 1;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(3);
      expect(cloudTasksService.createTask).toHaveBeenCalledTimes(1);

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, expect.objectContaining({
        state: 'running',
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[1]).toEqual([ workflowId, executionId, expect.objectContaining({
        tasks: [
          { name: 'task', scheduled: new Date(timestamp), started: new Date(timestamp), ended: new Date(timestamp + 1000), response: { status: 503, data: {} } },
          { name: 'task', scheduled: expect.any(Date),    started: expect.any(Date),    ended: expect.any(Date),           response: { status: 503, data: {} } }
        ],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[1].ended.getTime() + 2 * 60 * 1000),
        count: 2,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

      expect(cloudTasksService.createTask).toHaveBeenCalledWith(workflowId, executionId, new Date(execution.tasks[1].ended.getTime() + 2 * 60 * 1000), 2);

    });

    it('two + one errored', async () => {

      const version = {
        params: JSON.stringify({}),
        tasks: JSON.stringify([
          { name: 'task', url: 'http://example.com' }
        ])
      };

      const timestamp = new Date().getTime() - (2 * 1 + 3 * 60) * 1000;
      const execution = {
        versionId: 'vId',
        params: {},
        scheduled: new Date(timestamp),
        count: 1,
        tasks: [
          { name: 'task', scheduled: new Date(timestamp),         started: new Date(timestamp),         ended: new Date(timestamp +  1000), response: { status: 503, data: {} } },
          { name: 'task', scheduled: new Date(timestamp + 61000), started: new Date(timestamp + 61000), ended: new Date(timestamp + 62000), response: { status: 503, data: {} } }
        ],
        state: 'waiting',
        created: new Date(),
        updated: new Date()
      };

      const taskUrlResponse = { status: 503, data: {} }

      versionDao.get.mockResolvedValue(version);
      executionDao.get.mockResolvedValue(execution);
      utils.doHttpGet.mockResolvedValue(taskUrlResponse);

      const workflowId = 'wId';
      const executionId = 'eId';
      const runCount = 1;

      await workflowsService.executeWorkflow(workflowId, executionId, runCount);

      expect(executionDao.get).toHaveBeenCalledTimes(1);
      expect(versionDao.get).toHaveBeenCalledTimes(1);
      expect(executionDao.update).toHaveBeenCalledTimes(3);
      expect(cloudTasksService.createTask).toHaveBeenCalledTimes(1);

      expect(executionDao.get).toHaveBeenCalledWith(workflowId, executionId);

      expect(versionDao.get).toHaveBeenCalledWith(workflowId, execution.versionId);

      expect(executionDao.update.mock.calls[0]).toEqual([ workflowId, executionId, expect.objectContaining({
        state: 'running',
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[1]).toEqual([ workflowId, executionId, expect.objectContaining({
        tasks: [
          { name: 'task', scheduled: new Date(timestamp),         started: new Date(timestamp),         ended: new Date(timestamp +  1000), response: { status: 503, data: {} } },
          { name: 'task', scheduled: new Date(timestamp + 61000), started: new Date(timestamp + 61000), ended: new Date(timestamp + 62000), response: { status: 503, data: {} } },
          { name: 'task', scheduled: expect.any(Date),            started: expect.any(Date),            ended: expect.any(Date),            response: { status: 503, data: {} } }
        ],
        updated: expect.any(Date)
      })]);

      expect(executionDao.update.mock.calls[2]).toEqual([ workflowId, executionId, expect.objectContaining({
        scheduled: new Date(execution.tasks[2].ended.getTime() + 3 * 60 * 1000),
        count: 2,
        state: 'waiting',
        updated: expect.any(Date)
      })]);

      expect(cloudTasksService.createTask).toHaveBeenCalledWith(workflowId, executionId, new Date(execution.tasks[2].ended.getTime() + 3 * 60 * 1000), 2);

    });

  });

});
