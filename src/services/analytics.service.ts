import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../config/database';
import { budgets, categories, transactions } from '../db/schema';

/**
 * Calculate budget tier based on spending percentage
 */
function calculateBudgetTier(spent: number, budgetAmount: number) {
  const ratio = spent / budgetAmount;

  if (ratio >= 1.25) return 'CRITICAL';
  if (ratio >= 1.0) return 'EXCEEDED';
  if (ratio >= 0.9) return 'WARNING';
  if (ratio >= 0.75) return 'CAUTION';
  return 'SAFE';
}

/**
 * Get budget tier configuration
 */
function getBudgetTierConfig(tier: string) {
  const configs: Record<string, { color: string; icon: string; message: string }> = {
    SAFE: { color: '#10B981', icon: '✅', message: 'Aman' },
    CAUTION: { color: '#F59E0B', icon: '⚠️', message: 'Perhatian' },
    WARNING: { color: '#F97316', icon: '🚨', message: 'Hampir Habis' },
    EXCEEDED: { color: '#EF4444', icon: '🔴', message: 'Melebihi Budget' },
    CRITICAL: { color: '#DC2626', icon: '⛔', message: 'Kritis' },
  };
  return configs[tier] || configs.SAFE;
}

/**
 * Check budget alerts with tier system
 */
export async function checkBudgetAlerts(ownerId: string, year: number, month: number) {
  const db = getDb();

  // Get month start and end dates
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Get budgets with spending
  const budgetAlerts = await db
    .select({
      budgetId: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      budgetAmount: budgets.amount,
      spent: sql<string>`COALESCE(
        (SELECT SUM(amount) FROM ${transactions}
         WHERE user_id = ${ownerId}
         AND category_id = ${budgets.categoryId}
         AND type = 'expense'
         AND transaction_date >= ${monthStart}
         AND transaction_date < ${monthEnd}
        ), 0
      )`,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, ownerId));

  // Calculate days left in month
  const now = new Date();
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const currentDay = now.getDate();
  const daysLeft = now.getMonth() + 1 === month ? lastDayOfMonth - currentDay : lastDayOfMonth;

  // Calculate tiers and metrics
  return budgetAlerts.map((alert) => {
    const spentNum = Number(alert.spent);
    const budgetNum = Number(alert.budgetAmount);
    const ratio = budgetNum > 0 ? spentNum / budgetNum : 0;
    const tier = calculateBudgetTier(spentNum, budgetNum);
    const tierConfig = getBudgetTierConfig(tier);
    const remaining = Math.max(0, budgetNum - spentNum);
    const dailyAllowance = daysLeft > 0 ? remaining / daysLeft : 0;

    return {
      budgetId: alert.budgetId,
      categoryId: alert.categoryId,
      categoryName: alert.categoryName || 'Unknown',
      categoryIcon: alert.categoryIcon || '📊',
      categoryColor: alert.categoryColor || '#6B7280',
      budgetAmount: budgetNum,
      spent: spentNum,
      remaining,
      ratio,
      percentage: (ratio * 100).toFixed(1),
      tier,
      tierColor: tierConfig.color,
      tierIcon: tierConfig.icon,
      tierMessage: tierConfig.message,
      daysLeft,
      dailyAllowance,
    };
  });
}

/**
 * Calculate spending velocity for current month
 */
