import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { getUserBaseline, calculateProgress } from '../services/baselineService.js';

export const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get progress metrics
    const metrics = await prisma.progressMetrics.findUnique({
      where: { userId },
    });

    // Get baseline and progress
    const baseline = await getUserBaseline(userId);
    const progress = await calculateProgress(userId);

    // Get recent check-ins (last 30 days for mood trend)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCheckIns = await prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { date: 'asc' },
      include: {
        taskCompletions: true,
      },
    });

    // Calculate mood trend (using energy as proxy, last 30 days)
    const moodTrend = recentCheckIns.map((checkIn) => checkIn.energy);

    // Get last 5 check-ins for recent activity
    const lastCheckIns = await prisma.dailyCheckIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        taskCompletions: {
          include: {
            task: true,
          },
        },
      },
    });

    res.json({
      winsStacked: metrics?.winsStacked || 0,
      consistencyRate: metrics?.consistencyRate || 0,
      baselineStreak: metrics?.baselineStreak || 0,
      recoveryStrength: metrics?.recoveryStrength || 0,
      lastUpdated: metrics?.lastUpdated || new Date(),
      moodTrend,
      recentCheckIns: lastCheckIns,
      baseline: baseline || null,
      progress: progress || null,
    });
  } catch (error) {
    logger.error('Get dashboard error', {
      module: 'progressController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getMetrics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const metrics = await prisma.progressMetrics.findUnique({
      where: { userId },
    });

    if (!metrics) {
      return res.json({
        winsStacked: 0,
        consistencyRate: 0,
        baselineStreak: 0,
        recoveryStrength: 0,
        lastUpdated: new Date(),
      });
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Get metrics error', {
      module: 'progressController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
