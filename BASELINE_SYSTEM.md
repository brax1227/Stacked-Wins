# Baseline System Documentation

## Overview

The baseline system tracks each user's starting point and uses it to:
1. **Reference point** - Compare current progress to original state
2. **Plan generation** - AI uses baseline + current assessment to create personalized plans
3. **Progress tracking** - Calculate improvements over time
4. **Reassessment triggers** - Determine when users need to update their assessment

## How It Works

### 1. Initial Baseline Capture

When a user completes their **first assessment**, it becomes their baseline:

```javascript
// First assessment automatically becomes baseline
POST /api/assessment
{
  stressLevel: 7,
  anxietyLevel: 6,
  moodStability: 5,
  // ... other fields
}

// Response includes baseline
{
  ...assessment,
  baseline: {
    mentalHealth: {
      stress: 7,
      anxiety: 6,
      moodStability: 5,
      average: 6
    },
    sleep: { quality: 6, hours: 7 },
    timeAvailability: { weekday: 30, weekend: 60 },
    goals: [...],
    values: [...],
    preferredTone: "steady",
    timestamp: "2024-01-01T00:00:00Z"
  },
  isBaseline: true
}
```

### 2. Baseline Calculation

The baseline is calculated from the **first assessment** (ordered by `completedAt`):

- **Mental Health**: Stress, anxiety, mood stability scores
- **Sleep**: Quality and hours
- **Time Availability**: Weekday and weekend minutes
- **Goals & Values**: User's stated goals and values
- **Preferred Tone**: How they want to be coached

### 3. Progress Tracking

The system compares current check-ins to baseline:

```javascript
// Calculates progress since baseline
GET /api/progress/dashboard

// Returns:
{
  baseline: { ... },
  current: {
    mentalHealth: {
      stress: 5,  // Improved from 7
      energy: 7,
      sleepQuality: 7
    }
  },
  improvement: {
    stress: -28.6%,  // 28.6% reduction in stress
    energy: +16.7%,  // 16.7% increase in energy
    sleep: +16.7%    // 16.7% improvement in sleep
  },
  daysTracked: 7
}
```

### 4. Plan Generation with Baseline

When generating a plan, the AI receives:

1. **Original Baseline** - Where they started
2. **Current Assessment** - Where they are now
3. **Progress Data** - How much they've improved
4. **Task Completions** - What they've accomplished

This allows the AI to:
- Start small if baseline shows high stress/anxiety
- Increase difficulty if progress shows improvement
- Reference their original goals and values
- Adjust based on what's working

### 5. Reassessment System

The system tracks when reassessments are needed:

```javascript
// Check if reassessment needed (default: 30 days)
GET /api/assessment/reassessment?days=30

// Returns:
{
  needsReassessment: true,
  threshold: 30
}
```

**Reassessment Logic:**
- Default: Every 30 days
- Can be customized (weekly: 7 days, monthly: 30 days)
- Compares last assessment date to current date
- Returns `true` if threshold exceeded

**When to Reassess:**
- **Weekly** (7 days): For rapid iteration and adjustment
- **Monthly** (30 days): Standard cadence for most users
- **Quarterly** (90 days): For stable, long-term users

## API Endpoints

### Assessment Endpoints

```javascript
// Submit assessment (creates baseline if first time)
POST /api/assessment
Headers: { Authorization: "Bearer <token>" }
Body: { stressLevel, anxietyLevel, ... }

// Get assessment with baseline
GET /api/assessment
Headers: { Authorization: "Bearer <token>" }

// Check if reassessment needed
GET /api/assessment/reassessment?days=30
Headers: { Authorization: "Bearer <token>" }
```

### Plan Generation

```javascript
// Generate plan (uses baseline + current assessment)
POST /api/plan/generate
Headers: { Authorization: "Bearer <token>" }

// Response includes needsReassessment flag
{
  ...plan,
  needsReassessment: false
}
```

## Baseline Service Functions

### `calculateBaseline(assessment)`
Calculates baseline metrics from assessment data.

### `getUserBaseline(userId)`
Retrieves user's original baseline (from first assessment).

### `calculateProgress(userId)`
Compares current check-ins to baseline to show improvement.

### `needsReassessment(userId, daysThreshold)`
Checks if user needs to reassess (default 30 days).

### `getBaselineSummary(userId)`
Formats baseline data for AI prompts.

## Usage in Plan Generation

The AI prompt includes:

```
Baseline: Stress 7/10, Anxiety 6/10, Mood 5/10. 
Sleep: 6/10 quality, 7 hours. 
Time: 30min weekday, 60min weekend.

Progress: Stress -28.6%, Energy +16.7%

Current Assessment:
- Stress Level: 5/10 (improved from 7)
- ...
```

This allows the AI to:
- **Start conservatively** if baseline shows high stress
- **Increase difficulty** if progress shows improvement
- **Maintain consistency** with original goals/values
- **Adapt** based on what's working

## Reassessment Workflow

1. **User completes onboarding** → Baseline created
2. **User uses app daily** → Check-ins track progress
3. **After X days** → System flags need for reassessment
4. **User completes reassessment** → New assessment saved
5. **Plan regenerated** → Uses new assessment + baseline + progress
6. **Cycle repeats** → Continuous improvement

## Benefits

1. **Personalized Plans** - AI knows where user started
2. **Progress Visibility** - Users see improvement over time
3. **Adaptive Difficulty** - Plans adjust based on progress
4. **Goal Alignment** - Always references original goals/values
5. **Continuous Improvement** - Regular reassessments keep plans relevant

## Future Enhancements

- [ ] Baseline comparison charts
- [ ] Milestone-based reassessments (not just time-based)
- [ ] Automatic plan regeneration on reassessment
- [ ] Baseline export for user records
- [ ] Multiple baseline tracking (for major life changes)

---

**Last Updated**: 2024  
**Status**: Implemented ✅
