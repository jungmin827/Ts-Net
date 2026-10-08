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

/**
 * 후기 제출 스키마.
 *
 * ── 받지 않는 것 ────────────────────────────────────────────────
 * **작성자 이름을 받지 않는다.** 레퍼런스(인터넷다모아)도 작성자 입력란이
 * 없다(전부 `익명`). 개인정보를 한 종류라도 덜 받는 쪽이 항상 안전하고,
 * 후기의 신뢰는 이름이 아니라 "실제 가입자가 썼다" 는 경로에서 나온다.
 * 받지 않으면 마스킹할 것도, 유출될 것도 없다.
 *
 * **수정용 비밀번호도 받지 않는다.** 받으면 보관·검증해야 하고, 재사용
 * 비밀번호가 들어오면 그 자체가 유출 리스크다. 수정이 필요하면 운영자에게
 * 요청하는 쪽이 받는 정보가 더 적다.
 *
 * **이미지도 받지 않는다.** 업로드를 열면 Storage 정책·용량·악성 파일
 * 검사까지 따라오고, 그걸 anon 에게 여는 결정은 따로 해야 한다.
 * 운영자가 어드민에서 `thumbnail_url` 을 채울 수는 있다.
 *
 * 길이 하한은 **DB 제약과 같은 값**이다(008). 한쪽만 고치면 통과한 입력이
 * DB 에서 거부되어 사용자에게 "접수 실패" 만 보인다.
 */
export const reviewSubmitSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "제목을 2자 이상 입력해 주세요")
    .max(200, "제목은 200자까지 입력할 수 있습니다"),
  content: z
    .string()
    .trim()
    .min(10, "내용을 10자 이상 입력해 주세요")
    .max(4000, "내용은 4000자까지 입력할 수 있습니다"),
  // 평점은 **선택**이다. 안 남기면 별을 그리지 않는다 (`Stars` 가 null 을
  // 만점으로 바꿔 그리던 버그를 고친 뒤의 계약이다).
  rating: z.coerce.number().int().min(1).max(5).optional(),
  carrier: z.enum(CARRIERS).optional(),
  turnstileToken: z.string().min(1, "보안 검증이 필요합니다"),
});

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;
