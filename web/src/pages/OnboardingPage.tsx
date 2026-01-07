import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { planService } from '../services/planService';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Slider } from '../components/Slider';
import type { Assessment } from '../types';

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [assessment, setAssessment] = useState<Partial<Assessment>>({
    stressLevel: 5,
    anxietyLevel: 5,
    moodStability: 5,
    sleepQuality: 5,
    sleepHours: 7,
    weekdayMinutes: 30,
    weekendMinutes: 60,
    goals: [],
    values: [],
    currentStruggles: [],
    preferredTone: 'steady',
  });

  const submitAssessmentMutation = useMutation({
    mutationFn: (data: Assessment) => planService.submitAssessment(data),
  });

  const generatePlanMutation = useMutation({
    mutationFn: () => planService.generatePlan(),
    onSuccess: () => {
      navigate('/daily-plan');
    },
  });

  const handleSubmit = async () => {
    try {
      // Submit assessment first
      await submitAssessmentMutation.mutateAsync(assessment as Assessment);
      // Then generate plan
      generatePlanMutation.mutate();
    } catch (error) {
      console.error('Error submitting assessment:', error);
      // Error will be shown via mutation error state
    }
  };

  const totalSteps = 6;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress stepper */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {step} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500">6-10 min • can pause anytime</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-700 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <Card>
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Mental Baseline</h2>
                <p className="text-gray-600">Help us understand where you're starting from.</p>
              </div>

              <Slider
                label="Stress Level"
                value={assessment.stressLevel || 5}
                onChange={(value) => setAssessment({ ...assessment, stressLevel: value })}
              />

              <Slider
                label="Anxiety Level"
                value={assessment.anxietyLevel || 5}
                onChange={(value) => setAssessment({ ...assessment, anxietyLevel: value })}
              />

              <Slider
                label="Mood Stability"
                value={assessment.moodStability || 5}
                onChange={(value) => setAssessment({ ...assessment, moodStability: value })}
              />

              <div className="flex gap-4 pt-4">
                <Button onClick={() => setStep(step + 1)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sleep & Energy</h2>
                <p className="text-gray-600">Tell us about your rest and energy levels.</p>
              </div>

              <Slider
                label="Sleep Quality"
                value={assessment.sleepQuality || 5}
                onChange={(value) => setAssessment({ ...assessment, sleepQuality: value })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Average Sleep Hours
                </label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  value={assessment.sleepHours || 7}
                  onChange={(e) => setAssessment({ ...assessment, sleepHours: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(step + 1)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Time Availability</h2>
                <p className="text-gray-600">How much time can you commit daily?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weekday Minutes
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  step="5"
                  value={assessment.weekdayMinutes || 30}
                  onChange={(e) => setAssessment({ ...assessment, weekdayMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weekend Minutes
                </label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  step="5"
                  value={assessment.weekendMinutes || 60}
                  onChange={(e) => setAssessment({ ...assessment, weekendMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(step + 1)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Goals</h2>
                <p className="text-gray-600">What do you want to achieve? (Select 1-3)</p>
              </div>

              <div className="space-y-3">
                {[
                  'Build discipline',
                  'Reduce anxiety',
                  'Improve sleep',
                  'Increase energy',
                  'Find purpose',
                  'Build strength',
                  'Better focus',
                  'Emotional stability',
                ].map((goal) => (
                  <label
                    key={goal}
                    className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={assessment.goals?.includes(goal)}
                      onChange={(e) => {
                        const goals = assessment.goals || [];
                        if (e.target.checked) {
                          setAssessment({ ...assessment, goals: [...goals, goal] });
                        } else {
                          setAssessment({ ...assessment, goals: goals.filter((g) => g !== goal) });
                        }
                      }}
                      className="w-4 h-4 text-primary-700 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="ml-3 text-gray-700">{goal}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(step + 1)} className="flex-1" disabled={!assessment.goals?.length}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Preferred Tone</h2>
                <p className="text-gray-600">How do you want to be coached?</p>
              </div>

              <div className="space-y-3">
                {(['steady', 'firm', 'gentle'] as const).map((tone) => (
                  <label
                    key={tone}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      assessment.preferredTone === tone
                        ? 'border-primary-700 bg-primary-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={tone}
                      checked={assessment.preferredTone === tone}
                      onChange={() => setAssessment({ ...assessment, preferredTone: tone })}
                      className="w-4 h-4 text-primary-700 border-gray-300 focus:ring-primary-500"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-gray-900 capitalize">{tone}</div>
                      <div className="text-sm text-gray-600">
                        {tone === 'steady' && 'Balanced, consistent guidance'}
                        {tone === 'firm' && 'Direct, no-nonsense approach'}
                        {tone === 'gentle' && 'Supportive, understanding tone'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(step + 1)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost Done</h2>
                <p className="text-gray-600">Your plan will start small by design.</p>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="text-sm text-primary-900">
                  We'll use your responses to create a personalized growth plan. The plan will be
                  built to be repeatable, even on rough days.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                {(submitAssessmentMutation.isError || generatePlanMutation.isError) && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                    {submitAssessmentMutation.error
                      ? (submitAssessmentMutation.error as any)?.response?.data?.error || 'Failed to submit assessment'
                      : (generatePlanMutation.error as any)?.response?.data?.error || 'Failed to generate plan'}
                  </div>
                )}
                <Button
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={submitAssessmentMutation.isPending || generatePlanMutation.isPending}
                >
                  {submitAssessmentMutation.isPending || generatePlanMutation.isPending
                    ? 'Creating your plan...'
                    : 'Create My Plan'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
