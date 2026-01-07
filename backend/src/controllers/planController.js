import { generatePlan, getCurrentPlan } from '../services/planService.js';
import { logger } from '../utils/logger.js';
import { needsReassessment } from '../services/baselineService.js';

export const createPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if assessment exists
    const assessment = await prisma.assessment.findUnique({
      where: { userId },
    });

    if (!assessment) {
      return res.status(400).json({
        error: 'Please complete your assessment before generating a plan.',
      });
    }

    logger.info('Generating plan', { module: 'planController', userId });

    const plan = await generatePlan(userId);

    res.status(201).json(plan);
  } catch (error) {
    logger.error('Plan generation error', {
      module: 'planController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const plan = await getCurrentPlan(userId);

    if (!plan) {
      return res.status(404).json({
        error: 'No active plan found. Please generate a plan first.',
      });
    }

    // Check if reassessment is needed
    const needsReassess = await needsReassessment(userId, 30);

    res.json({
      ...plan,
      needsReassessment: needsReassess,
    });
  } catch (error) {
    logger.error('Get plan error', {
      module: 'planController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

// Import prisma for assessment check
import prisma from '../utils/prisma.js';
