export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 100
): { text: string; startIndex: number }[] {
  const chunks: { text: string; startIndex: number }[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);

    if (chunkText.trim().length > 0) {
      chunks.push({ text: chunkText.trim(), startIndex: start });
    }

    if (end >= text.length) break;
    start = end - overlap;
  }

  return chunks;
}

export function extractPagesFromText(text: string): { pageNumber: number; text: string }[] {
  const pagePattern = /---PAGE_BREAK---/g;
  const pages: { pageNumber: number; text: string }[] = [];
  const parts = text.split(pagePattern);

  parts.forEach((part, index) => {
    if (part.trim().length > 0) {
      pages.push({ pageNumber: index + 1, text: part.trim() });
    }
  });

  if (pages.length === 0 && text.trim().length > 0) {
    pages.push({ pageNumber: 1, text: text.trim() });
  }

  return pages;
}

export function chunkPages(
  pages: { pageNumber: number; text: string }[],
  chunkSize: number = 800,
  overlap: number = 100
): { text: string; pageNumber: number; chunkIndex: number }[] {
  const allChunks: { text: string; pageNumber: number; chunkIndex: number }[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const chunks = chunkText(page.text, chunkSize, overlap);
    for (const chunk of chunks) {
      allChunks.push({
        text: chunk.text,
        pageNumber: page.pageNumber,
        chunkIndex: globalIndex++,
      });
    }
  }

  return allChunks;
}
