const BOT_TOKEN = () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
};

const BASE = () => `https://api.telegram.org/bot${BOT_TOKEN()}`;

export async function sendMessage(
  chatId: string | number,
  text: string
): Promise<void> {
  const res = await fetch(`${BASE()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      // Prevent Telegram from generating link previews for query responses
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Telegram sendMessage failed:", body);
  }
}

export async function getFileInfo(
  fileId: string
): Promise<{ file_path: string; file_size?: number }> {
  const res = await fetch(`${BASE()}/getFile?file_id=${fileId}`);
  const json = (await res.json()) as {
    ok: boolean;
    result?: { file_path: string; file_size?: number };
    description?: string;
  };
  if (!json.ok || !json.result) {
    throw new Error(`Telegram getFile failed: ${json.description ?? "unknown"}`);
  }
  return json.result;
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN()}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`File download failed: HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}