export async function getSpendingVelocity(ownerId: string) {
  const db = getDb();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Current month dates
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, month, 1).toISOString().split('T')[0];

  // Days passed in current month
  const daysPassed = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeft = daysInMonth - daysPassed;

  // Get current month expenses
  const [currentResult] = await db
    .select({
      totalExpense: sql<string>`COALESCE(SUM(amount), 0)`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        eq(transactions.type, 'expense'),
        gte(transactions.transactionDate, monthStart),
        lte(transactions.transactionDate, monthEnd),
      ),
    );

  const currentSpent = Number(currentResult?.totalExpense ?? 0);
  const transactionCount = currentResult?.transactionCount ?? 0;
  const dailyRate = daysPassed > 0 ? currentSpent / daysPassed : 0;
  const projectedTotal = dailyRate * daysInMonth;

  // Get historical average (last 6 months)
  const sixMonthsAgo = new Date(year, month - 7, 1).toISOString().split('T')[0];

  const [historicalResult] = await db
    .select({
      avgMonthlyExpense: sql<string>`COALESCE(AVG(monthly_total), 0)`,
    })
    .from(
      db
        .select({
          monthly_total: sql<string>`SUM(amount)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ownerId),
            eq(transactions.type, 'expense'),
            gte(transactions.transactionDate, sixMonthsAgo),
            lte(transactions.transactionDate, monthStart),
          ),
        )
        .groupBy(sql`DATE_TRUNC('month', transaction_date)`)
        .as('monthly_expenses'),
    );

  const historicalAvg = Number(historicalResult?.avgMonthlyExpense ?? 0);
  const percentageVsHistorical =
    historicalAvg > 0 ? ((projectedTotal - historicalAvg) / historicalAvg) * 100 : 0;

  const velocity = percentageVsHistorical > 20 ? 'fast' : percentageVsHistorical < -20 ? 'slow' : 'normal';

  return {
    dailyRate,
    currentSpent,
    projectedTotal,
    daysLeft,
    daysPassed,
    daysInMonth,
    transactionCount,
    historicalAvg,
    percentageVsHistorical,
    velocity,
    isOverpacing: percentageVsHistorical > 20,
  };
}

/**
 * Get savings rate history (last N months)
 */
export async function getSavingsRateHistory(ownerId: string, months: number = 12) {
  const db = getDb();
  const history = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [result] = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          gte(transactions.transactionDate, monthStart),
          lte(transactions.transactionDate, monthEnd),
        ),
      );

    const income = Number(result?.totalIncome ?? 0);
    const expense = Number(result?.totalExpense ?? 0);
    const saved = income - expense;
    const savingsRate = income > 0 ? (saved / income) * 100 : 0;

    history.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      label: date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      income,
      expense,
      saved,
      savingsRate: Number(savingsRate.toFixed(2)),
    });
  }

  // Calculate average savings rate
  const avgSavingsRate =
    history.reduce((sum, h) => sum + h.savingsRate, 0) / (history.length || 1);

  return {
    history,
    avgSavingsRate: Number(avgSavingsRate.toFixed(2)),
    targetRate: 20, // Default target: 20% savings rate
  };
}

/**
 * Get income vs expense trend with customizable granularity
 */
export async function getTrend(
  ownerId: string,
  startDate: string,
  endDate: string,
  granularity: 'day' | 'week' | 'month' | 'year' = 'month',
) {
  const db = getDb();

  const truncateMapping = {
    day: 'day',
    week: 'week',
    month: 'month',
    year: 'year',
  };

  const periods = await db
    .select({
      period: sql<string>`TO_CHAR(DATE_TRUNC('${sql.raw(truncateMapping[granularity])}', transaction_date), 'YYYY-MM-DD')`,
      income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      transactionCount: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        gte(transactions.transactionDate, startDate),
        lte(transactions.transactionDate, endDate),
      ),
    )
    .groupBy(sql`DATE_TRUNC('${sql.raw(truncateMapping[granularity])}', transaction_date)`)
    .orderBy(sql`DATE_TRUNC('${sql.raw(truncateMapping[granularity])}', transaction_date)`);

  // Calculate trend (simple linear regression slope)
  const n = periods.length;
  if (n < 2) {
    return {
      periods: periods.map((p) => ({
        period: p.period,
        income: Number(p.income),
        expense: Number(p.expense),
        balance: Number(p.income) - Number(p.expense),
        transactionCount: p.transactionCount,
      })),
      summary: {
        totalIncome: 0,
        totalExpense: 0,
        avgIncome: 0,
        avgExpense: 0,
        trend: 'stable',
        trendPercentage: 0,
      },
    };
  }

  const expenses = periods.map((p) => Number(p.expense));
  const sumX = periods.reduce((sum, _, i) => sum + i, 0);
  const sumY = expenses.reduce((sum, exp) => sum + exp, 0);
  const sumXY = expenses.reduce((sum, exp, i) => sum + i * exp, 0);
  const sumX2 = periods.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgExpense = sumY / n;
  const trendPercentage = avgExpense > 0 ? (slope / avgExpense) * 100 : 0;

  const totalIncome = periods.reduce((sum, p) => sum + Number(p.income), 0);
  const totalExpense = periods.reduce((sum, p) => sum + Number(p.expense), 0);

  return {
    periods: periods.map((p) => ({
      period: p.period,
      income: Number(p.income),
      expense: Number(p.expense),
      balance: Number(p.income) - Number(p.expense),
      transactionCount: p.transactionCount,
    })),
    summary: {
      totalIncome,
      totalExpense,
      avgIncome: totalIncome / n,
      avgExpense: totalExpense / n,
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      trendPercentage: Number(trendPercentage.toFixed(2)),
    },
  };
}

/**
 * Get category insights with anomaly detection
 */
export async function getCategoryInsights(
  ownerId: string,
  categoryId: number,
  months: number = 6,
) {
  const db = getDb();
  const now = new Date();

  // Get historical data for the category (last N months)
  const history = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [result] = await db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
        transactionCount: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          eq(transactions.categoryId, categoryId),
          eq(transactions.type, 'expense'),
          gte(transactions.transactionDate, monthStart),
          lte(transactions.transactionDate, monthEnd),
        ),
      );

    history.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      amount: Number(result?.totalAmount ?? 0),
      transactionCount: result?.transactionCount ?? 0,
    });
  }

  // Current month data
  const currentMonth = history[history.length - 1];
  const prevMonth = history[history.length - 2];
  const threeMonthAvg =
    history
      .slice(-4, -1)
      .reduce((sum, h) => sum + h.amount, 0) / 3;

  // Anomaly detection (Z-score)
  const amounts = history.map((h) => h.amount);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev > 0 ? (currentMonth.amount - mean) / stdDev : 0;

  const isAnomaly = Math.abs(zScore) > 2;
  const anomalySeverity = Math.abs(zScore) > 3 ? 'high' : 'medium';
  const anomalyDirection = zScore > 0 ? 'spike' : 'drop';

  // Get category details
  const [categoryData] = await db
    .select({
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
    })
    .from(categories)
    .where(eq(categories.id, categoryId));

  // Detect consecutive increases
  let consecutiveIncreases = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].amount > history[i - 1].amount) {
      consecutiveIncreases++;
    } else {
      break;
    }
  }

  // Get transaction details for pattern analysis
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const monthStart = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`;
  const nextMonth = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
  const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const currentTransactions = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, 'expense'),
        gte(transactions.transactionDate, monthStart),
        lte(transactions.transactionDate, monthEnd),
      ),
    )
    .orderBy(desc(transactions.amount));

  // Extract merchants from descriptions
  const merchantCounts: Record<string, { count: number; total: number }> = {};
  currentTransactions.forEach((t) => {
    if (t.description) {
      const merchant = t.description.trim();
      if (!merchantCounts[merchant]) {
        merchantCounts[merchant] = { count: 0, total: 0 };
      }
      merchantCounts[merchant].count++;
      merchantCounts[merchant].total += Number(t.amount);
    }
  });

  const topMerchants = Object.entries(merchantCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Peak day analysis
  const dayOfWeekSpending: Record<string, number[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [],
  };

  currentTransactions.forEach((t) => {
    const dayOfWeek = new Date(t.transactionDate).getDay();
    dayOfWeekSpending[dayOfWeek].push(Number(t.amount));
  });

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayAverages = Object.entries(dayOfWeekSpending).map(([day, amounts]) => ({
    day: dayNames[parseInt(day)],
    avg: amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0,
    count: amounts.length,
  }));

  const peakDay = dayAverages.reduce((max, d) => (d.avg > max.avg ? d : max), dayAverages[0]);

  // Generate recommendations
  const recommendations = [];

  if (isAnomaly && anomalyDirection === 'spike') {
    const potentialSavings = currentMonth.amount - threeMonthAvg;
    recommendations.push({
      priority: 'high',
      action: `Kurangi pengeluaran ${categoryData?.name || 'kategori ini'}`,
      impact: `Potensi hemat Rp ${potentialSavings.toLocaleString('id-ID')}/bulan`,
      tips: [
        'Review pengeluaran yang tidak perlu',
        'Set budget lebih ketat untuk bulan depan',
      ],
    });
  }

  if (consecutiveIncreases >= 3) {
    recommendations.push({
      priority: 'alert',
      action: 'Tren naik konsisten — evaluasi kebutuhan vs keinginan',
      impact: `Naik ${consecutiveIncreases} bulan berturut-turut`,
      tips: ['Identifikasi pola pembelian impulsif', 'Pertimbangkan alternatif lebih murah'],
    });
  }

  if (topMerchants.length > 0 && topMerchants[0].count > 10) {
    recommendations.push({
      priority: 'medium',
      action: `Frekuensi tinggi di ${topMerchants[0].name}`,
      impact: `${topMerchants[0].count}x transaksi (Rp ${topMerchants[0].total.toLocaleString('id-ID')})`,
      tips: ['Pertimbangkan alternatif lebih ekonomis', 'Batasi frekuensi kunjungan'],
    });
  }

  return {
    categoryId,
    categoryName: categoryData?.name || 'Unknown',
    categoryIcon: categoryData?.icon || '📊',
    categoryColor: categoryData?.color || '#6B7280',
    currentMonth: {
      amount: currentMonth.amount,
      transactionCount: currentMonth.transactionCount,
      avgPerTransaction:
        currentMonth.transactionCount > 0
          ? currentMonth.amount / currentMonth.transactionCount
          : 0,
    },
    comparison: {
      prevMonth: {
        amount: prevMonth?.amount || 0,
        change: prevMonth?.amount > 0 ? ((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 100 : 0,
      },
      threeMonthAvg: {
        amount: threeMonthAvg,
        change: threeMonthAvg > 0 ? ((currentMonth.amount - threeMonthAvg) / threeMonthAvg) * 100 : 0,
      },
    },
    patterns: {
      peakDay: peakDay.day,
      peakDayAvg: peakDay.avg,
      peakDayCount: peakDay.count,
      topMerchants,
    },
    anomaly: {
      detected: isAnomaly,
      severity: isAnomaly ? anomalySeverity : null,
      direction: isAnomaly ? anomalyDirection : null,
      zScore: Number(zScore.toFixed(2)),
      percentageFromMean: mean > 0 ? ((currentMonth.amount - mean) / mean) * 100 : 0,
    },
    trend: {
      consecutiveIncreases,
      isUptrending: consecutiveIncreases >= 2,
    },
    recommendations,
    history,
  };
}

/**
 * Cashflow forecast using moving average + seasonality
 */
export async function getCashflowForecast(ownerId: string, monthsAhead: number = 3) {
  const db = getDb();
  const now = new Date();

  // Get historical data (last 12 months for seasonality detection)
  const history = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [result] = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ownerId),
          gte(transactions.transactionDate, monthStart),
          lte(transactions.transactionDate, monthEnd),
        ),
      );

    history.push({
      month: month - 1,
      date: `${year}-${String(month).padStart(2, '0')}`,
      income: Number(result?.totalIncome ?? 0),
      expense: Number(result?.totalExpense ?? 0),
    });
  }

  // Calculate moving averages (last 6 months)
  const recent = history.slice(-6);
  const avgIncome = recent.reduce((sum, h) => sum + h.income, 0) / 6;
  const avgExpense = recent.reduce((sum, h) => sum + h.expense, 0) / 6;

  // Calculate seasonality factors by month
  const seasonalityFactors: Record<number, number[]> = {};
  history.forEach((h) => {
    if (!seasonalityFactors[h.month]) {
      seasonalityFactors[h.month] = [];
    }
    if (avgExpense > 0) {
      seasonalityFactors[h.month].push(h.expense / avgExpense);
    }
  });

  // Calculate confidence based on variance
  const expenseValues = recent.map((h) => h.expense);
  const mean = expenseValues.reduce((sum, v) => sum + v, 0) / expenseValues.length;
  const variance = expenseValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / expenseValues.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const baseConfidence = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));

  // Generate forecast
  const forecast = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + i);
    const futureMonth = futureDate.getMonth();
    const futureYear = futureDate.getFullYear();

    const seasonalFactors = seasonalityFactors[futureMonth] || [1];
    const avgSeasonalFactor =
      seasonalFactors.reduce((sum, f) => sum + f, 0) / seasonalFactors.length;

    const predictedExpense = avgExpense * avgSeasonalFactor;
    const confidence = Math.max(50, baseConfidence - i * 5); // Decrease confidence for further predictions

    forecast.push({
      date: `${futureYear}-${String(futureMonth + 1).padStart(2, '0')}`,
      label: futureDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      predictedIncome: avgIncome,
      predictedExpense,
      predictedBalance: avgIncome - predictedExpense,
      confidence: Number(confidence.toFixed(1)),
      range: {
        min: predictedExpense * 0.8,
        max: predictedExpense * 1.2,
      },
    });
  }

  // Detect potential shortfalls
  const alerts = forecast
    .filter((f) => f.predictedBalance < 0)
    .map((f) => ({
      month: f.label,
      shortfall: Math.abs(f.predictedBalance),
      message: `Potensi defisit Rp ${Math.abs(f.predictedBalance).toLocaleString('id-ID')}`,
    }));

  return {
    forecast,
    baseData: {
      avgIncome,
      avgExpense,
      avgBalance: avgIncome - avgExpense,
    },
    alerts,
  };
}
