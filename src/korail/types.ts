export interface KorailCredentials {
  id: string;
  password: string;
}

export interface PaymentInfo {
  cardNumber: string;
  expiry: string; // YYMM
  birthOrBizNo: string; // 생년월일(6자리) 또는 사업자등록번호
  cardPassword: string; // 카드 비밀번호 앞 2자리
}

export interface SearchCriteria {
  depStation: string;
  arrStation: string;
  travelDate: string; // YYYYMMDD
  timeFrom: string; // HHMMSS
  timeTo: string; // HHMMSS
  trainType: "ktx" | "all";
  passengerCount: number;
  seatType: "general" | "first" | "any";
}

export interface AvailableTrain {
  trainNo: string;
  depTime: string;
  arrTime: string;
  rowIndex: number;
}

export type AttemptOutcome =
  | { kind: "no_seat" }
  | { kind: "captcha_blocked"; trainNo: string }
  | { kind: "reserved_only"; trainNo: string; reason: string }
  | { kind: "paid"; trainNo: string }
  | { kind: "error"; message: string };
