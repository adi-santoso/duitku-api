import { Router, Response } from 'express';
import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
} from '../services/budget.service';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createBudgetSchema, updateBudgetSchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All budget routes require authentication
router.use(authenticate);

/**
 * GET /api/budgets
 * Get all budgets
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const budgets = await getBudgets(req.user!.ownerId);
    sendSuccess(res, budgets);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat anggaran';
    sendError(res, message);
  }
});

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post('/', validateBody(createBudgetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const budget = await createBudget({
      userId: req.user!.ownerId,
      categoryId: req.body.categoryId,
      amount: req.body.amount,
      period: req.body.period,
      startDate: req.body.startDate,
    });
    sendSuccess(res, budget, 'Anggaran berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat anggaran';
    sendError(res, message);
  }
});

/**
 * PUT /api/budgets/:id
 * Update a budget
 */
router.put('/:id', validateBody(updateBudgetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const budget = await updateBudget(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId,
      req.body
    );
    sendSuccess(res, budget, 'Anggaran berhasil diupdate');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengupdate anggaran';
    sendError(res, message);
  }
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteBudget(parseInt(req.params.id as string, 10), req.user!.ownerId);
    sendSuccess(res, null, 'Anggaran berhasil dihapus');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
    sendError(res, message);
  }
});

export default router;
