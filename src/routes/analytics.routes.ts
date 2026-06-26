import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import * as analyticsService from '../services/analytics.service';

const router = Router();

/**
 * GET /api/analytics/budget-alerts
 * Get budget alerts with tier system
 */
router.get('/budget-alerts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const now = new Date();
    const year = parseInt(req.query.year as string) || now.getFullYear();
    const month = parseInt(req.query.month as string) || now.getMonth() + 1;

    const alerts = await analyticsService.checkBudgetAlerts(ownerId, year, month);

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/spending-velocity
 * Get current month spending velocity
 */
router.get('/spending-velocity', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const velocity = await analyticsService.getSpendingVelocity(ownerId);

    res.json({
      success: true,
      data: velocity,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/savings-rate-history
 * Get savings rate history for last N months
 */
router.get('/savings-rate-history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const months = parseInt(req.query.months as string) || 12;

    const history = await analyticsService.getSavingsRateHistory(ownerId, months);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/trend
 * Get income vs expense trend with customizable granularity
 */
router.get('/trend', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const { startDate, endDate, granularity = 'month' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const validGranularities = ['day', 'week', 'month', 'year'];
    if (!validGranularities.includes(granularity as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid granularity. Must be one of: day, week, month, year',
      });
    }

    const trend = await analyticsService.getTrend(
      ownerId,
      startDate as string,
      endDate as string,
      granularity as 'day' | 'week' | 'month' | 'year',
    );

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/category-insights
 * Get deep insights for a specific category
 */
router.get('/category-insights', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const categoryId = parseInt(req.query.categoryId as string);
    const months = parseInt(req.query.months as string) || 6;

    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid categoryId is required',
      });
    }

    const insights = await analyticsService.getCategoryInsights(ownerId, categoryId, months);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/forecast
 * Get cashflow forecast for next N months
 */
router.get('/forecast', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const monthsAhead = parseInt(req.query.monthsAhead as string) || 3;

    if (monthsAhead < 1 || monthsAhead > 12) {
      return res.status(400).json({
        success: false,
        error: 'monthsAhead must be between 1 and 12',
      });
    }

    const forecast = await analyticsService.getCashflowForecast(ownerId, monthsAhead);

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/recurring-patterns
 * Detect recurring transaction patterns
 */
router.get('/recurring-patterns', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ownerId } = req.user!;
    const minOccurrences = parseInt(req.query.minOccurrences as string) || 3;

    if (minOccurrences < 2 || minOccurrences > 10) {
      return res.status(400).json({
        success: false,
        error: 'minOccurrences must be between 2 and 10',
      });
    }

    const patterns = await analyticsService.detectRecurringPatterns(ownerId, minOccurrences);

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
