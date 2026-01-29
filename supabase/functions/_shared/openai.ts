const OPENAI_API_URL = "https://api.openai.com/v1/responses";

interface StructuredOutputRequest {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  temperature?: number;
  max_output_tokens?: number;
}

export async function createStructuredOutput<T>({
  model,
  system,
  user,
  schema,
  temperature = 0.2,
  max_output_tokens = 1200,
}: StructuredOutputRequest): Promise<T> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const payload = {
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: {
        type: "json_schema",
        strict: true,
        schema,
      },
    },
    temperature,
    max_output_tokens,
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? "OpenAI API request failed";
    throw new Error(message);
  }

  const outputText = extractOutputText(data);
  return JSON.parse(outputText) as T;
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
      if (part?.type === "refusal") {
        throw new Error("Model refusal");
      }
    }
  }

  if (!chunks.length) {
    throw new Error("No output text found in OpenAI response");
  }

  return chunks.join("");
}
