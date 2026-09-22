// 사이트 전역 설정값 — 카피·사업자 정보의 단일 출처.
// 과장 광고 문구(보상률·최대 지원금 등)는 코드에 하드코딩하지 않고 여기서만 관리한다.
// TODO 항목은 사업자 정보 확정 후 실제 값으로 교체할 것 (런칭 전 체크리스트).

export const SITE = {
  name: "TS넷",
  tel: process.env.NEXT_PUBLIC_TEL || "1600-0000", // TODO: 대표번호 확정

  business: {
    companyName: "TODO 상호",
    ceo: "TODO 대표자",
    bizRegNo: "TODO 사업자등록번호",
    telecomReportNo: "TODO 부가통신사업 신고번호",
    mailOrderNo: "TODO 통신판매업 신고번호",
    address: "TODO 주소",
  },

  hero: {
    headline: "인터넷·TV 가입, 통신사별 조건 비교하고 신청하세요",
    sub: "KT · SK · LG · KT스카이라이프 상품 조건을 비교해 안내해 드립니다",
    cta: "상담 신청하기",
  },

  // icon 값은 components/ui/Icon.tsx 의 IconName 과 일치해야 한다
  benefits: [
    {
      icon: "bolt",
      title: "빠른 상담 연결",
      lines: ["접수 확인 후 순차적으로", "전화 상담을 진행합니다", "영업시간 내 신속 안내"],
    },
    {
      icon: "compare",
      title: "통신사 조건 비교",
      lines: ["KT·SK·LG·스카이라이프", "요금제와 약정 조건을", "한 번에 비교해 드립니다"],
    },
    {
      icon: "gift",
      title: "명확한 사은품 안내",
      lines: ["지급 조건과 절차를", "상담 시 명확히 안내하고", "진행 상태를 확인해 드립니다"],
    },
    {
      icon: "shield",
      title: "개인정보 보호",
      lines: ["연락처는 암호화 저장하며", "보유기간이 지나면", "자동 파기됩니다"],
    },
  ],

  processSteps: [
    { icon: "chat", title: "상담 신청", desc: "이름·연락처 접수" },
    { icon: "clipboard", title: "전화 상담", desc: "조건 비교 안내" },
    { icon: "calendar", title: "통신사 접수", desc: "가입 신청 진행" },
    { icon: "wrench", title: "설치", desc: "기사 방문 설치" },
    { icon: "wallet", title: "사은품 지급", desc: "설치 확인 후 지급" },
  ],
} as const;

// 통신사 4사 — 메뉴·서브페이지 라우팅·브랜드 컬러의 단일 출처.
// colorVar 는 globals.css 의 통신사 토큰을 가리킨다 (서브 히어로 그라데이션에 사용).
export const CARRIER_MENU = [
  {
    slug: "kt",
    code: "KT",
    label: "KT",
    fullLabel: "KT 인터넷·IPTV",
    colorVar: "--carrier-kt",
    tagline: "전국 커버리지와 안정적인 품질",
  },
  {
    slug: "sk",
    code: "SK",
    label: "SK브로드밴드",
    fullLabel: "SK브로드밴드 인터넷·IPTV",
    colorVar: "--carrier-sk",
    tagline: "결합 구성에 강점이 있는 상품군",
  },
  {
    slug: "lg",
    code: "LG",
    label: "LG유플러스",
    fullLabel: "LG유플러스 인터넷·IPTV",
    colorVar: "--carrier-lg",
    tagline: "IPTV 콘텐츠 구성이 다양한 편",
  },
  {
    slug: "skylife",
    code: "SKYLIFE",
    label: "KT스카이라이프",
    fullLabel: "KT스카이라이프 인터넷·TV",
    colorVar: "--carrier-skylife",
    tagline: "위성 기반으로 설치 지역 제약이 적음",
  },
] as const;

export type CarrierMenuItem = (typeof CARRIER_MENU)[number];

/** slug → 통신사 정보. 없는 slug면 undefined (서브페이지에서 notFound 처리) */
export function carrierBySlug(slug: string): CarrierMenuItem | undefined {
  return CARRIER_MENU.find((c) => c.slug === slug);
}

/** 통신사 코드 → 뱃지 배경 클래스 (globals.css 토큰) */
export const CARRIER_COLOR: Record<string, string> = {
  KT: "bg-carrier-kt",
  SK: "bg-carrier-sk",
  LG: "bg-carrier-lg",
  SKYLIFE: "bg-carrier-skylife",
};

/**
 * 동의 문구 — 수집항목·목적·보유기간을 명시해야 한다 (런칭 전 법적 체크리스트).
 * 개인정보(필수)와 마케팅(선택)은 어떤 폼에서도 하나로 묶지 않는다 (CLAUDE.md 규칙 2).
 */
export const CONSENT = {
  privacyLabel: "개인정보 수집·이용 동의",
  privacyInline:
    "개인정보 수집·이용 동의 — 이름·연락처를 상담 목적으로 수집하며 2년 보관 후 파기합니다",
  privacyDetail: [
    "수집 항목: 이름, 연락처",
    "수집 목적: 인터넷·IPTV 가입 상담 및 결과 안내",
    "보유 기간: 수집일로부터 2년. 기간 경과 시 지체 없이 파기합니다",
    "연락처는 암호화해 저장하며, 상담 목적 외로 이용하지 않습니다",
    "동의를 거부하실 수 있으나, 거부 시 상담 신청이 제한됩니다",
  ],
  marketingLabel: "마케팅 정보 수신 동의",
} as const;

/** 요금표 하단 고지 — 표시 금액의 전제를 밝힌다 (표시광고 리스크 방지) */
export const PLAN_DISCLAIMER =
  "표시 금액은 약정·결합·제휴카드 조건에 따라 달라질 수 있으며, 실제 적용 금액과 사은품은 상담 시 안내해 드립니다.";

// 제휴카드 할인 안내 — 카드사별 할인액·실적 조건은 근거자료 확보 후 채운다.
// 숫자를 임의로 적지 않는다 (CLAUDE.md 규칙 6).
export const PARTNER_CARD = {
  title: "제휴카드 할인 안내",
  summary:
    "제휴 신용카드로 통신요금을 자동납부하고 카드사 실적 조건을 충족하면 월 요금이 추가로 할인됩니다.",
  details: [
    "할인 금액과 전월 실적 기준은 카드사·카드 상품별로 다릅니다.",
    "할인은 청구 할인 방식이며, 적용 시점은 카드사 심사 이후입니다.",
    "약정 기간 중 카드 해지·실적 미달 시 할인이 중단될 수 있습니다.",
    "가입 가능한 카드와 정확한 할인 조건은 상담 시 안내해 드립니다.",
  ],
  // TODO: 제휴 카드사 목록과 할인표 확정 후 details 교체 (근거자료 보유 필수)
} as const;
