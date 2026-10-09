import { z } from "zod";

export const doubtRouterSchema = z.object({
  topic: z.string(),
  subtopic: z.string(),
  difficulty: z.string(),
  doubt_type: z.enum(["concept_gap", "prerequisite_gap", "careless_error", "needs_human"]),
  confidence: z.number().min(0).max(1),
  route: z.enum(["ai_explain", "practice", "teacher"]),
  reasoning: z.string(),
});

export const aiExplanationSchema = z.object({
  explanation: z.string(),
  key_concepts: z.array(z.string()),
  analogies: z.array(z.string()).optional(),
  follow_up_questions: z.array(z.string()).optional(),
  based_on_past_session: z.boolean().optional(),
});

export const stepEvaluationSchema = z.object({
  step: z.number(),
  verdict: z.enum(["correct", "error", "redundant", "unclear"]),
  error_type: z.string().optional(),
  explanation: z.string(),
  fix: z.string().optional(),
});

export const solutionEvaluationSchema = z.object({
  steps: z.array(stepEvaluationSchema),
  first_error_step: z.number().nullable(),
  rubric: z.object({
    correctness: z.number().min(0).max(10),
    method: z.number().min(0).max(10),
    clarity_notation: z.number().min(0).max(10),
    total: z.number().min(0).max(10),
  }),
  model_solution: z.string(),
  source_citations: z.array(
    z.object({
      pdf_name: z.string(),
      page: z.number(),
    })
  ),
});

export const voiceEvaluationSchema = z.object({
  content_accuracy: z.number().min(0).max(10),
  structure: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  confidence_score: z.number().min(0).max(10),
  filler_analysis: z.string(),
  where_they_hesitated: z.array(z.string()),
  missing_concepts: z.array(z.string()),
  better_explanation: z.string(),
  one_sentence_tip: z.string(),
});

export const vivaQuestionSchema = z.object({
  question: z.string(),
  difficulty: z.number().min(1).max(5),
  topic: z.string(),
});

export const vivaAnswerEvalSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
  confidence: z.number().min(0).max(10),
  follow_up_topic: z.string().optional(),
});

export const vivaReportSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      score: z.number(),
      feedback: z.string(),
      confidence: z.number(),
    })
  ),
  confidence_trend: z.array(z.number()),
  weak_topics: z.array(z.string()),
  study_plan: z.array(z.string()),
  overall_score: z.number(),
});

export const practiceQuestionSchema = z.object({
  question: z.string(),
  difficulty: z.number().min(1).max(5),
  topic: z.string(),
  subtopic: z.string(),
  expected_answer: z.string(),
  hints: z.array(z.string()),
});

export const practiceSetSchema = z.object({
  questions: z.array(practiceQuestionSchema),
});

export const practiceEvalSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
  score: z.number().min(0).max(10),
});

export const sessionSummarySchema = z.object({
  doubt: z.string(),
  root_cause: z.string(),
  explanation_that_worked: z.string(),
});

export const teacherMatchSchema = z.object({
  score: z.number(),
  explanation: z.string(),
});
