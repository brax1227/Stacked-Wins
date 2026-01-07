import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Get today's tasks for a user
 * Returns tasks with completion status
 */
export const getTodayTasks = async (userId) => {
  try {
    // Get user's active plan
    const plan = await prisma.growthPlan.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!plan) {
      return [];
    }

    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's check-in
    const checkIn = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      include: {
        taskCompletions: {
          include: {
            task: true,
          },
        },
      },
    });

    // Map tasks with completion status
    const tasksWithStatus = plan.tasks.map((task) => {
      const completed = checkIn?.taskCompletions.some(
        (completion) => completion.taskId === task.id
      );

      return {
        ...task,
        completed: completed || false,
      };
    });

    return tasksWithStatus;
  } catch (error) {
    logger.error('Get today tasks error', {
      module: 'taskService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Complete a task
 * Creates check-in if doesn't exist, then marks task as complete
 */
export const completeTask = async (userId, taskId) => {
  try {
    // Verify task exists and belongs to user's plan
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        plan: {
          userId,
          isActive: true,
        },
      },
    });

    if (!task) {
      throw new Error('Task not found or does not belong to your active plan');
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's check-in
    let checkIn = await prisma.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!checkIn) {
      // Create check-in with default values if doesn't exist
      checkIn = await prisma.dailyCheckIn.create({
        data: {
          userId,
          date: today,
          energy: 5, // Default, user can update later
          stress: 5, // Default, user can update later
        },
      });
    }

    // Check if task already completed
    const existingCompletion = await prisma.taskCompletion.findFirst({
      where: {
        taskId,
        checkInId: checkIn.id,
      },
    });

    if (existingCompletion) {
      return { message: 'Task already completed today' };
    }

    // Create task completion
    await prisma.taskCompletion.create({
      data: {
        taskId,
        checkInId: checkIn.id,
      },
    });

    // Update progress metrics
    await updateProgressMetrics(userId);

    logger.info('Task completed', {
      module: 'taskService',
      userId,
      taskId,
      checkInId: checkIn.id,
    });

    return { message: 'Task completed successfully' };
  } catch (error) {
    logger.error('Complete task error', {
      module: 'taskService',
      error: error.message,
      userId,
      taskId,
    });
    throw error;
  }
};

/**
 * Adjust today's plan (minimum vs standard mode)
 */
export const adjustTodayPlan = async (userId, mode) => {
  try {
    const plan = await prisma.growthPlan.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new Error('No active plan found');
    }

    // Get today's tasks with completion status
    const tasks = await getTodayTasks(userId);

    if (mode === 'minimum') {
      // Minimum day: only anchor win + 1-2 smallest tasks
      const anchorWin = tasks.find((t) => t.isAnchorWin);
      const otherTasks = tasks.filter((t) => !t.isAnchorWin && !t.completed);
      const smallestTasks = otherTasks
        .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)
        .slice(0, 2);

      return [anchorWin, ...smallestTasks].filter(Boolean);
    } else {
      // Standard day: all tasks
      return tasks;
    }
  } catch (error) {
    logger.error('Adjust plan error', {
      module: 'taskService',
      error: error.message,
      userId,
      mode,
    });
    throw error;
  }
};

/**
 * Update progress metrics for a user
 * Exported for use in check-in controller
 */
export const updateProgressMetrics = async (userId) => {
  try {
    // Get all task completions
    const completions = await prisma.taskCompletion.findMany({
      where: {
        checkIn: {
          userId,
        },
      },
    });

    const winsStacked = completions.length;

    // Calculate consistency rate (days with at least 1 win)
    const checkInsWithWins = await prisma.dailyCheckIn.findMany({
      where: {
        userId,
        taskCompletions: {
          some: {},
        },
      },
    });

    const totalCheckIns = await prisma.dailyCheckIn.count({
      where: { userId },
    });

    const consistencyRate = totalCheckIns > 0
      ? (checkInsWithWins.length / totalCheckIns) * 100
      : 0;

    // Calculate baseline streak (consecutive days with at least 1 win)
    const allCheckIns = await prisma.dailyCheckIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        taskCompletions: true,
      },
    });

    let streak = 0;
    for (const checkIn of allCheckIns) {
      if (checkIn.taskCompletions.length > 0) {
        streak++;
      } else {
        break;
      }
    }

    // Calculate recovery strength (times user returned after missing days)
    let recoveryStrength = 0;
    let lastHadWins = false;
    for (const checkIn of allCheckIns.reverse()) {
      const hasWins = checkIn.taskCompletions.length > 0;
      if (!lastHadWins && hasWins) {
        recoveryStrength++;
      }
      lastHadWins = hasWins;
    }

    // Update or create progress metrics
    await prisma.progressMetrics.upsert({
      where: { userId },
      update: {
        winsStacked,
        consistencyRate,
        baselineStreak: streak,
        recoveryStrength,
      },
      create: {
        userId,
        winsStacked,
        consistencyRate,
        baselineStreak: streak,
        recoveryStrength,
      },
    });
  } catch (error) {
    logger.error('Update progress metrics error', {
      module: 'taskService',
      error: error.message,
      userId,
    });
    // Don't throw - metrics update shouldn't break task completion
  }
};
