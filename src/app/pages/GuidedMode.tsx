import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import GraphView from '../components/GraphView';
import TableauWorkspace from '../components/TableauWorkspace';
import StepTimeline from '../components/StepTimeline';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useLPSolver } from '../hooks/useLPSolver';
import { LESSONS, Lesson, LessonDifficulty } from '../data/lessons';
import { StepType } from '../types';
import {
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Lightbulb, Target, AlertTriangle,
  Loader2, Info,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<LessonDifficulty, string> = {
  Beginner:     'bg-green-100 text-green-800',
  Intermediate: 'bg-yellow-100 text-yellow-800',
  Advanced:     'bg-red-100 text-red-800',
};

const CHAPTER_COLOR: Record<string, string> = {
  'Chapter 3': 'border-blue-400 bg-blue-50',
  'Chapter 4': 'border-emerald-400 bg-emerald-50',
  'Chapter 5': 'border-orange-400 bg-orange-50',
  'Chapter 6': 'border-purple-400 bg-purple-50',
};

const CHAPTER_HEADER: Record<string, string> = {
  'Chapter 3': 'bg-blue-600',
  'Chapter 4': 'bg-emerald-600',
  'Chapter 5': 'bg-orange-600',
  'Chapter 6': 'bg-purple-600',
};

const STEP_LABEL: Record<StepType, string> = {
  initial:          'Initial Tableau',
  select_pivot:     'Select Pivot',
  after_pivot:      'After Pivot',
  optimal:          'Optimal Solution',
  infeasible:       'Infeasible',
  unbounded:        'Unbounded',
  phase1_initial:   'Phase I — Initial',
  phase1_complete:  'Phase I Complete',
  phase2_initial:   'Phase II — Initial',
  degenerate:       'Degenerate',
  alternative:      'Alternative Optimal',
};

// ── Lesson Selection Screen ────────────────────────────────────────────────

function LessonCard({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  const accent = CHAPTER_COLOR[lesson.chapter] ?? 'border-gray-300 bg-gray-50';
  const header = CHAPTER_HEADER[lesson.chapter] ?? 'bg-gray-600';
  return (
    <div className={`border-2 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${accent}`}>
      <div className={`${header} text-white px-4 py-3 flex items-center justify-between`}>
        <span className="text-xs font-semibold uppercase tracking-wide">{lesson.chapter}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[lesson.difficulty]}`}>
          {lesson.difficulty}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-gray-500 font-medium mb-0.5">Lesson {lesson.number}</p>
          <h3 className="text-base font-bold text-gray-900">{lesson.title}</h3>
          <p className="text-sm text-gray-600 mt-1 leading-snug">{lesson.description}</p>
        </div>
        <ul className="space-y-1">
          {lesson.learningObjectives.map((obj, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
              <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
              {obj}
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          onClick={onStart}
          className={`w-full mt-1 ${header} hover:opacity-90 text-white`}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1.5" />
          Start Lesson
        </Button>
      </div>
    </div>
  );
}

// ── Lesson Panel (bottom-left while solving) ───────────────────────────────

function LessonPanel({
  lesson,
  stepType,
  stepExplanation,
  stepIndex,
  totalSteps,
  quizAnswer,
  onQuizAnswer,
  hasAlternative,
  isDegenerate,
}: {
  lesson: Lesson;
  stepType: StepType | undefined;
  stepExplanation: string;
  stepIndex: number;
  totalSteps: number;
  quizAnswer: number | null;
  onQuizAnswer: (i: number) => void;
  hasAlternative?: boolean;
  isDegenerate?: boolean;
}) {
  const hint = stepType ? (lesson.hints as Record<string, string | undefined>)[stepType] : undefined;
  const showQuiz =
    lesson.pivotQuiz != null &&
    stepType === 'select_pivot';
  const quiz = lesson.pivotQuiz;
  const accent = CHAPTER_HEADER[lesson.chapter] ?? 'bg-gray-600';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className={`${accent} text-white px-4 py-2 flex-shrink-0 flex items-center justify-between`}>
        <div>
          <p className="text-xs opacity-80">{lesson.chapter} · Lesson {lesson.number}</p>
          <p className="text-sm font-bold leading-tight">{lesson.title}</p>
        </div>
        {stepType && (
          <Badge variant="secondary" className="text-xs">
            {STEP_LABEL[stepType] ?? stepType}
          </Badge>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* Step counter */}
        <div className="text-xs text-gray-500 text-right">
          Step {stepIndex + 1} of {totalSteps}
        </div>

        {/* Special case banners */}
        {hasAlternative && (
          <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-indigo-800">Alternative Optimal Solutions Detected</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                A nonbasic variable has a zero reduced cost in the Z-row. There are infinitely many
                optimal solutions along the edge between two optimal corners.
              </p>
            </div>
          </div>
        )}
        {isDegenerate && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">Degenerate BFS Detected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                A basic variable has value 0. Degeneracy can cause cycling in theory; Bland's Rule
                (smallest-index tie-breaking) is used to prevent it.
              </p>
            </div>
          </div>
        )}

        {/* Intro card — only on initial step */}
        {stepType === 'initial' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5 text-gray-600" />
              <p className="text-xs font-bold text-gray-800">Introduction</p>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{lesson.intro}</p>
          </div>
        )}

        {/* Contextual hint from lesson */}
        {hint && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-xs font-bold text-blue-800">Lesson Hint</p>
            </div>
            <p className="text-xs text-blue-900 leading-relaxed">{hint}</p>
          </div>
        )}

        {/* Quiz — shown at select_pivot steps */}
        {showQuiz && quiz && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
            <p className="text-xs font-bold text-amber-900 mb-2">
              Quick Check
            </p>
            <p className="text-xs text-gray-800 mb-2 leading-snug">{quiz.question}</p>
            <div className="space-y-1">
              {quiz.choices.map((choice, i) => {
                let cls = 'w-full text-left text-xs px-3 py-2 rounded border transition-colors ';
                if (quizAnswer === null) {
                  cls += 'bg-white border-gray-300 hover:bg-amber-100 hover:border-amber-400 cursor-pointer';
                } else if (i === quiz.correctIndex) {
                  cls += 'bg-green-100 border-green-500 text-green-800 font-medium';
                } else if (i === quizAnswer) {
                  cls += 'bg-red-100 border-red-400 text-red-800';
                } else {
                  cls += 'bg-gray-50 border-gray-200 text-gray-500';
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => quizAnswer === null && onQuizAnswer(i)}
                  >
                    <span className="font-semibold mr-1.5">
                      {String.fromCharCode(65 + i)})
                    </span>
                    {choice}
                    {quizAnswer !== null && i === quiz.correctIndex && (
                      <CheckCircle className="inline w-3.5 h-3.5 ml-1.5 text-green-600" />
                    )}
                    {quizAnswer !== null && i === quizAnswer && i !== quiz.correctIndex && (
                      <XCircle className="inline w-3.5 h-3.5 ml-1.5 text-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
            {quizAnswer !== null && (
              <div className={`mt-2 p-2 rounded text-xs leading-snug ${quizAnswer === quiz.correctIndex ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <span className="font-bold">
                  {quizAnswer === quiz.correctIndex ? 'Correct! ' : 'Not quite. '}
                </span>
                {quiz.explanation}
              </div>
            )}
          </div>
        )}

        {/* Raw backend explanation */}
        {stepExplanation && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold text-gray-600 mb-1">Solver Explanation</p>
            <p className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
              {stepExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main GuidedMode Component ──────────────────────────────────────────────

export default function GuidedMode() {
  const navigate = useNavigate();

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

  const {
    steps, currentStep, currentStepIndex,
    canStepBack, canStepForward, isLoading, error,
    currentSimplexPath, currentPoint, solverResponse,
    solve, stepForward, stepBack, jumpToStep,
  } = useLPSolver();

  const activeLesson: Lesson | null =
    activeLessonId ? LESSONS.find(l => l.id === activeLessonId) ?? null : null;

  // Auto-solve when a lesson is selected
  useEffect(() => {
    if (!activeLesson) return;
    solve(activeLesson.problem, activeLesson.method);
    setQuizAnswer(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  const handleSelectLesson = (lesson: Lesson) => {
    setActiveLessonId(lesson.id);
  };

  const handleBackToLessons = () => {
    setActiveLessonId(null);
  };

  // ── Lesson Selection Screen ────────────────────────────────────────────

  if (!activeLesson) {
    return (
      <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white px-6 py-5 flex items-center gap-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Home
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Guided Learning Mode</h1>
            <p className="text-sm text-indigo-200">
              Choose a lesson to begin — from graphical method through special cases
            </p>
          </div>
        </div>

        {/* Lesson grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {LESSONS.map(lesson => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onStart={() => handleSelectLesson(lesson)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Solving Screen ─────────────────────────────────────────────────────

  const headerColor = CHAPTER_HEADER[activeLesson.chapter] ?? 'bg-gray-700';
  const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;

  return (
    <div className="h-screen flex flex-col bg-gray-100">

      {/* Header */}
      <div className={`${headerColor} text-white px-5 py-3 flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToLessons}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Lessons
          </Button>
          <div>
            <p className="text-xs opacity-75">
              {activeLesson.chapter} · {activeLesson.difficulty}
            </p>
            <p className="text-base font-bold leading-tight">
              Lesson {activeLesson.number}: {activeLesson.title}
            </p>
          </div>
        </div>

        {/* Step nav */}
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin opacity-75" />}
          {error && (
            <span className="text-xs bg-red-500/30 px-2 py-1 rounded">
              Error: {error.slice(0, 50)}
            </span>
          )}
          {steps.length > 0 && (
            <>
              <span className="text-xs opacity-75">
                Step {currentStepIndex + 1}/{steps.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={stepBack}
                disabled={!canStepBack}
                className="text-white hover:bg-white/20 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stepForward}
                disabled={!canStepForward}
                className="text-white hover:bg-white/20 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content: top tableau + bottom split */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP HALF: Tableau */}
        <div className="h-1/2 border-b border-gray-300 bg-white overflow-auto">
          {isLoading && (
            <div className="h-full flex items-center justify-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Solving…
            </div>
          )}
          {!isLoading && error && (
            <div className="h-full flex items-center justify-center">
              <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md text-center">
                <p className="text-red-700 font-medium">Backend Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <p className="text-xs text-gray-500 mt-2">Make sure the backend is running.</p>
              </div>
            </div>
          )}
          {!isLoading && !error && currentStep && (
            <TableauWorkspace
              tableau={currentStep.tableau}
              previousTableau={prevStep?.tableau}
              currentStep={currentStep}
              showRatioTest={true}
              isInteractive={false}
            />
          )}
          {!isLoading && !error && !currentStep && (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Press "Start Lesson" above, or the lesson will auto-solve momentarily…
            </div>
          )}
        </div>

        {/* BOTTOM HALF */}
        <div className="h-1/2 flex overflow-hidden">

          {/* Bottom-left: Lesson panel */}
          <div className="w-1/2 border-r border-gray-300 overflow-hidden">
            <LessonPanel
              lesson={activeLesson}
              stepType={currentStep?.stepType}
              stepExplanation={currentStep?.explanation ?? ''}
              stepIndex={currentStepIndex}
              totalSteps={steps.length}
              quizAnswer={quizAnswer}
              onQuizAnswer={setQuizAnswer}
              hasAlternative={currentStep?.hasAlternative ?? false}
              isDegenerate={currentStep?.isDegenerate ?? false}
            />
          </div>

          {/* Bottom-right: Graph */}
          <div className="w-1/2 bg-white overflow-hidden">
            <GraphView
              constraints={activeLesson.problem.constraints}
              cornerPoints={solverResponse?.cornerPoints ?? []}
              feasibleRegionPolygon={solverResponse?.feasibleRegionPolygon ?? []}
              simplexPath={currentSimplexPath}
              objectiveCoefficients={activeLesson.problem.objectiveCoefficients}
              showObjectiveLine={true}
              currentPoint={currentPoint ?? undefined}
            />
          </div>
        </div>
      </div>

      {/* Step timeline */}
      {steps.length > 0 && (
        <StepTimeline
          currentStep={currentStepIndex}
          totalSteps={steps.length}
          onStepChange={jumpToStep}
        />
      )}
    </div>
  );
}
