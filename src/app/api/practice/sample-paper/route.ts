import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/aiProvider";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const { vaultIds } = await request.json();

    if (!vaultIds || !Array.isArray(vaultIds) || vaultIds.length === 0) {
      return NextResponse.json({ error: "No vaults selected" }, { status: 400 });
    }

    // Fetch chunks for the selected vaults
    let allText = "";
    
    for (const vaultId of vaultIds) {
      const chunksRef = collection(db, `vaults/${vaultId}/chunks`);
      // Since it's a hackathon and we want to sample, let's just grab the first 30 chunks per vault
      // (To avoid blowing up the context window completely)
      const chunkQuery = query(chunksRef);
      const snapshot = await getDocs(chunkQuery);
      
      let chunkCount = 0;
      snapshot.forEach((doc) => {
        if (chunkCount < 30) {
          allText += `\n\n[Vault ${vaultId}]:\n${doc.data().text}`;
          chunkCount++;
        }
      });
    }

    const systemPrompt = `You are an expert exam setter. The user has provided you with content from previous year papers or study materials.
Your task is to analyze these materials and generate a highly probable, well-structured "Sample Paper".
The sample paper should include:
1. Very Short Answer Questions (1-2 marks)
2. Short Answer Questions (3-5 marks)
3. Long Answer/Essay Questions (10+ marks)

Include a brief "Important Topics Identified" section at the top.
Format the entire response nicely in Markdown.`;

    const prompt = `Here are the reference materials (Previous Year Papers / Notes):
${allText}

Please generate the complete sample paper now.`;

    const paper = await generateText(prompt, systemPrompt);

    return NextResponse.json({ paper });
  } catch (error) {
    console.error("Sample paper error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate paper" },
      { status: 500 }
    );
  }
}
