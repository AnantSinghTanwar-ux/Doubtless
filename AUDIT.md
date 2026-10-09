# Doubtless - System Audit & Status Report

## 1. Stack and Conventions
- **Framework**: Next.js 16.3 (App Router).
- **Language**: TypeScript (strict mode enabled).
- **Styling**: Tailwind CSS (v4) with custom global utilities (`.glass`, `.glow`, etc.).
- **Auth & State**: Firebase Auth managed via React Context (`AuthContext`).
- **Database**: Firestore. Data access is centralized in `src/lib/firestore.ts`.
- **AI Interface**: Currently wrapping `@google/genai` directly in `src/lib/gemini.ts`.
- **Component Pattern**: Small, focused components in `src/components/`, divided by domain.

## 2. Feature Status Table

| Feature | Status | File Paths |
|---------|--------|------------|
| Foundation (Auth, UI, Env) | PARTIAL | `src/contexts/AuthContext.tsx`, `src/app/login/page.tsx` |
| Foundation (aiProvider) | MISSING | N/A |
| Foundation (Job Status, Caching) | MISSING | N/A |
| Study Vault (Ingestion & RAG) | PARTIAL | `src/app/api/vault/upload/route.ts`, `src/lib/chunker.ts`, `src/lib/rag.ts` |
| Co-Reader | MISSING | N/A |
| PYQ Analyzer | MISSING | N/A |
| Rubric Engine | MISSING | N/A |
| Examiner Mode (Step Solver) | PARTIAL | `src/app/solve/page.tsx`, `src/app/api/solve/evaluate/route.ts` |
| Voice Explain (Feynman Mode) | PARTIAL | `src/app/voice/page.tsx`, `src/app/api/voice/evaluate/route.ts` |
| AI Viva Mode | PARTIAL | `src/app/viva/page.tsx`, `src/app/api/viva/question/route.ts` |
| Doubt Router | PARTIAL | `src/app/ask/page.tsx`, `src/app/api/doubt/route/route.ts` |
| Learner Profile | PARTIAL | `src/app/dashboard/page.tsx`, `src/lib/firestore.ts` |
| Teacher Handoff & Session | PARTIAL | `src/app/teachers/page.tsx`, `src/app/session/[id]/page.tsx` |

## 3. Bugs, Security Issues, and Tech Debt
- **Lint Errors**: Multiple `react-hooks/set-state-in-effect` violations, unescaped quotes in React components, and usage of `any` types (especially in `useSpeechRecognition.ts`).
- **Typecheck & Build Errors**: 
  - `src/app/api/vault/upload/route.ts`: `pdf-parse` imported as default export but has none.
  - `src/app/ask/page.tsx`: Property `recentInteractions` accessed on `UserProfile` instead of `LearnerProfile`.
  - `src/app/session/[id]/page.tsx`: `JitsiMeetExternalAPI` missing on `window` object.
  - `src/components/dashboard/ScoreTrend.tsx`: Cannot find module `date-fns`.
  - `src/components/solve/EvaluationResult.tsx`: `className` prop passed to `<ReactMarkdown>` without it being in type options.
- **API Error Handling**: API routes currently return inconsistent error structures (e.g., `{ error: "message" }`) instead of the required `{ ok: false, code, message }` format.
- **AI Validation**: Zod parsing is present but unhandled. If generation fails to parse, it will crash the API route instead of retrying with the error appended or returning a fallback.
- **Synchronous AI Operations**: All AI generation and document chunking occurs synchronously within the API request lifecycle. Large PDFs will easily trigger a 504 Gateway Timeout.
- **Missing Infrastructure**:
  - No `aiProvider` abstraction (currently locked strictly to Gemini Cloud).
  - No background job polling model.
  - No AI response caching.
  - No global error boundary or toast notification system.
  - Missing proper authorization checks on many API routes (users can potentially touch data they do not own, though some checks are partially implemented).

## 4. Refactoring Strategy
- **Preserve**: The existing Next.js App Router structure, Tailwind styles, Zod schema definitions (`src/lib/zod-schemas.ts`), and basic Firestore interaction logic.
- **Refactor**: 
  - `src/lib/gemini.ts` will be replaced/wrapped by a new `src/lib/aiProvider.ts` that implements the local/cloud routing logic.
  - API routes will be rewritten to use a standard wrapper for auth checks, error formatting, and input validation.
  - Synchronous API tasks (like PDF upload) will be refactored into a `Job` pattern.
- **Add**: 
  - Global UI components (Toasts, Error Boundaries).
  - New modules for the missing features (Co-Reader, PYQ Analyzer).
