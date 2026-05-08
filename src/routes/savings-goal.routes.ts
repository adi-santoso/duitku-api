import { Router, Response } from 'express';
import {
  getSavingsGoals,
  getSavingsGoalById,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addContribution,
  getContributions,
} from '../services/savings-goal.service';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createSavingsGoalSchema, updateSavingsGoalSchema, addContributionSchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All savings goal routes require authentication
router.use(authenticate);

/**
 * GET /api/savings-goals
 * Get all savings goals
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const goals = await getSavingsGoals(req.user!.ownerId);
    sendSuccess(res, goals);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat target tabungan';
    sendError(res, message);
  }
});

/**
 * GET /api/savings-goals/:id
 * Get a single savings goal with details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const goal = await getSavingsGoalById(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId
    );
    sendSuccess(res, goal);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat target tabungan';
    sendError(res, message);
  }
});

/**
 * POST /api/savings-goals
 * Create a new savings goal
 */
router.post('/', validateBody(createSavingsGoalSchema), async (req: AuthRequest, res: Response) => {
  try {
    const goal = await createSavingsGoal({
      userId: req.user!.ownerId,
      name: req.body.name,
      targetAmount: req.body.targetAmount,
      currentAmount: req.body.currentAmount,
      targetDate: req.body.targetDate,
      icon: req.body.icon,
      color: req.body.color,
    });
    sendSuccess(res, goal, 'Target tabungan berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat target tabungan';
    sendError(res, message);
  }
});

/**
 * PUT /api/savings-goals/:id
 * Update a savings goal
 */
router.put('/:id', validateBody(updateSavingsGoalSchema), async (req: AuthRequest, res: Response) => {
  try {
    const goal = await updateSavingsGoal(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId,
      req.body
    );
    sendSuccess(res, goal, 'Target tabungan berhasil diupdate');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengupdate target tabungan';
    sendError(res, message);
  }
});

/**
 * DELETE /api/savings-goals/:id
 * Delete a savings goal
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteSavingsGoal(parseInt(req.params.id as string, 10), req.user!.ownerId);
    sendSuccess(res, null, 'Target tabungan berhasil dihapus');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus target tabungan';
    sendError(res, message);
  }
});

/**
 * POST /api/savings-goals/:id/contributions
 * Add a contribution to a savings goal
 */
router.post('/:id/contributions', validateBody(addContributionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await addContribution({
      goalId: parseInt(req.params.id as string, 10),
      userId: req.user!.ownerId,
      amount: req.body.amount,
      note: req.body.note,
    });
    sendSuccess(res, result, 'Kontribusi berhasil ditambahkan', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menambah kontribusi';
    sendError(res, message);
  }
});

/**
 * GET /api/savings-goals/:id/contributions
 * Get contribution history for a savings goal
 */
router.get('/:id/contributions', async (req: AuthRequest, res: Response) => {
  try {
    const contributions = await getContributions(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId
    );
    sendSuccess(res, contributions);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat riwayat kontribusi';
    sendError(res, message);
  }
});

export default router;
