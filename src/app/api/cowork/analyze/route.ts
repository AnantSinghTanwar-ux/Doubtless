import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/aiProvider";
import { searchFolderPastPapers, formatChunksForPrompt } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { text, folderId } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    let pyqContext = "";
    if (folderId) {
       // Search for similar chunks in the past papers folder
       const pyqChunks = await searchFolderPastPapers(text, folderId, 3);
       if (pyqChunks.length > 0) {
          pyqContext = `\n\n### PAST PAPERS CONTEXT (Use this to strictly generate the PYQs section!):\n${formatChunksForPrompt(pyqChunks)}`;
       }
    }

    const systemPrompt = `You are an AI study assistant acting in "CoWork" mode for a student preparing for exams.
The user is reading a page from a textbook or presentation.
Your goal is to provide a companion guide for this exact text, emphasizing exam preparation.

Return a JSON object with:
1. "summary": A Markdown string containing exactly this structure:
   ### 📝 Summary & Important Points
   - (2-3 sentences of summary)
   - (bullet points of crucial terms)

   ### ❓ Practice Questions
   - **Q:** (Multiple choice question based on text)
     - A) ...
     - B) ...
     - C) ...
     - D) ...
     **Ans:** (Correct option and brief reason)

   ### 📜 Previous Year Questions (PYQs)
   (Only include this section if the text contains topics heavily tested in standard university exams. If PAST PAPERS CONTEXT is provided, base your PYQs strongly on that context. If not, state "No PYQs found for this specific page's content.")
   - **Q:** (Highly repeated university exam question on this topic)
     **A:** (Answer)

2. "highlightKeyword": A short, EXACT 3-5 word phrase from the text that represents the most important concept. This MUST exist exactly in the text so we can highlight it natively in the PDF.

CRITICAL FORMATTING RULES:
- The "summary" string MUST contain standard Markdown (using #, -, and **).
- DO NOT generate Markdown Tables (no | characters). Use standard text.
- Use explicit newlines (\n) for formatting.
Only output valid JSON.`;

    const prompt = `Here is the document text to analyze:\n\n${text}${pyqContext}`;

    const result = await generateJSON<{ summary: string; highlightKeyword: string }>(prompt, systemPrompt, true);

    return NextResponse.json({ summary: result.summary, highlightKeyword: result.highlightKeyword });
  } catch (error) {
    console.error("CoWork analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze text" },
      { status: 500 }
    );
  }
}
