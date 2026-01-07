import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import {
  getUserBaseline,
  getBaselineSummary,
  needsReassessment,
  calculateProgress,
} from './baselineService.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI prompt for plan creation
 */
const createPlanPrompt = (assessment, baseline, progress) => {
  const baselineSummary = baseline
    ? `Baseline: Stress ${baseline.mentalHealth.stress}/10, Anxiety ${baseline.mentalHealth.anxiety}/10, Mood ${baseline.mentalHealth.moodStability}/10. Sleep: ${baseline.sleep.quality}/10 quality, ${baseline.sleep.hours} hours. Time: ${baseline.timeAvailability.weekday}min weekday, ${baseline.timeAvailability.weekend}min weekend.`
    : 'No baseline data available.';

  const progressSummary = progress
    ? `Progress: ${progress.improvement ? `Stress ${progress.improvement.stress > 0 ? '+' : ''}${progress.improvement.stress.toFixed(1)}%, Energy ${progress.improvement.energy > 0 ? '+' : ''}${progress.improvement.energy.toFixed(1)}%` : 'No progress data yet'}.`
    : '';

  return `You are a wellness coach creating a personalized growth plan. The user has completed an assessment.

${baselineSummary}
${progressSummary}

Current Assessment:
- Stress Level: ${assessment.stressLevel}/10
- Anxiety Level: ${assessment.anxietyLevel}/10
- Mood Stability: ${assessment.moodStability}/10
- Sleep Quality: ${assessment.sleepQuality}/10
- Sleep Hours: ${assessment.sleepHours}
- Available Time: ${assessment.weekdayMinutes} minutes on weekdays, ${assessment.weekendMinutes} minutes on weekends
- Goals: ${assessment.goals.join(', ')}
- Values: ${assessment.values.join(', ')}
- Preferred Tone: ${assessment.preferredTone}

Create a growth plan with this structure (respond ONLY with valid JSON, no markdown):

{
  "vision": "A 1-2 sentence vision statement for the next 6-12 months that aligns with their goals and values",
  "intensity": "low" or "standard" or "high" (choose based on their current stress/anxiety levels - if stress > 7 or anxiety > 7, use "low"),
  "milestones": [
    {
      "title": "Month 1 milestone title",
      "description": "Specific, measurable milestone",
      "targetDate": "YYYY-MM-DD" (30 days from now)
    },
    {
      "title": "Month 2 milestone title",
      "description": "Specific, measurable milestone",
      "targetDate": "YYYY-MM-DD" (60 days from now)
    },
    {
      "title": "Month 3 milestone title",
      "description": "Specific, measurable milestone",
      "targetDate": "YYYY-MM-DD" (90 days from now)
    }
  ],
  "weeklyFocus": "A single theme for this week (e.g., 'Sleep discipline', 'Anxiety regulation', 'Strength routine')",
  "dailyTasks": [
    {
      "title": "Task name (very small, 2-10 minutes)",
      "description": "Why this matters",
      "estimatedMinutes": 5,
      "isAnchorWin": true or false (only one should be true - the most important),
      "category": "mental" or "physical" or "purpose" or "routine"
    }
  ]
}

Rules:
- Start EXTREMELY small. Tasks should be 2-10 minutes each.
- Total daily time should not exceed ${Math.min(assessment.weekdayMinutes, 30)} minutes on weekdays.
- If stress > 7 or anxiety > 7, make tasks even smaller (2-5 minutes each).
- Create 3-5 tasks per day maximum.
- One task must be marked as "anchorWin" (the most important one).
- Tasks must be meaningful and build toward the vision.
- Use the ${assessment.preferredTone} tone in descriptions.
- Make tasks specific and actionable, not vague.

Respond with ONLY the JSON object, no other text.`;
};

/**
 * Generate growth plan using AI
 */
export const generatePlan = async (userId) => {
  try {
    // Get user's assessment
    const assessment = await prisma.assessment.findUnique({
      where: { userId },
    });

    if (!assessment) {
      throw new Error('Assessment not found. Please complete assessment first.');
    }

    // Get baseline and progress
    const baseline = await getUserBaseline(userId);
    const progress = await calculateProgress(userId);

    // Check if user needs reassessment
    const needsReassess = await needsReassessment(userId, 30);

    // Create prompt
    const prompt = createPlanPrompt(assessment, baseline, progress);

    logger.info('Generating plan with AI', {
      module: 'planService',
      userId,
      hasBaseline: !!baseline,
      needsReassessment: needsReassess,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are a wellness coach that creates structured, achievable growth plans. Always respond with valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const planData = JSON.parse(completion.choices[0].message.content);

    // Deactivate existing plans
    await prisma.growthPlan.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create new plan
    const plan = await prisma.growthPlan.create({
      data: {
        userId,
        vision: planData.vision,
        intensity: planData.intensity,
        isActive: true,
        milestones: {
          create: planData.milestones.map((m) => ({
            title: m.title,
            description: m.description,
            targetDate: new Date(m.targetDate),
            progress: 0,
          })),
        },
        tasks: {
          create: planData.dailyTasks.map((t, index) => ({
            title: t.title,
            description: t.description,
            estimatedMinutes: t.estimatedMinutes,
            isAnchorWin: t.isAnchorWin,
            category: t.category,
            order: index,
          })),
        },
      },
      include: {
        milestones: true,
        tasks: true,
      },
    });

    logger.info('Plan generated successfully', {
      module: 'planService',
      userId,
      planId: plan.id,
      taskCount: plan.tasks.length,
      milestoneCount: plan.milestones.length,
    });

    return plan;
  } catch (error) {
    logger.error('Plan generation error', {
      module: 'planService',
      error: error.message,
      userId,
    });
    throw error;
  }
};

/**
 * Get current active plan
 */
export const getCurrentPlan = async (userId) => {
  try {
    const plan = await prisma.growthPlan.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        milestones: {
          orderBy: { targetDate: 'asc' },
        },
        tasks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return plan;
  } catch (error) {
    logger.error('Get plan error', {
      module: 'planService',
      error: error.message,
      userId,
    });
    throw error;
  }
};
