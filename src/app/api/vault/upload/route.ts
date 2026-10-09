import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/serverAuth";
import { chunkPages } from "@/lib/chunker";
import { embedTexts } from "@/lib/aiProvider";
import { createVaultDocument, saveVaultChunks } from "@/lib/firestore";

/** Embedding a full document can take a while; give it room on serverless hosts. */
export const maxDuration = 60;

interface IngestBody {
  fileName?: unknown;
  pageCount?: unknown;
  folderId?: unknown;
  type?: unknown;
  pages?: unknown;
}

/**
 * Receives a document's text, already read in the browser (so large PDFs and PowerPoints never hit the
 * serverless request-size limit), then chunks, embeds and stores it. The file itself is stored by the browser.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as IngestBody;

    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "";
    const pages = (Array.isArray(body.pages) ? body.pages : [])
      .filter((p): p is { pageNumber: number; text: string } => !!p && typeof p.pageNumber === "number" && typeof p.text === "string")
      .map((p) => ({ pageNumber: p.pageNumber, text: p.text.slice(0, 20_000) }))
      .slice(0, 600);
    if (!fileName || pages.length === 0) return NextResponse.json({ error: "No readable text was found in this file." }, { status: 400 });

    const total = pages.reduce((n, p) => n + p.text.length, 0);
    if (total < 50) {
      return NextResponse.json(
        { error: "This file has no selectable text (it looks like scanned images). Please upload a text-searchable version." },
        { status: 400 }
      );
    }

    // Cap the number of chunks to keep embedding cost and time bounded.
    const chunks = chunkPages(pages, 800, 100).slice(0, 100);
    const embeddings = await embedTexts(chunks.map((c) => c.text));

    const vaultId = await createVaultDocument({
      userId: user.uid,
      fileName,
      folderId: typeof body.folderId === "string" && body.folderId ? body.folderId : undefined,
      type: body.type === "paper" ? "paper" : "content",
      pageCount: typeof body.pageCount === "number" ? body.pageCount : pages.length,
      chunkCount: chunks.length,
      uploadedAt: Date.now(),
    });
    await saveVaultChunks(
      vaultId,
      chunks.map((chunk, i) => ({
        vaultId,
        userId: user.uid,
        text: chunk.text,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        embedding: embeddings[i],
      }))
    );

    return NextResponse.json({ vaultId, fileName, pageCount: pages.length, chunkCount: chunks.length });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Vault ingest error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
