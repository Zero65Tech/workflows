import { WorkflowsService } from '../services/WorkflowsService';
import { WorkflowRepository } from '../repositories/WorkflowRepository';

jest.mock('../repositories/WorkflowRepository');

describe('WorkflowsService', () => {
  let workflowsService: WorkflowsService;
  let mockWorkflowRepository: jest.Mocked<WorkflowRepository>;

  beforeEach(() => {
    mockWorkflowRepository = new WorkflowRepository() as jest.Mocked<WorkflowRepository>;
    workflowsService = new WorkflowsService(mockWorkflowRepository);
  });

  describe('createWorkflow', () => {
    it('should create a new workflow successfully', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'Test Description',
        steps: []
      };

      mockWorkflowRepository.create.mockResolvedValue({
        id: '1',
        ...workflowData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await workflowsService.createWorkflow(workflowData);

      expect(mockWorkflowRepository.create).toHaveBeenCalledWith(workflowData);
      expect(result).toHaveProperty('id');
      expect(result.name).toBe(workflowData.name);
    });

    it('should throw an error if workflow creation fails', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'Test Description',
        steps: []
      };

      mockWorkflowRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(workflowsService.createWorkflow(workflowData))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow by id', async () => {
      const mockWorkflow = {
        id: '1',
        name: 'Test Workflow',
        description: 'Test Description',
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockWorkflowRepository.findById.mockResolvedValue(mockWorkflow);

      const result = await workflowsService.getWorkflow('1');

      expect(mockWorkflowRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockWorkflow);
    });

    it('should return null if workflow not found', async () => {
      mockWorkflowRepository.findById.mockResolvedValue(null);

      const result = await workflowsService.getWorkflow('1');

      expect(mockWorkflowRepository.findById).toHaveBeenCalledWith('1');
      expect(result).toBeNull();
    });
  });

  describe('updateWorkflow', () => {
    it('should update workflow successfully', async () => {
      const updateData = {
        name: 'Updated Workflow',
        description: 'Updated Description'
      };

      const mockUpdatedWorkflow = {
        id: '1',
        ...updateData,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockWorkflowRepository.update.mockResolvedValue(mockUpdatedWorkflow);

      const result = await workflowsService.updateWorkflow('1', updateData);

      expect(mockWorkflowRepository.update).toHaveBeenCalledWith('1', updateData);
      expect(result).toEqual(mockUpdatedWorkflow);
    });

    it('should throw error if workflow update fails', async () => {
      mockWorkflowRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(workflowsService.updateWorkflow('1', { name: 'Updated' }))
        .rejects
        .toThrow('Update failed');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow successfully', async () => {
      mockWorkflowRepository.delete.mockResolvedValue(true);

      const result = await workflowsService.deleteWorkflow('1');

      expect(mockWorkflowRepository.delete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });

    it('should return false if workflow not found for deletion', async () => {
      mockWorkflowRepository.delete.mockResolvedValue(false);

      const result = await workflowsService.deleteWorkflow('1');

      expect(mockWorkflowRepository.delete).toHaveBeenCalledWith('1');
      expect(result).toBe(false);
    });
  });
});