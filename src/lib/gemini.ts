import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genai = new GoogleGenAI({ apiKey });

export function getModel() {
  const modelName = process.env.GEMINI_MODEL;
  if (!modelName) throw new Error("GEMINI_MODEL environment variable is required");
  return modelName;
}

export function getEmbedModel() {
  const modelName = process.env.GEMINI_EMBED_MODEL;
  if (!modelName) throw new Error("GEMINI_EMBED_MODEL environment variable is required");
  return modelName;
}

export async function generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });
  const text = response.text ?? "";
  return JSON.parse(text) as T;
}

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });
  return response.text ?? "";
}

export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  systemPrompt?: string
): Promise<string> {
  const model = getModel();
  const response = await genai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });
  return response.text ?? "";
}

export async function embedText(text: string): Promise<number[]> {
  const model = getEmbedModel();
  const response = await genai.models.embedContent({
    model,
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }
  return results;
}
