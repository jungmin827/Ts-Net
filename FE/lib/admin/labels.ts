// leads 의 상태 코드 ↔ 한국어 라벨. DB check 제약과 값이 1:1로 맞아야 한다.
// (001_init_schema.sql — status / gift_status)

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "RESERVED",
  "INSTALLED",
  "DONE",
  "CANCEL",
  "SPAM",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const GIFT_STATUSES = ["PENDING", "CONFIRMED", "PAID"] as const;
export type GiftStatus = (typeof GIFT_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "신규접수",
  CONTACTED: "상담완료",
  RESERVED: "설치예약",
  INSTALLED: "설치완료",
  DONE: "처리완료",
  CANCEL: "취소",
  SPAM: "스팸",
};

export const GIFT_LABEL: Record<GiftStatus, string> = {
  PENDING: "확인중",
  CONFIRMED: "지급확정",
  PAID: "지급완료",
};

/** 목록 뱃지 색 — 진행 단계가 색의 온도로 읽히도록 */
export const STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: "bg-accent/15 text-accent-ink",
  CONTACTED: "bg-sky-100 text-sky-800",
  RESERVED: "bg-indigo-100 text-indigo-800",
  INSTALLED: "bg-brand-light text-brand-deep",
  DONE: "bg-brand text-white",
  CANCEL: "bg-slate-200 text-slate-600",
  SPAM: "bg-red-100 text-red-700",
};

export const GIFT_BADGE: Record<GiftStatus, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-amber-100 text-amber-800",
  PAID: "bg-brand-light text-brand-deep",
};

export const CARRIER_LABEL: Record<string, string> = {
  KT: "KT",
  SK: "SK브로드밴드",
  LG: "LG U+",
  SKYLIFE: "KT스카이라이프",
};

export function statusLabel(v: string | null): string {
  return v && v in STATUS_LABEL ? STATUS_LABEL[v as LeadStatus] : "-";
}

export function giftLabel(v: string | null): string {
  return v && v in GIFT_LABEL ? GIFT_LABEL[v as GiftStatus] : "-";
}

export function carrierLabel(v: string | null): string {
  return v ? (CARRIER_LABEL[v] ?? v) : "미지정";
}
