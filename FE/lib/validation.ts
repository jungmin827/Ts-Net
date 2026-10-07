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
  // 개인정보 수집·이용 동의 — 필수.
  // 메시지를 지정하지 않으면 zod 기본 문구("Invalid input: expected true")가
  // 그대로 사용자에게 노출된다. 한국어 UI 규칙 위반이자 무슨 뜻인지도 알 수 없다.
  consent_privacy: z.literal(true, {
    message: "개인정보 수집·이용에 동의해 주세요",
  }),
  consent_marketing: z.boolean().default(false), // 마케팅 수신 동의 — 선택. 개인정보 동의와 체크박스 분리 필수
  turnstileToken: z.string().min(1),
  // honeypot — 봇이 채우는 숨김 필드. 값이 있으면 200 반환 후 조용히 폐기
  website: z.literal("").optional(),

  // 유입 추적 — 폼 컴포넌트가 URL 쿼리에서 수집해 전달 (광고비 손익 판단 근거)
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
  landing_path: z.string().max(255).optional(),
  referrer: z.string().max(2000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
