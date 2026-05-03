import { Router, Response } from 'express';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
} from '../services/transaction.service';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createTransactionSchema, updateTransactionSchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

/**
 * GET /api/transactions
 * Get transactions with optional filters
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await getTransactions(req.user!.ownerId, req.query as Record<string, string>);
    sendSuccess(res, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat transaksi';
    sendError(res, message);
  }
});

/**
 * GET /api/transactions/summary
 * Get income/expense summary
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const summary = await getTransactionSummary(req.user!.ownerId, startDate, endDate);
    sendSuccess(res, summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat summary';
    sendError(res, message);
  }
});

/**
 * POST /api/transactions
 * Create a new transaction
 */
router.post('/', validateBody(createTransactionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const transaction = await createTransaction({
      userId: req.user!.ownerId,
      categoryId: req.body.categoryId,
      type: req.body.type,
      amount: req.body.amount,
      description: req.body.description,
      receiptImage: req.body.receiptImage,
      transactionDate: req.body.transactionDate,
      isRecurring: req.body.isRecurring,
      recurringFrequency: req.body.recurringFrequency,
    });
    sendSuccess(res, transaction, 'Transaksi berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat transaksi';
    sendError(res, message);
  }
});

/**
 * PUT /api/transactions/:id
 * Update a transaction
 */
router.put('/:id', validateBody(updateTransactionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const transaction = await updateTransaction(
      parseInt(req.params.id as string, 10),
      req.user!.ownerId,
      req.body
    );
    sendSuccess(res, transaction, 'Transaksi berhasil diupdate');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengupdate transaksi';
    sendError(res, message);
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await deleteTransaction(parseInt(req.params.id as string, 10), req.user!.ownerId);
    sendSuccess(res, null, 'Transaksi berhasil dihapus');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus transaksi';
    sendError(res, message);
  }
});

export default router;
