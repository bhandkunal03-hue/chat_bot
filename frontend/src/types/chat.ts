export type Role = "user" | "assistant";

export interface Attachment {
  name: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  data_url?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  createdAt: number;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  vision: boolean;
}

export type Theme = "dark" | "light";
