import { Router } from 'express';
import authRoutes from './auth.routes';
import staffRoutes from './staff.routes';
import transactionRoutes from './transaction.routes';
import categoryRoutes from './category.routes';
import budgetRoutes from './budget.routes';
import savingsGoalRoutes from './savings-goal.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/staff', staffRoutes);
router.use('/transactions', transactionRoutes);
router.use('/categories', categoryRoutes);
router.use('/budgets', budgetRoutes);
router.use('/savings-goals', savingsGoalRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
