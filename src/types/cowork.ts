export type HighlightKind = "important" | "definition" | "formula" | "keyword";

export interface PageHighlight {
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 relative to the page. [0,0,0,0] until a quote has been located. */
  box: [number, number, number, number];
  /** Exact words from the page's text layer. The browser finds them in the PDF to get precise positions. */
  quote?: string;
  kind: HighlightKind;
  /** Short callout text, e.g. "Exam favourite". */
  label: string;
}

export interface Formula {
  name: string;
  formula: string;
  note?: string;
  page?: number;
}

export interface PageAnalysis {
  title: string;
  summary: string;
  keyPoints: string[];
  formulas: Formula[];
  practice: { question: string; options: string[]; answer: number; explanation: string }[];
  examTip: string;
  highlights: PageHighlight[];
  /** False for title slides, blank or index pages. */
  hasContent: boolean;
}

export interface DocumentOverview {
  subject: string;
  isQuantitative: boolean;
  overview: string;
  topics: { name: string; pages: number[]; importance: "high" | "medium" | "low"; summary: string }[];
  formulas: Formula[];
  importantQuestions: { question: string; answer: string; topic: string; pages: number[]; priority: "high" | "medium" }[];
  pyqs: { topic: string; questions: { question: string; marks?: number; source: "past_paper" | "common" }[] }[];
  hasPastPapers: boolean;
  /** How many of the document's pages the guide was built from (it is rebuilt as more pages are read). */
  coverage?: { pages: number; total: number };
}

/** One page sent to the overview endpoint: its text if it has a text layer, else a small image. */
export type OverviewPageInput = { page: number; text: string } | { page: number; image: string };
