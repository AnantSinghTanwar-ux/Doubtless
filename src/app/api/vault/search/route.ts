import { NextRequest, NextResponse } from "next/server";
import { searchVault } from "@/lib/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { query, vaultId, fileName, topK } = await request.json();

    if (!query || !vaultId || !fileName) {
      return NextResponse.json({ error: "query, vaultId, and fileName are required" }, { status: 400 });
    }

    const chunks = await searchVault(query, vaultId, fileName, topK ?? 5);

    return NextResponse.json({ chunks });
  } catch (error) {
    console.error("Vault search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
