import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as projectService from '../services/project.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// ============================================
// Validation Schemas
// ============================================

const createProjectSchema = z.object({
  name: z.string().min(1, 'Nama project wajib diisi').max(255),
  description: z.string().optional(),
  totalBudget: z.number().min(0, 'Total budget harus >= 0'),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  totalBudget: z.number().min(0).optional(),
  isCompleted: z.boolean().optional(),
});

const addItemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1, 'Nama item wajib diisi').max(255),
  estimatedPrice: z.number().min(0, 'Estimasi harga harus >= 0'),
  notes: z.string().optional(),
});

const updateItemSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  estimatedPrice: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const markPurchasedSchema = z.object({
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal: YYYY-MM-DD'),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/projects
 * List all projects with summary
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.ownerId;
    const projects = await projectService.getProjects(ownerId);
    sendSuccess(res, projects);
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    sendError(res, 'Gagal mengambil data project');
  }
});

/**
 * GET /api/projects/:id
 * Get project detail with all items
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (isNaN(projectId)) {
      return sendError(res, 'ID project tidak valid', 400);
    }

    const ownerId = req.user!.ownerId;
    const project = await projectService.getProjectById(projectId, ownerId);

    if (!project) {
      return sendError(res, 'Project tidak ditemukan', 404);
    }

    sendSuccess(res, project);
  } catch (error: any) {
    console.error('Error fetching project detail:', error);
    sendError(res, 'Gagal mengambil detail project');
  }
});

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', validateBody(createProjectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.ownerId;
    const project = await projectService.createProject(ownerId, req.body);
    sendSuccess(res, project, 'Project berhasil dibuat', 201);
  } catch (error: any) {
    console.error('Error creating project:', error);
    sendError(res, 'Gagal membuat project');
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', validateBody(updateProjectSchema), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (isNaN(projectId)) {
      return sendError(res, 'ID project tidak valid', 400);
    }

    const ownerId = req.user!.ownerId;
    const updated = await projectService.updateProject(projectId, ownerId, req.body);

    if (!updated) {
      return sendError(res, 'Project tidak ditemukan', 404);
    }

    sendSuccess(res, updated, 'Project berhasil diupdate');
  } catch (error: any) {
    console.error('Error updating project:', error);
    sendError(res, 'Gagal mengupdate project');
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project (cascade delete items & transactions)
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string, 10);
    if (isNaN(projectId)) {
      return sendError(res, 'ID project tidak valid', 400);
    }

    const ownerId = req.user!.ownerId;
    const deleted = await projectService.deleteProject(projectId, ownerId);

    if (!deleted) {
      return sendError(res, 'Project tidak ditemukan', 404);
    }

    sendSuccess(res, null, 'Project berhasil dihapus');
  } catch (error: any) {
    console.error('Error deleting project:', error);
    sendError(res, 'Gagal menghapus project');
  }
});

/**
 * POST /api/projects/:id/items
 * Add item to project
 */
router.post(
  '/:id/items',
  validateBody(addItemSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = parseInt(req.params.id as string, 10);
      if (isNaN(projectId)) {
        return sendError(res, 'ID project tidak valid', 400);
      }

      const ownerId = req.user!.ownerId;
      const item = await projectService.addProjectItem(projectId, ownerId, req.body);
      sendSuccess(res, item, 'Item berhasil ditambahkan', 201);
    } catch (error: any) {
      console.error('Error adding project item:', error);
      sendError(res, error.message || 'Gagal menambahkan item');
    }
  },
);

/**
 * PUT /api/projects/items/:id
 * Update project item
 */
router.put(
  '/items/:id',
  validateBody(updateItemSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      if (isNaN(itemId)) {
        return sendError(res, 'ID item tidak valid', 400);
      }

      const ownerId = req.user!.ownerId;
      const updated = await projectService.updateProjectItem(itemId, ownerId, req.body);
      sendSuccess(res, updated, 'Item berhasil diupdate');
    } catch (error: any) {
      console.error('Error updating project item:', error);
      sendError(res, error.message || 'Gagal mengupdate item');
    }
  },
);

/**
 * DELETE /api/projects/items/:id
 * Delete project item (and linked transaction)
 */
router.delete('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const itemId = parseInt(req.params.id as string, 10);
    if (isNaN(itemId)) {
      return sendError(res, 'ID item tidak valid', 400);
    }

    const ownerId = req.user!.ownerId;
    await projectService.deleteProjectItem(itemId, ownerId);
    sendSuccess(res, null, 'Item berhasil dihapus');
  } catch (error: any) {
    console.error('Error deleting project item:', error);
    sendError(res, error.message || 'Gagal menghapus item');
  }
});

/**
 * POST /api/projects/items/:id/purchase
 * Mark item as purchased (create transaction)
 */
router.post(
  '/items/:id/purchase',
  validateBody(markPurchasedSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id as string, 10);
      if (isNaN(itemId)) {
        return sendError(res, 'ID item tidak valid', 400);
      }

      const ownerId = req.user!.ownerId;
      const { transactionDate } = req.body;

      const result = await projectService.markItemAsPurchased(itemId, ownerId, transactionDate);
      sendSuccess(res, result, 'Item berhasil ditandai sebagai dibeli');
    } catch (error: any) {
      console.error('Error marking item as purchased:', error);
      sendError(res, error.message || 'Gagal menandai item sebagai dibeli');
    }
  },
);

export default router;
