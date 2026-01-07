import { sendCoachMessage, getChatHistory } from '../services/coachService.js';
import { logger } from '../utils/logger.js';

export const chat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required',
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        error: 'Message must be 1000 characters or less',
      });
    }

    logger.info('Coach chat request', {
      module: 'coachController',
      userId,
      messageLength: message.length,
    });

    const result = await sendCoachMessage(userId, message.trim());

    res.json({
      id: `chat-${Date.now()}`,
      message: result.message,
      response: result.response,
      role: 'assistant',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Coach chat error', {
      module: 'coachController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const history = await getChatHistory(userId, limit);

    res.json(history);
  } catch (error) {
    logger.error('Get coach history error', {
      module: 'coachController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
