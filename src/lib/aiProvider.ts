import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "placeholder_for_build";
const genai = new GoogleGenAI({ apiKey });

export function getModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-pro";
}

export function getEmbedModel() {
  return process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
}

const useLocalProvider = process.env.AI_PROVIDER === "ollama";
const localProviderUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
const ollamaEmbedModel = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL || "llava";

export async function generateJSON<T>(prompt: string, systemPrompt?: string, useHighEnd?: boolean): Promise<T> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

  if (useHighEnd && openRouterKey) {
    console.log(`[aiProvider] Routing to OpenRouter API (${openRouterModel}) for high-end task`);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    try {
      return JSON.parse(content) as T;
    } catch (err) {
      console.error("OpenRouter JSON Parse Error:", content);
      throw new Error("OpenRouter returned invalid JSON");
    }
  }

  if (useLocalProvider) {
    console.log(`[aiProvider] Routing to local Ollama API (${ollamaModel}) at ${localProviderUrl}`);
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        system: systemPrompt,
        format: "json",
        stream: false,
        options: { num_ctx: 16384 },
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama error ${res.status}: ${errorText}`);
    }
    const data = await res.json();
    try {
      return JSON.parse(data.response) as T;
    } catch (err) {
      console.error("Ollama JSON Parse Error:", data.response);
      throw new Error("Ollama returned invalid JSON");
    }
  }

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
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("AI JSON Parse Error:", text);
    throw new Error("AI returned invalid JSON");
  }
}

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  if (useLocalProvider) {
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        system: systemPrompt,
        stream: false,
        options: { num_ctx: 16384 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  }

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
  if (useLocalProvider) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const res = await fetch(`${localProviderUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaVisionModel,
        prompt,
        system: systemPrompt,
        images: [base64Data],
        stream: false,
        format: "json",
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.response;
  }

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
  if (useLocalProvider) {
    const res = await fetch(`${localProviderUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaEmbedModel,
        prompt: text,
      }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error: ${res.statusText}`);
    const data = await res.json();
    return data.embedding;
  }

  const model = getEmbedModel();
  const response = await genai.models.embedContent({
    model,
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }
  return results;
}
