import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { calculateBaseline, needsReassessment } from '../services/baselineService.js';

export const submitAssessment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      stressLevel,
      anxietyLevel,
      moodStability,
      sleepQuality,
      sleepHours,
      weekdayMinutes,
      weekendMinutes,
      goals,
      values,
      currentStruggles,
      preferredTone,
    } = req.body;

    // Validation
    if (
      stressLevel === undefined ||
      anxietyLevel === undefined ||
      moodStability === undefined ||
      sleepQuality === undefined ||
      sleepHours === undefined ||
      weekdayMinutes === undefined ||
      weekendMinutes === undefined ||
      !goals ||
      !Array.isArray(goals) ||
      goals.length === 0 ||
      !preferredTone
    ) {
      return res.status(400).json({
        error: 'Missing required fields. All assessment fields are required.',
      });
    }

    // Validate ranges
    if (
      stressLevel < 1 || stressLevel > 10 ||
      anxietyLevel < 1 || anxietyLevel > 10 ||
      moodStability < 1 || moodStability > 10 ||
      sleepQuality < 1 || sleepQuality > 10
    ) {
      return res.status(400).json({
        error: 'Stress, anxiety, mood stability, and sleep quality must be between 1 and 10',
      });
    }

    if (sleepHours < 4 || sleepHours > 12) {
      return res.status(400).json({
        error: 'Sleep hours must be between 4 and 12',
      });
    }

    if (weekdayMinutes < 5 || weekdayMinutes > 180 || weekendMinutes < 5 || weekendMinutes > 180) {
      return res.status(400).json({
        error: 'Time availability must be between 5 and 180 minutes',
      });
    }

    if (!['steady', 'firm', 'gentle'].includes(preferredTone)) {
      return res.status(400).json({
        error: 'Preferred tone must be one of: steady, firm, gentle',
      });
    }

    // Check if this is the first assessment (baseline)
    const isFirstAssessment = !(await prisma.assessment.findUnique({
      where: { userId },
    }));

    // Check if assessment already exists
    const existingAssessment = await prisma.assessment.findUnique({
      where: { userId },
    });

    let assessment;

    if (existingAssessment) {
      // Update existing assessment
      assessment = await prisma.assessment.update({
        where: { userId },
        data: {
          stressLevel,
          anxietyLevel,
          moodStability,
          sleepQuality,
          sleepHours,
          weekdayMinutes,
          weekendMinutes,
          goals,
          values: values || [],
          currentStruggles: currentStruggles || [],
          preferredTone,
          completedAt: new Date(),
        },
      });
    } else {
      // Create new assessment (this becomes the baseline)
      assessment = await prisma.assessment.create({
        data: {
          userId,
          stressLevel,
          anxietyLevel,
          moodStability,
          sleepQuality,
          sleepHours,
          weekdayMinutes,
          weekendMinutes,
          goals,
          values: values || [],
          currentStruggles: currentStruggles || [],
          preferredTone,
        },
      });
    }

    // Calculate baseline
    const baseline = calculateBaseline(assessment);

    logger.info('Assessment submitted', {
      module: 'assessment',
      userId,
      assessmentId: assessment.id,
      isBaseline: isFirstAssessment,
      baseline: {
        stress: baseline.mentalHealth.stress,
        anxiety: baseline.mentalHealth.anxiety,
        moodStability: baseline.mentalHealth.moodStability,
      },
    });

    res.status(200).json({
      ...assessment,
      baseline, // Include baseline in response
      isBaseline: isFirstAssessment,
    });
  } catch (error) {
    logger.error('Assessment submission error', {
      module: 'assessment',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getAssessment = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const assessment = await prisma.assessment.findUnique({
      where: { userId },
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Include baseline in response
    const baseline = calculateBaseline(assessment);

    res.json({
      ...assessment,
      baseline,
    });
  } catch (error) {
    logger.error('Get assessment error', {
      module: 'assessment',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const checkReassessment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const daysThreshold = parseInt(req.query.days) || 30; // Default 30 days

    const needsReassess = await needsReassessment(userId, daysThreshold);

    res.json({
      needsReassessment: needsReassess,
      threshold: daysThreshold,
    });
  } catch (error) {
    logger.error('Check reassessment error', {
      module: 'assessment',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
