import { NextRequest, NextResponse } from "next/server";
import { chunkPages, extractPagesFromText } from "@/lib/chunker";
import { embedTexts } from "@/lib/aiProvider";
import { createVaultDocument, saveVaultChunks, createJob, updateJob } from "@/lib/firestore";

async function processPdf(fileBuffer: Buffer, fileName: string, userId: string, folderId: string | null, type: string | null, jobId?: string) {
  try {
    const pdfParse = require("pdf-parse");

    const render_page = (pageData: any) => {
      let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
      return pageData.getTextContent(render_options).then(function (textContent: any) {
        let lastY, text = "";
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
        }
        return text + "\n\n---PAGE_BREAK---\n\n";
      });
    };

    const parsed = await pdfParse(fileBuffer, { pagerender: render_page });

    if (!parsed.text || parsed.text.trim().length < 50) {
      throw new Error("This PDF appears to be a scanned document without selectable text. Please upload a text-searchable PDF, or wait for the upcoming OCR feature.");
    }

    const pages = extractPagesFromText(parsed.text);
    // Limit to 100 chunks to prevent API exhaustion
    const chunks = chunkPages(pages, 800, 100).slice(0, 100);

    if (chunks.length === 0) {
      throw new Error("No text content found in PDF after processing");
    }

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);

    const vaultId = await createVaultDocument({
      userId,
      fileName,
      folderId: folderId || undefined,
      type: (type as "content" | "paper") || undefined,
      pageCount: parsed.numpages ?? pages.length,
      chunkCount: chunks.length,
      uploadedAt: Date.now(),
    });

    const chunkDocs = chunks.map((chunk, i) => ({
      vaultId,
      userId,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      embedding: embeddings[i],
    }));

    await saveVaultChunks(vaultId, chunkDocs);

    // Save the actual PDF file for CoWork rendering
    const fs = require("fs");
    const path = require("path");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, `${vaultId}.pdf`), fileBuffer);

    if (jobId) {
      await updateJob(jobId, { status: "completed", result: { vaultId, chunkCount: chunks.length } });
    }

    return { vaultId, chunkCount: chunks.length, pageCount: parsed.numpages ?? pages.length };
  } catch (error) {
    if (jobId) {
      await updateJob(jobId, { status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;
    const folderId = formData.get("folderId") as string | null;
    const type = formData.get("type") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "File and userId are required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.size > 1024 * 1024) {
      // Async Background Job for > 1MB
      const jobId = await createJob({
        userId,
        type: "pdf_ingestion",
        status: "processing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      processPdf(buffer, file.name, userId, folderId, type, jobId).catch(console.error);

      return NextResponse.json({ jobId, message: "Processing in background" });
    } else {
      // Sync processing
      const result = await processPdf(buffer, file.name, userId, folderId, type);
      return NextResponse.json({
        vaultId: result.vaultId,
        fileName: file.name,
        pageCount: result.pageCount,
        chunkCount: result.chunkCount,
      });
    }
  } catch (error) {
    console.error("Vault upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
