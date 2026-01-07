import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { getBaselineSummary, getUserBaseline, calculateProgress } from './baselineService.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get coaching context for AI
 */
const getCoachingContext = async (userId) => {
  try {
    const baseline = await getUserBaseline(userId);
    const progress = await calculateProgress(userId);
    const baselineSummary = await getBaselineSummary(userId);

    // Get current plan
    const plan = await prisma.growthPlan.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        milestones: true,
        tasks: true,
      },
    });

    // Get recent check-ins (last 7 days)
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
      take: 7,
    });

    // Get progress metrics
    const metrics = await prisma.progressMetrics.findUnique({
      where: { userId },
    });

    // Get recent task completions
    const recentCompletions = await prisma.taskCompletion.findMany({
      where: {
        checkIn: {
          userId,
          date: {
            gte: sevenDaysAgo,
          },
        },
      },
      include: {
        task: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    let context = `You are a wellness coach helping a user with their personal growth journey.\n\n`;
    context += `${baselineSummary}\n\n`;

    if (plan) {
      context += `Current Plan:\n`;
      context += `- Vision: ${plan.vision}\n`;
      context += `- Intensity: ${plan.intensity}\n`;
      context += `- Active Milestones: ${plan.milestones.length}\n`;
      context += `- Daily Tasks: ${plan.tasks.length}\n\n`;
    }

    if (metrics) {
      context += `Progress:\n`;
      context += `- Wins Stacked: ${metrics.winsStacked}\n`;
      context += `- Consistency Rate: ${metrics.consistencyRate.toFixed(1)}%\n`;
      context += `- Current Streak: ${metrics.baselineStreak} days\n\n`;
    }

    if (recentCheckIns.length > 0) {
      const avgEnergy = recentCheckIns.reduce((sum, c) => sum + c.energy, 0) / recentCheckIns.length;
      const avgStress = recentCheckIns.reduce((sum, c) => sum + c.stress, 0) / recentCheckIns.length;
      context += `Recent Check-ins (last 7 days):\n`;
      context += `- Average Energy: ${avgEnergy.toFixed(1)}/10\n`;
      context += `- Average Stress: ${avgStress.toFixed(1)}/10\n\n`;
    }

    if (recentCompletions.length > 0) {
      context += `Recent Task Completions:\n`;
      recentCompletions.slice(0, 5).forEach((completion) => {
        context += `- ${completion.task.title}\n`;
      });
      context += `\n`;
    }

    return context;
  } catch (error) {
    logger.error('Get coaching context error', {
      module: 'coachService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Send message to AI coach
 */
export const sendCoachMessage = async (userId, message) => {
  try {
    // Get coaching context
    const context = await getCoachingContext(userId);

    // Get recent chat history (last 5 messages for context)
    const recentChats = await prisma.coachChat.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Build conversation history
    const conversationHistory = recentChats.reverse().map((chat) => ({
      role: chat.role,
      content: chat.role === 'user' ? chat.message : chat.response,
    }));

    // Create system prompt
    const systemPrompt = `You are a wellness coach for the Stacked Wins app. Your role is to:

- Provide grounded, supportive guidance
- Help users stay on track with their growth plan
- Offer perspective and reframe challenges
- Encourage discipline and consistency
- Keep responses concise and actionable
- Use the user's preferred tone (from their baseline)
- Reference their baseline and progress when relevant
- Never make therapy claims or medical advice

${context}

Respond in a supportive, structured way. Keep responses under 200 words unless the user asks for more detail.`;

    logger.info('Sending coach message', {
      module: 'coachService',
      userId,
      messageLength: message.length,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversationHistory,
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content;

    // Save chat history
    await prisma.coachChat.createMany({
      data: [
        {
          userId,
          message,
          response: '',
          role: 'user',
        },
        {
          userId,
          message: '',
          response,
          role: 'assistant',
        },
      ],
    });

    logger.info('Coach response generated', {
      module: 'coachService',
      userId,
      responseLength: response.length,
    });

    return {
      message,
      response,
    };
  } catch (error) {
    logger.error('Coach message error', {
      module: 'coachService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Get chat history
 */
export const getChatHistory = async (userId, limit = 50) => {
  try {
    const chats = await prisma.coachChat.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Group consecutive user/assistant messages into conversations
    const conversations = [];
    let currentConversation = null;

    for (const chat of chats) {
      if (chat.role === 'user') {
        if (currentConversation) {
          conversations.push(currentConversation);
        }
        currentConversation = {
          id: chat.id,
          message: chat.message,
          response: '',
          role: 'user',
          createdAt: chat.createdAt,
        };
      } else if (chat.role === 'assistant' && currentConversation) {
        currentConversation.response = chat.response;
        currentConversation.createdAt = chat.createdAt;
      }
    }

    if (currentConversation) {
      conversations.push(currentConversation);
    }

    return conversations;
  } catch (error) {
    logger.error('Get chat history error', {
      module: 'coachService',
      error: error.message,
      userId,
    });
    throw error;
  }
};
