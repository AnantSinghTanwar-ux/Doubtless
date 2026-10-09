import { currentUser, withUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";
import { searchUserVaults, searchVault } from "@/lib/embeddings";

/**
 * Retrieval for a question. With vaultId + fileName it searches that one document (as before). With scope "all" it
 * searches every document the signed-in student uploaded (the selected one preferred). The student is taken from their verified ID token, never from the body.
 */
async function handlePost(request: NextRequest) {
  try {
    const { query, vaultId, fileName, topK, scope } = await request.json();
    if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

    if (scope === "all") {
      const { uid } = currentUser();
      if (uid === "anonymous") return NextResponse.json({ error: "Sign in to search your notes" }, { status: 401 });
      const chunks = await searchUserVaults(query, uid, { preferVaultId: vaultId, topK: topK ?? 5 });
      return NextResponse.json({ chunks });
    }

    if (!vaultId || !fileName) {
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

/** Tracks the AI cost of each request (see src/lib/usage.ts). */
export const POST = withUsage("vault.search", handlePost);
