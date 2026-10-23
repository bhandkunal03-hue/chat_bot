import type { Attachment, Message, ModelInfo } from "../types/chat";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function headers(apiKey?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-Groq-API-Key": apiKey } : {}),
  };
}

async function responseError(response: Response): Promise<ApiError> {
  let message = "Something went wrong. Please try again.";
  let code = "request_failed";
  try {
    const body = await response.json();
    message = body?.detail?.message || message;
    code = body?.detail?.code || code;
  } catch {
    if (!response.ok) message = `Request failed (${response.status}).`;
  }
  return new ApiError(message, code, response.status);
}

export async function getModels(apiKey?: string): Promise<{ models: ModelInfo[]; verified: boolean; default_model?: string }> {
  const response = await fetch(`${API_BASE}/api/models`, { headers: headers(apiKey) });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<{ models: ModelInfo[]; verified: boolean; default_model?: string }>;
}

export async function testConnection(apiKey: string, model: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/chat/test-connection`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ model }),
  });
  if (!response.ok) throw await responseError(response);
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  messages: Message[];
  signal: AbortSignal;
  onText: (text: string) => void;
  systemPrompt?: string;
  temperature?: number;
}

function apiMessage(message: Message, selectedImages: Set<Attachment>) {
  return {
    role: message.role,
    content: message.content,
    attachments: (message.attachments ?? [])
      .filter((attachment): attachment is Attachment & { data_url: string } =>
        Boolean(attachment.data_url) && selectedImages.has(attachment),
      )
      .map(({ name, mime_type, data_url }) => ({ name, mime_type, data_url })),
  };
}

export async function streamChat(options: ChatOptions): Promise<void> {
  const recentMessages = options.messages
    .filter((message) => message.role === "user" || message.content.trim().length > 0)
    .slice(-20);
  let imagesRemaining = 4;
  const selectedImages = new Set<Attachment>();
  for (const message of [...recentMessages].reverse()) {
    for (const attachment of [...(message.attachments ?? [])].reverse()) {
      if (!attachment.data_url || imagesRemaining <= 0) continue;
      selectedImages.add(attachment);
      imagesRemaining -= 1;
    }
  }
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: headers(options.apiKey),
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      messages: recentMessages.map((message) => apiMessage(message, selectedImages)),
      system_prompt: options.systemPrompt || "",
      temperature: options.temperature ?? 0.7,
      max_tokens: 2048,
    }),
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new ApiError("The server did not start a response stream.", "empty_stream", 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as { text?: string; error?: string; code?: string };
        if (parsed.error) throw new ApiError(parsed.error, parsed.code ?? "provider_error", 502);
        if (parsed.text) options.onText(parsed.text);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
