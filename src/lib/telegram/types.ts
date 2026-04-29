// Telegram Bot API — only the fields we use

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  caption?: string;
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

// Intent types — mirrors telegram_messages.parsed_intent enum
export type IntentType =
  | "create-task"
  | "update-task"
  | "query"
  | "status-update"
  | "adjust-plan"
  | "adjust-fitness-plan"
  | "general";

export interface ParsedIntent {
  intent: IntentType;
  data: Record<string, unknown>;
  reply?: string; // pre-written reply for "general" intents
}

export interface DomainRow {
  id: string;
  name: string;
  color: string;
  icon: string;
}
