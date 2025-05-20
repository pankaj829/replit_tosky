export interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
  lastUserMessage?: string; // For retry functionality
}

export interface Suggestion {
  id: number;
  text: string;
  icon:
    | "question-circle"
    | "rocket"
    | "dollar-sign"
    | "file-contract"
    | "paper-plane";
}

export interface ChatSettings {
  model: string;
  maxTokens: number;
  suggestions: Suggestion[];
}

export interface ChatResponse {
  id: string;
  answer: string;
  timestamp: string;
}

export interface StreamChunk {
  id: string;
  type: "start" | "chunk" | "end" | "error";
  content?: string;
  fullContent?: string;
  timestamp?: string;
  error?: string;
}
