import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate user baseline from assessment
 * Baseline represents the user's starting point across key dimensions
 */
export const calculateBaseline = (assessment) => {
  return {
    mentalHealth: {
      stress: assessment.stressLevel,
      anxiety: assessment.anxietyLevel,
      moodStability: assessment.moodStability,
      average: (assessment.stressLevel + assessment.anxietyLevel + assessment.moodStability) / 3,
    },
    sleep: {
      quality: assessment.sleepQuality,
      hours: assessment.sleepHours,
    },
    timeAvailability: {
      weekday: assessment.weekdayMinutes,
      weekend: assessment.weekendMinutes,
      average: (assessment.weekdayMinutes + assessment.weekendMinutes) / 2,
    },
    goals: assessment.goals,
    values: assessment.values,
    preferredTone: assessment.preferredTone,
    timestamp: new Date(),
  };
};

/**
 * Get or create user baseline
 */
export const getUserBaseline = async (userId) => {
  try {
    // Get the first assessment (original baseline)
    const firstAssessment = await prisma.assessment.findFirst({
      where: { userId },
      orderBy: { completedAt: 'asc' },
    });

    if (!firstAssessment) {
      return null;
    }

    return calculateBaseline(firstAssessment);
  } catch (error) {
    logger.error('Error getting user baseline', {
      module: 'baselineService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Calculate progress since baseline
 * Compares current metrics to original baseline
 */
export const calculateProgress = async (userId) => {
  try {
    const baseline = await getUserBaseline(userId);
    if (!baseline) {
      return null;
    }

    // Get most recent check-ins (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCheckIns = await prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { date: 'desc' },
    });

    if (recentCheckIns.length === 0) {
      return {
        baseline,
        current: null,
        improvement: null,
      };
    }

    // Calculate current averages
    const currentStress = recentCheckIns.reduce((sum, c) => sum + (10 - c.stress), 0) / recentCheckIns.length;
    const currentEnergy = recentCheckIns.reduce((sum, c) => sum + c.energy, 0) / recentCheckIns.length;
    const currentSleep = recentCheckIns
      .filter((c) => c.sleepQuality)
      .reduce((sum, c) => sum + c.sleepQuality, 0) / recentCheckIns.filter((c) => c.sleepQuality).length;

    const current = {
      mentalHealth: {
        stress: 10 - currentStress, // Inverted for comparison
        energy: currentEnergy,
        sleepQuality: currentSleep || baseline.sleep.quality,
      },
    };

    // Calculate improvement percentages
    const improvement = {
      stress: baseline.mentalHealth.stress > 0
        ? ((baseline.mentalHealth.stress - current.mentalHealth.stress) / baseline.mentalHealth.stress) * 100
        : 0,
      energy: baseline.mentalHealth.average > 0
        ? ((current.mentalHealth.energy - baseline.mentalHealth.average) / baseline.mentalHealth.average) * 100
        : 0,
      sleep: baseline.sleep.quality > 0
        ? ((current.mentalHealth.sleepQuality - baseline.sleep.quality) / baseline.sleep.quality) * 100
        : 0,
    };

    return {
      baseline,
      current,
      improvement,
      daysTracked: recentCheckIns.length,
    };
  } catch (error) {
    logger.error('Error calculating progress', {
      module: 'baselineService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Check if user needs reassessment
 * Returns true if it's been X days since last assessment
 */
export const needsReassessment = async (userId, daysThreshold = 30) => {
  try {
    const lastAssessment = await prisma.assessment.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    });

    if (!lastAssessment) {
      return true; // Never assessed
    }

    const daysSince = Math.floor(
      (new Date() - new Date(lastAssessment.completedAt)) / (1000 * 60 * 60 * 24)
    );

    return daysSince >= daysThreshold;
  } catch (error) {
    logger.error('Error checking reassessment need', {
      module: 'baselineService',
      error: error.message,
      userId,
    });
    return false;
  }
};

/**
 * Get baseline summary for AI context
 * Formats baseline data for use in prompts
 */
export const getBaselineSummary = async (userId) => {
  try {
    const baseline = await getUserBaseline(userId);
    const progress = await calculateProgress(userId);

    if (!baseline) {
      return 'No baseline data available.';
    }

    let summary = `User Baseline:\n`;
    summary += `- Mental Health: Stress ${baseline.mentalHealth.stress}/10, Anxiety ${baseline.mentalHealth.anxiety}/10, Mood Stability ${baseline.mentalHealth.moodStability}/10\n`;
    summary += `- Sleep: Quality ${baseline.sleep.quality}/10, Hours ${baseline.sleep.hours}\n`;
    summary += `- Time Available: Weekday ${baseline.timeAvailability.weekday}min, Weekend ${baseline.timeAvailability.weekend}min\n`;
    summary += `- Goals: ${baseline.goals.join(', ')}\n`;
    summary += `- Values: ${baseline.values.join(', ')}\n`;
    summary += `- Preferred Tone: ${baseline.preferredTone}\n`;

    if (progress && progress.improvement) {
      summary += `\nProgress Since Baseline:\n`;
      summary += `- Stress: ${progress.improvement.stress > 0 ? '+' : ''}${progress.improvement.stress.toFixed(1)}% change\n`;
      summary += `- Energy: ${progress.improvement.energy > 0 ? '+' : ''}${progress.improvement.energy.toFixed(1)}% change\n`;
      summary += `- Sleep: ${progress.improvement.sleep > 0 ? '+' : ''}${progress.improvement.sleep.toFixed(1)}% change\n`;
      summary += `- Days Tracked: ${progress.daysTracked}\n`;
    }

    return summary;
  } catch (error) {
    logger.error('Error getting baseline summary', {
      module: 'baselineService',
      error: error.message,
      userId,
    });
    return 'Error retrieving baseline data.';
  }
};
