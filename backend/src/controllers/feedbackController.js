import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, title, message, rating } = req.body;

    // Validation
    if (!type || !['bug', 'feature', 'improvement', 'general'].includes(type)) {
      return res.status(400).json({
        error: 'Type must be one of: bug, feature, improvement, general',
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Feedback message is required',
      });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5',
      });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        type,
        title: title || null,
        message: message.trim(),
        rating: rating || null,
        status: 'new',
      },
    });

    logger.info('Feedback submitted', {
      module: 'feedbackController',
      userId,
      feedbackId: feedback.id,
      type,
    });

    res.status(201).json({
      ...feedback,
      message: 'Thank you for your feedback! We appreciate your input.',
    });
  } catch (error) {
    logger.error('Submit feedback error', {
      module: 'feedbackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getMyFeedback = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const feedback = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(feedback);
  } catch (error) {
    logger.error('Get feedback error', {
      module: 'feedbackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
