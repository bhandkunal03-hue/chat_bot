import type { Conversation, Message, Theme } from "../types/chat";

const CONVERSATIONS_KEY = "nexora.conversations.v1";
const THEME_KEY = "nexora.theme.v1";

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Record<string, unknown>;
  return typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.updatedAt === "number" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every((item) => {
      if (!item || typeof item !== "object") return false;
      const message = item as Record<string, unknown>;
      return typeof message.id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        typeof message.createdAt === "number" &&
        (message.attachments === undefined || (
          Array.isArray(message.attachments) &&
          message.attachments.every((attachment) =>
            attachment && typeof attachment === "object" &&
            typeof attachment.name === "string" &&
            ["image/png", "image/jpeg", "image/webp"].includes(attachment.mime_type),
          )
        ));
    });
}

export function loadConversations(): Conversation[] {
  const serialized = localStorage.getItem(CONVERSATIONS_KEY);
  if (!serialized) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new Error("Saved conversations have an invalid format.");
  return parsed.filter(isConversation);
}

function persistedMessage(message: Message): Message {
  return {
    ...message,
    attachments: message.attachments?.map(({ name, mime_type }) => ({ name, mime_type })),
  };
}

export function saveConversations(conversations: Conversation[]) {
  const safe = conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map(persistedMessage),
  }));
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(safe));
}

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
}
