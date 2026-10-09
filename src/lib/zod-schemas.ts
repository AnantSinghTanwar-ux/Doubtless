import { z } from "zod";

/*
 * AI output is validated leniently: secondary fields fall back to safe defaults so a model that omits
 * or nulls one field (common with small local models) doesn't fail the whole feature. Core content
 * fields stay required.
 */
const text = z.preprocess((v) => (v == null ? "" : typeof v === "string" ? v : String(v)), z.string());
const optText = z.preprocess((v) => (v == null || v === "" ? undefined : String(v)), z.string().optional());
const textList = z.preprocess(
  (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.preprocess((x) => (typeof x === "string" ? x : JSON.stringify(x)), z.string()))
);
const scale = (min: number, max: number, fallback: number) =>
  z.coerce.number().catch(fallback).transform((n) => Math.min(max, Math.max(min, n)));
const score10 = scale(0, 10, 0);

export const doubtRouterSchema = z.object({
  topic: z.string(),
  subtopic: z.string(),
  difficulty: z.string(),
  doubt_type: z.enum(["concept_gap", "prerequisite_gap", "careless_error", "needs_human"]),
  confidence: z.number().min(0).max(1),
  grade_level: z.number().int().min(1).max(13).optional(),
  route: z.enum(["ai_explain", "practice", "teacher"]),
  reasoning: z.string(),
});

export const aiExplanationSchema = z.object({
  explanation: z.string().min(1),
  key_concepts: textList,
  analogies: textList.optional(),
  follow_up_questions: textList.optional(),
  based_on_past_session: z.boolean().optional(),
});

export const stepEvaluationSchema = z.object({
  step: z.coerce.number(),
  verdict: z.preprocess((v) => String(v ?? "").toLowerCase(), z.enum(["correct", "error", "redundant", "unclear"]).catch("unclear")),
  error_type: optText,
  explanation: text,
  fix: optText,
});

export const solutionEvaluationSchema = z.object({
  steps: z.array(stepEvaluationSchema),
  first_error_step: z.coerce.number().nullable().catch(null),
  rubric: z.object({
    correctness: score10,
    method: score10,
    clarity_notation: score10,
    total: score10,
  }),
  model_solution: text,
  source_citations: z
    .array(
      z.object({
        pdf_name: text,
        page: z.coerce.number().catch(0),
      })
    )
    .catch([]),
});

export const voiceEvaluationSchema = z.object({
  content_accuracy: score10,
  structure: score10,
  clarity: score10,
  confidence_score: score10,
  filler_analysis: text,
  where_they_hesitated: textList,
  missing_concepts: textList,
  better_explanation: text,
  one_sentence_tip: text,
});

export const vivaQuestionSchema = z.object({
  question: z.string().min(1),
  difficulty: scale(1, 5, 3),
  topic: text,
});

export const vivaAnswerEvalSchema = z.object({
  score: score10,
  feedback: text,
  confidence: score10,
  follow_up_topic: optText,
});

export const vivaReportSchema = z.object({
  answers: z.array(
    z.object({
      question: text,
      answer: text,
      score: score10,
      feedback: text,
      confidence: score10,
    })
  ),
  confidence_trend: z.array(z.coerce.number()).catch([]),
  weak_topics: textList,
  study_plan: textList,
  overall_score: score10,
});

export const practiceQuestionSchema = z.object({
  question: z.string().min(1),
  difficulty: scale(1, 5, 3),
  topic: text,
  subtopic: text,
  expected_answer: text,
  hints: textList,
});

export const practiceSetSchema = z.object({
  questions: z.array(practiceQuestionSchema),
});

export const practiceEvalSchema = z.object({
  correct: z.preprocess((v) => v === true || v === "true", z.boolean()),
  feedback: text,
  score: score10,
});

export const sessionSummarySchema = z.object({
  doubt: text,
  root_cause: text,
  explanation_that_worked: text,
});

export const teacherMatchSchema = z.object({
  score: z.number(),
  explanation: z.string(),
});
