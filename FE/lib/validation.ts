import { z } from "zod";

export const CARRIERS = ["KT", "SK", "LG", "SKYLIFE"] as const;
export type Carrier = (typeof CARRIERS)[number];

// 관심상품 허용 목록. 운영 중 상품 구성이 바뀌면 여기만 수정
export const PRODUCTS = [
  "인터넷",
  "TV",
  "인터넷+TV",
  "인터넷+TV+휴대폰",
] as const;

/** POST /api/leads 요청 본문. 클라이언트 검증만 믿지 않는다 — 서버에서 반드시 재검증 */
export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[가-힣a-zA-Z]{2,20}$/, "이름은 한글/영문 2~20자로 입력해 주세요"),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .regex(/^010\d{7,8}$/, "010으로 시작하는 휴대폰 번호를 입력해 주세요"),
    ),
  carrier: z.enum(CARRIERS).optional(),
  product: z.enum(PRODUCTS).optional(),
  memo: z.string().max(500).optional(),
  consent_privacy: z.literal(true), // 개인정보 수집·이용 동의 — 필수
  consent_marketing: z.boolean().default(false), // 마케팅 수신 동의 — 선택. 개인정보 동의와 체크박스 분리 필수
  turnstileToken: z.string().min(1),
  // honeypot — 봇이 채우는 숨김 필드. 값이 있으면 200 반환 후 조용히 폐기
  website: z.literal("").optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
