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

  benefits: [
    {
      title: "빠른 상담 연결",
      lines: ["접수 확인 후 순차적으로", "전화 상담을 진행합니다", "영업시간 내 신속 안내"],
    },
    {
      title: "통신사 조건 비교",
      lines: ["KT·SK·LG·스카이라이프", "요금제와 약정 조건을", "한 번에 비교해 드립니다"],
    },
    {
      title: "명확한 사은품 안내",
      lines: ["지급 조건과 절차를", "상담 시 명확히 안내하고", "진행 상태를 확인해 드립니다"],
    },
    {
      title: "개인정보 보호",
      lines: ["연락처는 암호화 저장하며", "보유기간이 지나면", "자동 파기됩니다"],
    },
  ],

  processSteps: [
    { title: "상담 신청", desc: "이름·연락처 접수" },
    { title: "전화 상담", desc: "조건 비교 안내" },
    { title: "통신사 접수", desc: "가입 신청 진행" },
    { title: "설치", desc: "기사 방문 설치" },
    { title: "사은품 지급", desc: "설치 확인 후 지급" },
  ],
} as const;

export const CARRIER_MENU = [
  { slug: "kt", code: "KT", label: "KT" },
  { slug: "sk", code: "SK", label: "SK브로드밴드" },
  { slug: "lg", code: "LG", label: "LG유플러스" },
  { slug: "skylife", code: "SKYLIFE", label: "KT스카이라이프" },
] as const;

/** 통신사 코드 → 뱃지 배경 클래스 (globals.css 토큰) */
export const CARRIER_COLOR: Record<string, string> = {
  KT: "bg-carrier-kt",
  SK: "bg-carrier-sk",
  LG: "bg-carrier-lg",
  SKYLIFE: "bg-carrier-skylife",
};
