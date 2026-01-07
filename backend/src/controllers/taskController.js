import { getTodayTasks, completeTask, adjustTodayPlan } from '../services/taskService.js';
import { logger } from '../utils/logger.js';

export const getToday = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const tasks = await getTodayTasks(userId);

    res.json(tasks);
  } catch (error) {
    logger.error('Get today tasks error', {
      module: 'taskController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const complete = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    const result = await completeTask(userId, taskId);

    res.json(result);
  } catch (error) {
    logger.error('Complete task error', {
      module: 'taskController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const adjust = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { mode } = req.body;

    if (!mode || !['minimum', 'standard'].includes(mode)) {
      return res.status(400).json({
        error: 'Mode must be "minimum" or "standard"',
      });
    }

    const tasks = await adjustTodayPlan(userId, mode);

    res.json(tasks);
  } catch (error) {
    logger.error('Adjust plan error', {
      module: 'taskController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
