import { logEvent } from "./db";

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 텔레그램 미설정이면 인앱 알림만 사용

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!res.ok) {
      console.error("텔레그램 전송 실패:", await res.text());
    }
  } catch (err) {
    console.error("텔레그램 전송 오류:", err);
  }
}

/** 인앱 알림(events 테이블)에 기록하고, 텔레그램이 설정돼 있으면 함께 전송한다. */
export async function notify(level: "info" | "success" | "warn" | "error", message: string, watchId: number | null = null) {
  logEvent(level, message, watchId);
  const prefix = { info: "ℹ️", success: "✅", warn: "⚠️", error: "🚨" }[level];
  await sendTelegram(`${prefix} [OHktx] ${message}`);
}
