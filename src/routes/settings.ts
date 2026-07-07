import { Router } from "express";
import { db, getSettings } from "../db";
import { decrypt, encrypt } from "../crypto";

export const settingsRouter = Router();

function mask(value: string | null, keepEnd = 4): string | null {
  if (!value) return null;
  try {
    const plain = decrypt(value);
    if (plain.length <= keepEnd) return "*".repeat(plain.length);
    return "*".repeat(plain.length - keepEnd) + plain.slice(-keepEnd);
  } catch {
    return "(복호화 실패)";
  }
}

settingsRouter.get("/settings", (_req, res) => {
  const s = getSettings();
  res.json({
    korailId: mask(s.korail_id_enc, 2),
    hasKorailAccount: !!(s.korail_id_enc && s.korail_pw_enc),
    cardNumber: mask(s.card_number_enc, 4),
    hasPayment: !!(s.card_number_enc && s.card_expiry_enc && s.card_birth_enc && s.card_password_enc),
    telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  });
});

settingsRouter.post("/settings/korail-account", (req, res) => {
  const { id, password } = req.body ?? {};
  if (typeof id !== "string" || typeof password !== "string" || !id || !password) {
    return res.status(400).json({ ok: false, error: "id/password가 필요합니다." });
  }
  db.prepare(
    `UPDATE settings SET korail_id_enc = ?, korail_pw_enc = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(encrypt(id), encrypt(password));
  res.json({ ok: true });
});

settingsRouter.post("/settings/payment", (req, res) => {
  const { cardNumber, expiry, birthOrBizNo, cardPassword } = req.body ?? {};
  if (![cardNumber, expiry, birthOrBizNo, cardPassword].every((v) => typeof v === "string" && v.length > 0)) {
    return res.status(400).json({ ok: false, error: "카드 정보가 누락되었습니다." });
  }
  db.prepare(
    `UPDATE settings SET card_number_enc = ?, card_expiry_enc = ?, card_birth_enc = ?, card_password_enc = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(encrypt(cardNumber), encrypt(expiry), encrypt(birthOrBizNo), encrypt(cardPassword));
  res.json({ ok: true });
});

settingsRouter.delete("/settings/payment", (_req, res) => {
  db.prepare(
    `UPDATE settings SET card_number_enc = NULL, card_expiry_enc = NULL, card_birth_enc = NULL, card_password_enc = NULL WHERE id = 1`
  ).run();
  res.json({ ok: true });
});
