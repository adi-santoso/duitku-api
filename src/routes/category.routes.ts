import { Router, Response } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/category.service';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All category routes require authentication
router.use(authenticate);

/**
 * GET /api/categories
 * Get all categories (default + custom)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await getCategories(req.user!.ownerId);
    sendSuccess(res, categories);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
    sendError(res, message);
  }
});

/**
 * POST /api/categories
 * Create a custom category
 */
router.post('/', validateBody(createCategorySchema), async (req: AuthRequest, res: Response) => {
  try {
    const category = await createCategory({
      ...req.body,
      userId: req.user!.ownerId,
    });
    sendSuccess(res, category, 'Kategori berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat kategori';
    sendError(res, message);
  }
});

/**
 * PUT /api/categories/:id
 * Update a custom category
 */
router.put('/:id', validateBody(updateCategorySchema), async (req: AuthRequest, res: Response) => {
  try {
    const category = await updateCategory(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId,
      req.body
    );
    sendSuccess(res, category, 'Kategori berhasil diupdate');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengupdate kategori';
    sendError(res, message);
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a custom category
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteCategory(parseInt(req.params.id as string, 10), req.user!.ownerId);
    sendSuccess(res, null, 'Kategori berhasil dihapus');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus kategori';
    sendError(res, message);
  }
});

export default router;
