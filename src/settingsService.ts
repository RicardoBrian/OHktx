import { getSettings } from "./db";
import { decrypt } from "./crypto";
import { KorailCredentials, PaymentInfo } from "./korail/types";

export function getDecryptedCredentials(): KorailCredentials | null {
  const s = getSettings();
  if (!s.korail_id_enc || !s.korail_pw_enc) return null;
  return { id: decrypt(s.korail_id_enc), password: decrypt(s.korail_pw_enc) };
}

export function getDecryptedPayment(): PaymentInfo | null {
  const s = getSettings();
  if (!s.card_number_enc || !s.card_expiry_enc || !s.card_birth_enc || !s.card_password_enc) return null;
  return {
    cardNumber: decrypt(s.card_number_enc),
    expiry: decrypt(s.card_expiry_enc),
    birthOrBizNo: decrypt(s.card_birth_enc),
    cardPassword: decrypt(s.card_password_enc),
  };
}
