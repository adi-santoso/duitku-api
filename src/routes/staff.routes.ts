import { Router, Response } from 'express';
import { createStaff, getStaffList, removeStaff } from '../services/staff.service';
import { authenticate, ownerOnly } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createStaffSchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// All staff routes require authentication + owner role
router.use(authenticate, ownerOnly);

/**
 * GET /api/staff
 * Get all staff for current owner
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const staff = await getStaffList(req.user!.ownerId);
    sendSuccess(res, staff);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat staff';
    sendError(res, message);
  }
});

/**
 * POST /api/staff
 * Create a new staff account
 */
router.post('/', validateBody(createStaffSchema), async (req: AuthRequest, res: Response) => {
  try {
    const staff = await createStaff({
      email: req.body.email,
      password: req.body.password,
      displayName: req.body.displayName,
      ownerId: req.user!.ownerId,
    });
    sendSuccess(res, staff, 'Staff berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat staff';
    sendError(res, message);
  }
});

/**
 * DELETE /api/staff/:id
 * Remove a staff account
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await removeStaff(req.params.id as string, req.user!.ownerId);
    sendSuccess(res, null, 'Staff berhasil dihapus');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus staff';
    sendError(res, message);
  }
});

export default router;
