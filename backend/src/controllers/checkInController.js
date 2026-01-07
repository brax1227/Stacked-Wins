import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { updateProgressMetrics } from '../services/taskService.js';

export const submitCheckIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { energy, stress, sleepQuality, reflection } = req.body;

    // Validation
    if (energy === undefined || stress === undefined) {
      return res.status(400).json({
        error: 'Energy and stress levels are required',
      });
    }

    if (energy < 1 || energy > 10 || stress < 1 || stress > 10) {
      return res.status(400).json({
        error: 'Energy and stress must be between 1 and 10',
      });
    }

    if (sleepQuality !== undefined && (sleepQuality < 1 || sleepQuality > 10)) {
      return res.status(400).json({
        error: 'Sleep quality must be between 1 and 10',
      });
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create or update check-in
    const checkIn = await prisma.dailyCheckIn.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        energy,
        stress,
        sleepQuality: sleepQuality || null,
        reflection: reflection || null,
      },
      create: {
        userId,
        date: today,
        energy,
        stress,
        sleepQuality: sleepQuality || null,
        reflection: reflection || null,
      },
    });

    // Update progress metrics
    await updateProgressMetrics(userId);

    logger.info('Check-in submitted', {
      module: 'checkInController',
      userId,
      checkInId: checkIn.id,
      energy,
      stress,
    });

    res.status(200).json(checkIn);
  } catch (error) {
    logger.error('Check-in submission error', {
      module: 'checkInController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getCheckInHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;

    const checkIns = await prisma.dailyCheckIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        taskCompletions: {
          include: {
            task: true,
          },
        },
      },
    });

    res.json(checkIns);
  } catch (error) {
    logger.error('Get check-in history error', {
      module: 'checkInController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
