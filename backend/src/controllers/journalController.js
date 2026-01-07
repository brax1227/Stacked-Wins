import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const createJournalEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, content, mood, tags, milestoneId } = req.body;

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Journal content is required',
      });
    }

    if (mood && !['grateful', 'reflective', 'motivated', 'challenged', 'proud', 'neutral'].includes(mood)) {
      return res.status(400).json({
        error: 'Mood must be one of: grateful, reflective, motivated, challenged, proud, neutral',
      });
    }

    // Verify milestone belongs to user if provided
    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: {
          id: milestoneId,
          plan: {
            userId,
          },
        },
      });

      if (!milestone) {
        return res.status(404).json({
          error: 'Milestone not found or does not belong to your plan',
        });
      }
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId,
        title: title || null,
        content: content.trim(),
        mood: mood || null,
        tags: tags || [],
        milestoneId: milestoneId || null,
      },
    });

    logger.info('Journal entry created', {
      module: 'journalController',
      userId,
      entryId: entry.id,
    });

    res.status(201).json(entry);
  } catch (error) {
    logger.error('Create journal entry error', {
      module: 'journalController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getJournalEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    res.json(entry);
  } catch (error) {
    logger.error('Get journal entry error', {
      module: 'journalController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const getJournalEntries = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const mood = req.query.mood;
    const milestoneId = req.query.milestoneId;

    const where = {
      userId,
      ...(mood && { mood }),
      ...(milestoneId && { milestoneId }),
    };

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          milestone: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    res.json({
      entries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Get journal entries error', {
      module: 'journalController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const updateJournalEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, content, mood, tags } = req.body;

    // Verify entry belongs to user
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Validation
    if (content !== undefined && content.trim().length === 0) {
      return res.status(400).json({
        error: 'Journal content cannot be empty',
      });
    }

    if (mood && !['grateful', 'reflective', 'motivated', 'challenged', 'proud', 'neutral'].includes(mood)) {
      return res.status(400).json({
        error: 'Mood must be one of: grateful, reflective, motivated, challenged, proud, neutral',
      });
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(content !== undefined && { content: content.trim() }),
        ...(mood !== undefined && { mood: mood || null }),
        ...(tags !== undefined && { tags: tags || [] }),
      },
    });

    logger.info('Journal entry updated', {
      module: 'journalController',
      userId,
      entryId: id,
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update journal entry error', {
      module: 'journalController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

export const deleteJournalEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify entry belongs to user
    const entry = await prisma.journalEntry.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    await prisma.journalEntry.delete({
      where: { id },
    });

    logger.info('Journal entry deleted', {
      module: 'journalController',
      userId,
      entryId: id,
    });

    res.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    logger.error('Delete journal entry error', {
      module: 'journalController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
