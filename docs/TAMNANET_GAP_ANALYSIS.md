# 탐나넷 ↔ TS-Net UI 품질 갭 분석

작성 2026-10-08. 레퍼런스 `탐나넷`(https://www.tamnanet.com/) 을 요소 단위로 해부하고
현재 TS-Net 코드와 1:1 대조한 문서. **이 문서만 보고 구현에 들어갈 수 있게** 작성했다.

---

## 0. 조사 방법과 자료 등급

| 등급 | 범위 | 출처 |
|---|---|---|
| **1차 (실측)** | 색 면적 가중치, 섹션 13개 픽셀 높이(총 8,819px), 호버 트랜지션 0.22s, 가격차트 말풍선 | 오케스트레이터가 라이브 DOM에서 직접 측정 (1440×1000) |
| **1차 (원본 코드)** | HTML 마크업 전문, CSS 7종 전문, JS 2종, 캐러셀/롤링 초기화 설정, 통신사 서브페이지 전문 | `curl` 직접 취득 — 아래 표 |
| **2차 (과거 관찰)** | 2단 헤더, 단어 교체 홍보 밴드, 우측 스티키 레일 | `docs/PORT_TAMNANET.md`·`docs/UI_PORT_LOG.md` (2026-09-23) |

⚠ **2차 자료는 양쪽 모두 낡았다.** ① 탐나넷 쪽 — 당시 관찰된 "단어 교체 홍보 밴드"가
현행 `main_n.css`·HTML 에 **없다**(§G-06). ② TS-Net 쪽 — 당시 이식한 **2단 헤더가
현재 코드에 없다.** `Header.tsx`(263줄)는 1단 sticky 바이고 신청 CTA 도 제거됐다
(`Header.tsx:125` 주석). 두 문서의 헤더 관련 기술은 전부 과거 기록으로 읽어야 한다 (§10 참조).

취득한 원본 파일 (전부 HTTP 200, 봇 차단·JS 렌더링 장벽 **없음**. 서버사이드 PHP 렌더링):

```
GET /                                  136,698 B
GET /public/product/product.php?cnt_id=2   75,796 B   ← KT올레 상세
GET /public/css/reset.css                2,381 B
GET /public/css/common.css              25,377 B
GET /public/css/main_n.css              37,711 B   ← 현행 메인 전용
GET /public/css/sub.css                 28,744 B   ← 상세페이지
GET /public/css/responsive.css          10,861 B
GET /public/css/sub_responsive.css       3,535 B
GET /public/css/member.css              16,968 B
GET /public/jquery/common.js             6,346 B
GET /public/jquery/quick_apply.js        6,676 B
```

### ⚠ 중요 정정 — "흰색 + 쨍한 녹색"은 사실이 아니다

의뢰 시 전제였던 "탐나넷 = 흰색 + 쨍한 녹색" 구조는 **CSS 실측과 일치하지 않는다.**
탐나넷의 포인트색은 **주황**이다.

- `css_common.css:10` → `--orange-1-color: #ff5a22` (전역 포인트색, `::selection` 색까지 이것)
- `css_main_n.css:16` → `#main { --main-orange: #ff641f; }`
- CTA 버튼 그라데이션 `#ff8b28 → #ff6a15 → #ff4d0c`
- 전체 7개 CSS 파일에서 **녹색 계열 HEX는 단 4개**이며 전부 주변부 용도다:
  - `#03c75a` — 네이버 뱃지 밑줄 1곳 (`main_n.css:35`) = 네이버 브랜드색, 탐나넷 색이 아님
  - `#16a34a` — 가입현황 "가입완료" 상태 **글자색** 1곳 (`main_n.css:164`)
  - `#30a783` — 후기 메타 칩 배경 1곳
  - `#39ad58` — common.css 1곳

즉 **녹색은 탐나넷에서 '상태 표시용 의미색'이고 브랜드색이 아니다.**
우리 `--brand: #2f9e52` 프레시 그린은 CLAUDE.md 확정 사항이므로 그대로 간다.
다만 **"상태=녹색" 관용**과 충돌한다는 점은 아래 G-19에서 별도로 다룬다.

---

## 1. 섹션 구성과 순서

### 탐나넷 (13섹션 / 총 8,819px)

| # | 섹션 | 높이 | 성격 |
|---|---|---|---|
| 1 | `main_banner` | 500px | 좌 흰 폼카드 / 우 카피. 배경 `#111` + 24장 이미지 마퀴 |
| 2 | `gif_bn` | 334px | GIF 배너 1장 (`/public/images/main/gif_banner.gif`) |
| 3 | `status_section` | 701px | 실시간 가입현황 — 탭2 + 세로 롤링 테이블 |
| 4 | `review_section` | 827px | 후기 캐러셀 (slidesPerView 4.15) |
| 5 | `award_section` | 664px | 수상 실적 |
| 6 | `government_section` | 1,097px | 인증서 이미지 그리드 (5열 + 3열) |
| 7 | `process_wrap` | 611px | 가입 절차 4단계 |
| 8 | `gift_section` | 815px | 가전 사은품 캐러셀 (coverflow) |
| 9 | `price_section` | 925px | **요금 비교 막대차트** |
| 10 | `gift_section` (2회차) | 892px | 통신사별 종합혜택 캐러셀 |
| 11 | `quick_section` | 633px | 계열 서비스 3카드 (인터넷/렌탈/모바일) |
| 12 | `contact_cta` | 400px | 전화번호 대형 CTA 밴드 |
| 13 | `footer` | 255px | 사업자정보 + 인증 이미지 |

### TS-Net 현재 (`FE/app/(site)/page.tsx:36-49`)

선언: Hero → PromoBand → LiveFeed → CarrierHub → Journey → Process → Reviews

**실제 렌더 결과** (`curl localhost:3100/` 의 `<h1>/<h2>` 추출):
```
h1 저희 태산넷은 자신있습니다!      ← Hero
   (PromoBand — 제목 없는 밴드)
h2 통신사별 상품 보기               ← CarrierHub
h2 신청에서 설치 혜택 수령까지의 과정!  ← Journey
h2 가입 절차                        ← Process
h2 어떤 상품이 맞는지 고민되시나요?    ← Footer CTA
```
→ **LiveFeed·Reviews 는 렌더되지 않는다.** LiveFeed 는 `/api/feed/live` 가 5건 미만이면 빈 배열
(`LiveFeed.tsx:35` `if (items.length === 0) return null`), Reviews 는 `reviews` 테이블이 비어서
(`page.tsx:14-30`) 각각 섹션째 소거된다. 실질 **4개 콘텐츠 섹션, 2,939px**.

---

### G-01 [섹션구성] 메인 분량이 레퍼런스의 1/3 — 스크롤 체류가 생기지 않는다
- 탐나넷: 13섹션 8,819px. 섹션 평균 678px, `main_section` 공통 `padding:80px 0` (`main_n.css:21`)
- TS-Net 현재: `FE/app/(site)/page.tsx:36-49` 7개 선언 중 **실렌더 4개 / 2,939px**.
  섹션 패딩 `py-16 md:py-20` = 64/80px
- 격차: 3배 분량 차이. 더 심각한 건 **"신뢰 축적 블록"이 0개**라는 점 — 탐나넷은 award(664) +
  government(1,097) + review(827) = 2,588px, 전체의 29%를 "왜 우리를 믿어도 되는가"에 쓴다.
  우리는 그 역할을 하는 섹션이 하나도 없다. 랜딩에서 전화번호를 받아내는 건 결국 신뢰 문제다
- 조치: 아래 G-02~G-06 을 개별 항목으로 처리. 순서는
  `Hero → PromoBand → LiveFeed → **Compare(신규)** → CarrierHub → **Gift(신규)** → Journey → Process → Reviews → **Trust(신규)** → Footer`
- 우선순위: **P0**

### G-02 [섹션구성] 가격 비교 섹션이 아예 없다
- 탐나넷: `price_section` 925px. "같은 요금, 더 큰 혜택은 **선택**에서 시작됩니다" 아이브로우 →
  h2 45px → 막대차트 카드(max-width 1000px) → 하단 요약 3행 테이블. 상세는 §2
- TS-Net 현재: 메인에 가격을 보여주는 섹션이 **없다**. 요금은 `/kt` 등 서브페이지에만 있고
  (`FE/app/(site)/[carrier]/page.tsx:51-54`), 메인 CarrierHub 는 통신사 4카드 링크일 뿐
- 격차: 메인 방문자가 "얼마인지"를 보려면 서브페이지로 1클릭 이동해야 한다. 탐나넷은 메인에서
  금액을 먼저 보여주고 그 다음에 폼을 또 민다
- 조치: `FE/components/sections/Compare.tsx` 신규. 단, **경쟁사 비교 막대차트는 복제하지 않는다**
  (§법적 경고 참조). 대신 우리가 근거를 가진 데이터인 `plans` 테이블을 쓴다 —
  "통신사 4사 × 500M+TV 기준 월 요금" 가로 막대 4개. 값은 `getPlansByCarrier()` 4회 호출 또는
  `lib/plans.ts` 에 `getCompareRows()` 추가. 데이터 없는 통신사는 막대를 그리지 않는다
- 우선순위: **P0**

### G-03 [섹션구성] 사은품(혜택) 섹션이 없다 — 실제 유입 동기가 비어 있다
- 탐나넷: `gift_section` 을 **두 번** 쓴다(815px + 892px, 합 1,707px = 전체의 19%).
  1회차는 가전 사은품 카드 — `SAMSUNG / 삼성 UHD 50인치 / 890,000원 / 무료 + 사은품 /
  [이 사은품으로 상담 신청]`. 즉 **카드마다 개별 CTA**가 붙어 상품→상담이 1클릭.
  2회차는 통신사별 종합혜택. 둘 다 Swiper `effect:'coverflow'` (rotate 40, depth 140)
- TS-Net 현재: 사은품 UI가 **코드·설정·DB 어디에도 없다**. `FE/lib/site-config.ts` 236줄 전체에
  GIFT/BENEFIT/AWARD 류 키가 없고, `PlanTable.tsx:43-45` 의 `현금 사은품` 열은
  `p.gift_amount == null ? "-"` (`PlanTable.tsx:74-76`) 로 **전 행이 `-`** 로 렌더된다
  (실측: `/kt` 의 9행 전부 `-`)
- 격차: 탐나넷 메타 키워드가 `인터넷가입 사은품많이주는곳`이고 히어로 카피도 지원금 중심이다.
  이 업종에서 사은품은 장식이 아니라 **유입 동기 그 자체**다. 우리는 그 자리가 비었고,
  더 나쁘게는 `-` 로 "없음"을 적극적으로 표시하고 있다
- 조치: ① 즉시 — `PlanTable.tsx:73-77` 의 사은품 열을, 그룹 내 `gift_amount` 가 전부 null 이면
  **열 자체를 렌더하지 않도록** 조건부로 바꾼다 (빈 열이 더 나쁘다).
  ② `FE/lib/site-config.ts` 에 `GIFT_SECTION = { enabled: false, items: [] }` 슬롯 추가,
  `FE/components/sections/GiftShowcase.tsx` 신규 (`enabled:false` 면 null 반환 — PromoBand 와 동일 패턴).
  카드당 `href="#consult"` CTA 1개. 실제 품목·금액은 운영자 제공 시 설정값만 교체
- 우선순위: **P0**

### G-04 [섹션구성] 신뢰 섹션(수상·인증) 자리가 없다
- 탐나넷: `award_section` 664px + `government_section` 1,097px. government 는 인증서 이미지를
  5열 그리드 + 3열 그리드로 8장 깔고, 각 장에 캡션(`사전승낙서`, `사업자등록증`,
  `통신판매업신고증` …). 푸터에도 `[사전승낙서보기]` 외부링크
- TS-Net 현재: `FE/components/sections/Footer.tsx` 와 `LegalLinks.tsx` 만 있고 신뢰 섹션은 없다.
  `site-config.ts:17` `SITE.business` 가 전부 TODO 라서 `UI_PORT_LOG.md` 에서도
  "허위표시 위험"으로 레일 인증 뱃지를 의도적으로 뺐다
- 격차: **지금은 넣을 수 없는 게 맞다.** 다만 자리와 컴포넌트가 없으면 증빙 확보 후에도
  레이아웃을 새로 설계해야 한다. 탐나넷이 1,761px(20%)를 쓰는 영역이다
- 조치: `FE/components/sections/TrustBadges.tsx` 를 `enabled:false` 기본값으로 **미리** 만든다.
  `site-config.ts` 에 `TRUST = { enabled: false, certs: [] }`.
  ⚠ 탐나넷의 "3년 연속 … 대상 수상", "국가 공인기관 인증" 문구·구조 **복제 금지** —
  우리가 실제 보유한 서류(사업자등록증·통신판매업신고증·사전승낙서)만, 증빙 확보 후 켠다
- 우선순위: **P1** (증빙 선행. 컴포넌트 스켈레톤만 P1)

### G-05 [섹션구성] LiveFeed 가 데이터 부족으로 상시 소거된다 — 701px 짜리 전환 장치가 영구 공백
- 탐나넷: `status_section` 701px. 섹션 헤드 아래 `LIVE` 빨간 알약(펄스) + 탭 2개 +
  12행 세로 롤링 (slick `vertical:true, slidesToShow:6, autoplaySpeed:1200`)
- TS-Net 현재: `FE/components/sections/LiveFeed.tsx:35` — `items.length === 0` 이면 `return null`.
  `/api/feed/live` 는 5건 미만이면 빈 배열(CLAUDE.md 규칙 1). 로컬 실측에서 **렌더되지 않음**
- 격차: 설계는 올바르다(가짜 데이터 금지). 문제는 **대체 콘텐츠가 없다**는 것. 지금 메인에는
  701px 짜리 구멍이 그냥 빈 채로 남아 있고, 방문자는 그 자리에 아무 사회적 증거도 받지 못한다
- 조치: `LiveFeed.tsx:35` 의 `return null` 을 유지하되, **5건 미만일 때 보여줄 정적 대체 블록**을
  같은 높이로 넣는다. 대체 내용은 지어낸 접수가 아니라 검증 가능한 사실 —
  취급 통신사 4사 로고, 처리 절차 소요시간(`SITE.journey` 재활용), 대표번호.
  구현: `LiveFeed.tsx` 에 `fallback` 분기 추가, 문구는 `site-config.ts` 설정값
- 우선순위: **P0**

### G-06 [섹션구성] 우리에게 있고 탐나넷에 없는 것 — 유지할 것 / 재검토할 것
- 탐나넷: `PromoBand` 류 단어 교체 밴드가 **현행 메인에 없다**. 2026-09-23 관찰(2차 자료) 당시
  존재했으나, 현재 `main_n.css` 에 해당 CSS가 없고 HTML에도 없다. 그 자리를 `gif_bn`(334px)
  GIF 배너가 대체했다. `BackToTop` 상당 기능은 `.quick .top` 으로 우측 레일 안에 있다
- TS-Net 현재: `PromoBand.tsx` (`page.tsx:42`), `Journey.tsx`+`Process.tsx` 2개 절차 섹션,
  `PartnerCard.tsx` (제휴카드), `ui/BackToTop.tsx`
- 격차: ① **PromoBand 는 이제 레퍼런스 근거가 없는 자산이다.** 레퍼런스 추종이 아니라 우리
  고유 선택으로 재평가해야 한다 — `UI_PORT_LOG.md` 3회차에서 이미 "밴드로 안 읽힌다",
  "깜빡임으로 읽힌다" 문제를 두 차례 보수했고, 지금도 문구는 전부 중립 자리표시자다
  (`site-config.ts:132-137`: `인터넷·TV 가입` / `통신사 4사 조건을` / `한자리에서 비교하고` /
  `확인 후 신청하세요`).
  ② **`Journey` 와 `Process` 가 같은 내용을 두 번 말한다.** 실측에서 h2 2개가 연달아 나온다 —
  `신청에서 설치 혜택 수령까지의 과정!`(`SITE.journey`, 4단계: 문자받기/상담연결/설치하기/혜택수령)
  / `가입 절차`(`SITE.processSteps`, 5단계: 상담신청/전화상담/통신사접수/설치/사은품지급).
  단계 수만 다르고 서술하는 과정은 동일하다. 탐나넷은 `process_wrap` 1개(611px)뿐
- 조치: ① **`Journey` 를 남기고 `Process` 를 흡수.** 근거 — `Journey.tsx` 는 `1→2→4열`
  카드 그리드로 G-17 Reveal 적용이 쉽고, `Process.tsx:22-44` 의 `flex-col md:flex-row` +
  `md:contents` 가로 타임라인은 반응형 분기가 복잡해 유지비가 높다.
  `SITE.processSteps` 의 5단계 중 `Journey` 에 없는 `통신사 접수` 를 `journey.steps` 에 추가해
  5단계로 만들고, 그리드를 `lg:grid-cols-5` 로. `Process.tsx` 삭제 + `page.tsx:47` 1줄 제거 +
  `site-config.ts:100-106` `processSteps` 제거.
  ⚠ 단계별 연결선(현 `Process.tsx:38-43`)이 사라지는데, 순서 정보는 `Journey.tsx:29` 의
  `text-[4rem]` 번호가 이미 담당하므로 손실 없다
  ② `PromoBand` 는 G-02 Compare 섹션 도입 후 판단 — 지금 지우지 말 것.
  Compare 가 들어가면 그 자리에서 밴드가 더 뚜렷하게 잉여로 드러난다
- 우선순위: P1

---

## 2. 가격표 레이아웃

탐나넷의 "가격 노출"은 **두 군데**에서 완전히 다른 형태로 일어난다. 둘을 분리해 본다.

### 2-A. 메인 `price_section` = 표가 아니라 **세로 막대차트**

마크업·CSS 실측 (`main_n.css:294-481`):

| 요소 | 값 |
|---|---|
| 카드 | `max-width:1000px`, `padding:30px 45px 25px`, `border-radius:20px`, `border:1px solid #e8ecf0`, `box-shadow:0 10px 30px rgba(33,42,54,.08)` |
| 차트 영역 | `height:360px`. y축 `flex:0 0 85px`, 우측정렬 |
| y축 | `60,000 / 50,000 / 40,000 / 30,000 / 20,000 / 10,000 / 0원` 7눈금. 격자선 `1px dashed #e6e9ec` 를 `:after` 로 `top:60/115/165/215/270px` 하드코딩 |
| 막대 | `width:105px`, `border-radius:7px 7px 0 0`. 3개 |
| 막대 색 | A업체 `#c8d2df`(연회색) / B업체 `#aaa6be`(연보라) / 탐나넷 `linear-gradient(180deg,#ff8a32,#ff7627)` |
| 막대 높이 | **하드코딩** `88% / 79% / 67.8%` |
| 금액 라벨 | 막대 위 `font-size:20px; font-weight:800`. 자사만 `color:#ff641f` |
| 업체명 | 막대 아래 `bottom:-34px`, `20px/700`. 자사만 주황 `800` |
| 요약 테이블 | 차트 아래 3행. `min-height:54px`, `padding:0 28px`, 행 구분 `1px solid #eceeef`. 자사 행(`.active`)만 주황 `20px/800` + `업계 최저가!` 알약 (`background:#fff0e4; color:#c95e20`) |
| 장식 | 우측 `right:-130px; top:70px` 에 손글씨 말풍선 PNG(250px). 모바일에서 `display:none` |

**비판 1 — 막대 높이가 데이터와 안 맞는다.** y축 상한 60,000원 기준 계산값은
52,800/60,000 = 88.0%, 49,500/60,000 = **82.5%**, 40,700/60,000 = 67.8%.
그런데 `main_n.css:397` `.bar_purple { height:79% }` 다. 금액 라벨 위치는
`main_n.css:370` 에서 `bottom:calc(82.5% + 14px)` 로 올바른 값을 쓰는데 **막대만 79%** 라서,
B업체 라벨이 막대 끝에서 3.5pp(약 12.6px) 떠 있다. 자사 막대를 상대적으로 더 낮아 보이게 하는
방향의 오차다. 복제 금지 사유가 하나 더 늘었다.

**비판 2 — 데이터 바인딩이 없다.** 금액·높이·라벨 위치가 전부 CSS/HTML 하드코딩이라
요금이 바뀌면 CSS를 고쳐야 한다. 우리는 `plans` 테이블이 있으니 이 구조를 따라갈 이유가 없다.

### 2-B. 서브페이지 `product_table` = 진짜 표

`sub.css:363-392` + `sub_kt.html` 실측. **열 구성이 "요금 × 옵션 체크 매트릭스"** 다:

```
| 월 이용요금 | 사은품 | 인터넷 | TV 베이직 | TV 에센스 | TV 모든G |
| 22,000원   | @만원  |   O   |          |          |         |
| 38,500원   | @만원  |   O   |    O     |          |         |
| 42,900원   | @만원  |   O   |          |    O     |         |
| 44,000원   | @만원  |   O   |          |          |    O    |
```

| 속성 | 값 |
|---|---|
| 열 너비 | `<colgroup>` 6개 전부 `16.666666666667%` — 균등 |
| 정렬 | **전 셀 `text-align:center`** (`sub.css:372`) |
| 셀 패딩 | `.75rem` |
| 테두리 | `1px solid #e8ebef`, `thead td` 상단만 `1px solid #171717` (진한 1선) |
| 헤더 배경 | `#f6f7f9` (`--black-4-color`) |
| 취소선 | **없음.** 할인 전/후 2열 구조가 아니라 금액 1열 |
| 강조 행 | **없음.** 추천/베스트 행 표시가 없다 |
| sticky header | **없음** |
| 사은품 값 | `@만원` ← 자리표시자가 그대로 프로덕션에 노출돼 있다 |

**모바일 변환** (`sub_responsive.css`) — 2단 전략:
- `≤600px`: `.product_table_wrap { overflow-x:auto; white-space:nowrap }` + `.product_table { width:auto }` → 가로 스크롤
- `≤480px`: 전략 전환. `col:nth-child(2){width:90%}`, `col:nth-child(3),(5){width:0}`,
  `th{display:none}`, `td:nth-child(3),(5){display:none}` → **열 3·5를 통째로 숨긴다**

**비판 3 — 480px 이하에서 정보가 소실된다.** 숨기는 3·5번 열이 `인터넷`/`TV 에센스` 다.
즉 폰에서는 "TV 에센스 조합" 행이 어떤 조합인지 알 수 없는 행으로 변한다. 열 인덱스
하드코딩이라 통신사별 열 수가 다르면 엉뚱한 열이 숨는다. **따라가면 안 되는 처리.**

### TS-Net 현재 — `FE/components/sections/PlanTable.tsx` (93줄)

```
| 상품명 | 속도 | 총요금(월) | 할인가(월) | 약정 | 현금 사은품 |
```
| 속성 | 값 | 근거 |
|---|---|---|
| 열 정렬 | 상품명·속도 좌 / 총요금·할인가·사은품 **우** / 약정 중앙 | `PlanTable.tsx:32-45` |
| 취소선 | **있다.** `list_fee !== monthly_fee` 일 때만 `line-through` | `PlanTable.tsx:59-65` |
| 강조 | 할인가 열 `text-base font-black text-brand` (본문 sm 대비 1단 크게) | `PlanTable.tsx:67` |
| 숫자 | `.tabular` (`font-variant-numeric: tabular-nums`, `globals.css`) | `PlanTable.tsx:58,67` |
| 행 hover | `hover:bg-brand-soft` + `transition-colors` (duration 미지정 → Tailwind 기본 150ms) | `PlanTable.tsx:52` |
| 헤더 | `bg-brand-light/70`, `text-left`, `font-bold` | `PlanTable.tsx:31` |
| 그룹 | `groupByCategory()` 로 결합/인터넷/TV 분리, 그룹마다 h3 + 막대 마커 | `PlanTable.tsx:22-27` |
| 모바일 | `overflow-x-auto` + `min-w-[760px]` — **가로 스크롤 단일 전략** | `PlanTable.tsx:28-29` |
| 각주 | `PLAN_DISCLAIMER` `text-xs text-faint` | `PlanTable.tsx:87-89` |

**판정: 표 자체는 탐나넷보다 낫다.** 취소선·우측정렬·tabular-nums·그룹 분리·강조 1단계는
모두 탐나넷에 없는 것이다. 갭은 "표가 아닌 것"들에 있다.

---

### G-07 [가격표] 전 행이 `-` 인 사은품 열 — 빈 열이 없는 열보다 나쁘다
- 탐나넷: 같은 자리에 `@만원` 자리표시자를 노출 (이것도 결함이지만, 적어도 "금액이 있다"는 신호)
- TS-Net 현재: `PlanTable.tsx:73-77` — `gift_amount == null ? "-"`. `/kt` 실측 9행 전부 `-`
- 격차: 표 폭의 1/6을 써서 "사은품 없음"을 9번 반복 선언하고 있다. 이 업종에서 최악의 메시지
- 조치: `PlanTable.tsx:12` 컴포넌트 안에서 그룹별로
  `const hasGift = list.some(p => p.gift_amount != null)` 를 구하고,
  `hasGift` 가 false 면 `<th>`(43-45) 와 `<td>`(73-77) 를 함께 렌더하지 않는다.
  `min-w-[760px]` 도 열 수에 따라 `min-w-[640px]` 로 낮춘다
- 우선순위: **P0**

### G-08 [가격표] 추천 행 강조가 없다 — 6행이 동등하게 보인다
- 탐나넷: 메인 요약 테이블 3행 중 1행에 `.active` → 색·굵기·크기(20px/800) 전환 + `업계 최저가!`
  알약 뱃지. 표가 아니라 차트 쪽에서 "어디를 봐야 하는지"를 확실히 지정
- TS-Net 현재: `PlanTable.tsx:50-53` 모든 `<tr>` 이 동일 클래스. 강조는 열 단위(할인가)만 있고
  **행 단위가 없다**. `PlanCards.tsx` 가 추천 3개를 맡지만 `tableRows()` 로 그 행을 표에서
  빼버려서(`[carrier]/page.tsx:54`) 표 안에는 기준점이 아예 없다
- 격차: 6~9행 표를 처음 보는 사람이 어느 행부터 읽어야 할지 모른다
- 조치: `lib/plans.ts` 에 `isRecommended(plan)` 추가(그룹 내 `monthly_fee` 최저 또는
  `list_fee - monthly_fee` 최대 1건). `PlanTable.tsx:50-53` 에 조건부
  `bg-brand-light/40 ring-1 ring-inset ring-brand/25` + 상품명 셀에 `추천` 알약
  (`bg-accent text-accent-ink text-[11px]`). 뱃지 문구는 계산 근거가 있는 것만
  ("최저가" 금지 — 타사 비교 주장이 된다. "이 조합 중 최저" 수준으로 한정)
- 우선순위: **P0**

### G-09 [가격표] 모바일 760px 가로 스크롤 — 스크롤 가능 신호가 없다
- 탐나넷: ≤600px 가로스크롤 + `white-space:nowrap`, ≤480px 열 숨김 (위 비판 3)
- TS-Net 현재: `PlanTable.tsx:28-29` `overflow-x-auto` + `min-w-[760px]`. 375px 뷰포트에서
  표가 2배 폭이라 **4개 열이 화면 밖**. 스크롤 가능함을 알리는 그림자·그라데이션·힌트 없음
- 격차: 모바일 사용자는 `상품명 / 속도` 까지만 보고 "요금이 안 적혀 있다"고 읽는다.
  가격 랜딩에서 가격이 기본 상태에서 안 보이는 것
- 조치: 탐나넷식 열 숨김은 쓰지 않는다. 대신 둘 중 하나 —
  ① `md` 미만에서 `<table>` 을 **행=카드**로 변환 (`md:table-row` / 기본 `block`).
  각 카드에 상품명(제목) + 할인가(대형) + 나머지는 `<dl>` 2열.
  ② 최소 조치: `min-w-[760px]` 유지하되 래퍼에
  `[mask-image:linear-gradient(90deg,#000_0,#000_calc(100%-24px),transparent)]` 로 우측 페이드 +
  `md:hidden` 힌트 텍스트 "좌우로 밀어 보세요".
  권장은 ①. 열 순서를 재배치해 **할인가를 2번째 열로** 올리는 것도 같이 한다
- 우선순위: **P0**

### G-10 [가격표] 메인에 금액이 없다
- G-02 와 동일 항목. 중복 기재 생략
- 우선순위: **P0**

---

## 3. 상세페이지(통신사 서브) 구현 형태

### 탐나넷 `/public/product/product.php?cnt_id=2` (KT올레) 실측

**정보 계층 = 4단 중첩 탭.** 이게 핵심 차이다.

```
[1단] product_info_tabs       상품정보 | 결합정보 | 안내사항        ← 3분할, flex-basis 33.333%
  └ [2단] fee_info_tabs       100MB | 500MB | 1GIGA               ← 속도
      └ [3단] fee_2_info_tabs 휴대폰 미결합 | KT패밀리             ← 결합유형
          └ [4단] fee_3_info_tabs  (이 조합은 비어 있음)
              └ product_table  월 이용요금 × 옵션 매트릭스 4행
```

탭 스타일 (`sub.css:125-300`) — 단계마다 **시각 언어가 다르다**:

| 단계 | 비활성 | 활성 |
|---|---|---|
| 1단 | `bg #f8f9fb` + `border 1px #e8ebef`, `color #8a8f98`, `padding 1rem` | `bg #ff5a22` + 흰 글씨 + **하단 삼각 꼬리** (`:after` border trick, `bottom:-20px`) |
| 2단 | 흰 배경 + `radius 12px` + 1px 테두리, `flex-basis 24.25%` | `color #ff5a22` + `border 2px #ff5a22` + `box-shadow 0 0 8px #fb621646` |
| 3단 | 동일 | `border 2px #8a8f98` + `box-shadow 0 0 8px rgba(0,0,0,.2)` — **회색 계열** |
| 4단 | 동일 | `bg #171717` + 흰 글씨 — **검정** |

→ 주황 → 주황테두리 → 회색테두리 → 검정. 깊이가 내려갈수록 채도를 뺀다. 의도적 위계다.

**구분선**: 2·3단 콘텐츠는 `border-top: 1px dashed #e8ebef` (`sub.css:252-257`) 로 상위와 분리.
**선택 요약**: `.product_refer` 알약이 현재 조합을 글자로 다시 알려준다 — `100MB - 휴대폰 미결합`
(`sub.css:323-331`, `font-size:14px`, `bg #f6f7f9`, `radius 12px`)
**탭 전환**: `onclick="select_category_prdt(2, 13, 1, this)"` → 서버 왕복. **SPA 아님**

**탭2 `결합정보`** — 6열 할인 매트릭스:
```
| 인터넷 종류 | 할인상품 | <22,000 | 22,000+ | 64,900+ | 108,900+ | 141,900+ | 174,900+ |
| 기가1G/500M | 인터넷할인 | 2,200 | 5,500 | ... |
|            | 모바일할인 |   0   |   0   | 5,500 | 16,610 | 22,110 | 27,610 |
|            | 총 할인금액 | 2,200 | 5,500 | 11,000 | 22,110 | 27,610 | 33,110 |
```
+ 주석 7줄 (`· LTE/3G 구분 없이 휴대폰 최대 5대 결합 가능` 등)

**탭3 `안내사항`** — `product_txt_desc` 회색 패널(`bg #f6f7f9; padding:2rem 3rem`) 3블록:
`신청 전에 꼭 확인해 주세요`(7항) / `가입신청시 필수 체크사항`(9항) / `사은품 반환조건 사항`(7항).
합 23개 고지 항목.

**월요금 계산기 = 모달** (`#monthly_calculator`, 헤더 우측 레일 `월요금 계산기` 버튼으로 열림):
```
[통신사 6탭] SK브로드밴드 | KT올레 | LG유플러스 | SKT | KT스카이라이프 | LG헬로비젼
[속도 4탭]  스마트광랜(100MB) | 기가라이트(500MB) | 기가인터넷(1GB) | 기가프리미엄(2.5GB)
[할인 3탭]  온가족할인 | 요즘우리집결합 | 요즘가족결합
[비율 3탭]  20% 할인 | 30% 할인 | 50% 할인
[구성 라디오] 인터넷 | 인터넷+이코노미 | ...
→ [선택 이용요금] 0원   [월 예상납부액] 0원(.big)
→ [가입신청서 작성하기] [지원금 문자받기]
```
**5단 선택.** 결과는 readonly `<input>` 2개 — 카운트업 애니메이션 없음.

**서브페이지 CTA**: `product_button_wrap` 에 2버튼 ×2회 노출 (탭1, 탭2) =
`가입신청서 신청`(주황) + `비밀지원금 문자 받기`(검정 `#171717`).
≤600px 에서 `width:100%` 세로 스택. **상세페이지에 폼 자체는 없다** — 전부 다른 페이지/모달로 이동.

### TS-Net 현재 `FE/app/(site)/[carrier]/page.tsx` (103줄)

```
CarrierHero → PlanCalculator → PlanCards → PlanTable → PartnerCard → #consult LeadForm
```
실측 `/kt` h2/h3:
```
h1 KT 인터넷·IPTV 가입 상담
h2 내 요금 계산해보기   h2 추천 상품 (h3 ×3) 
h2 요금제 안내 (h3 인터넷+TV 결합 / h3 휴대폰 결합)
h2 제휴카드 할인 안내   h2 KT 가입 상담 신청
```

---

### G-11 [상세페이지] 탭/아코디언이 0개 — 전부 한 장에 펼쳐 세로로 쌓는다
- 탐나넷: 4단 중첩 탭으로 조합당 4행만 보여준다. 화면에 한 번에 노출되는 요금 행 = **4행**
- TS-Net 현재: `[carrier]/page.tsx:51-54` 에서 PlanCalculator + PlanCards 3장 + PlanTable
  (6행 + 3행) 을 전부 세로로 쌓는다. 탭·아코디언 컴포넌트가 프로젝트에 **존재하지 않는다**
  (`FE/components/ui/` = BackToTop, Button, Field, Icon, Modal, Reveal, SectionHeading)
- 격차: 양날이다. 우리 쪽이 **스캔성은 더 좋고**(전부 보인다) 탐나넷이 **의사결정 부담은 더 낮다**
  (고른 것만 보인다). 진짜 격차는 요금제 수가 늘어날 때다 — 통신사당 속도 3종 × TV 4종 ×
  휴대폰 결합 N 이 되면 우리 표는 수십 행이 되고 그때 구조가 무너진다
- 조치: 전면 탭 전환은 과잉. **`PlanTable` 위에 속도 필터 칩 1줄**만 추가한다.
  `FE/components/sections/PlanTable.tsx` 를 `"use client"` 로 올리고
  `const [speed, setSpeed] = useState<string|null>(null)` + `전체 | 100M | 500M | 1G` 칩.
  칩 스타일은 `PlanCalculator.tsx:42-47` 의 `chip()` 함수를 `ui/Chip.tsx` 로 추출해 공유.
  그룹 h3 는 유지(결합/인터넷/TV 는 성격이 달라 탭으로 묶으면 안 된다)
- 우선순위: P1

### G-12 [상세페이지] 고지·안내 정보량이 1/20 — 신뢰와 분쟁예방 양쪽에서 불리
- 탐나넷: 탭3 에 23개 고지 항목, 탭2 에 결합 주석 7줄, 요금표 위 `※와이파이 미포함이며…` 경고 1줄,
  설치비 안내 표 별도. 패널 `bg #f6f7f9; padding:2rem 3rem`
- TS-Net 현재: 고지는 `PLAN_DISCLAIMER` **1문장**뿐 (`site-config.ts:220`,
  `PlanTable.tsx:87-89` 에서 `text-xs text-faint`). `PartnerCard.tsx` 에 제휴카드 `details` 배열
- 격차: ① 신뢰 — 이 업종 사용자는 "3년 약정", "1년 내 해지 시 사은품 반환" 같은 조건을
  찾으러 온다. 없으면 숨긴다고 읽는다. ② 실무 — 약정·위약금·사은품 반환 조건을 사전 고지하지
  않으면 분쟁 시 우리가 불리하다. ③ `text-xs text-faint`(#93a69b) 한 줄은 **읽히지 않는 톤**이다
- 조치: `FE/components/sections/PlanNotice.tsx` 신규. 3블록 `<details>` 아코디언
  (`신청 전 확인사항` / `약정·위약금` / `사은품 반환조건`), 기본 접힘, 패널 `bg-surface-muted`
  `rounded-panel` `p-6 md:p-8`, 본문 `text-sm text-muted leading-relaxed`(faint 금지).
  내용은 `site-config.ts` 에 `PLAN_NOTICE: { title, items[] }[]` 로 빼고 **운영자가 실제 계약
  조건으로 채운다** — 탐나넷 문구 복제 금지(그쪽 약정 조건이 우리 조건이 아니다).
  배치: `[carrier]/page.tsx:76` `PartnerCard` 다음, `#consult` 앞
- 우선순위: **P0** (법적 리스크 동반)

### G-13 [상세페이지] 현재 선택 조합을 글자로 되읽어주는 장치가 없다
- 탐나넷: `.product_refer` 알약이 `100MB - 휴대폰 미결합` 을 항상 표시 (`sub.css:323`)
- TS-Net 현재: `PlanCalculator.tsx:29-31` 에 `speed`/`tv`/`mobileId` 3상태가 있고
  칩의 활성 스타일(`:45` `border-brand bg-brand text-white`)로만 표현된다. 3개 칩 줄을
  각각 눈으로 확인해야 현재 조합을 안다
- 격차: 칩이 3줄로 떨어져 있어 "내가 뭘 고른 상태인지"가 한 눈에 안 들어온다.
  결과 금액이 왜 그 값인지 추적이 안 되면 금액을 신뢰하지 않는다
- 조치: `PlanCalculator.tsx:57` 의 결과 패널(`md:grid-cols-[1fr_20rem]` 의 오른쪽) 금액 위에
  `{speed} · {tv}{mobile ? ` · ${mobile.name}` : ""}` 요약 알약 1줄.
  `rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand-dark`
- 우선순위: P1

### G-14 [상세페이지] 계산기가 섹션 인라인 — 표를 보다가 계산하려면 위로 되돌아가야 한다
- 탐나넷: 계산기를 **모달**로 띄운다. 우측 레일 `월요금 계산기` 버튼 + 계산기 모달 안에
  `가입신청서 작성하기` CTA. 어느 스크롤 위치에서도 호출 가능
- TS-Net 현재: `PlanCalculator` 가 `[carrier]/page.tsx:51` 고정 위치 섹션. 표(`:54`)를 보다가
  금액을 다시 계산하려면 2섹션 위로 스크롤
- 격차: 계산기 → 표 → 계산기 왕복이 스크롤 작업이 된다. `ui/Modal.tsx` 는 이미 있다
- 조치: 인라인 섹션은 **유지**(퍼스트뷰 직후 "내 경우 얼마" 를 먼저 답하는 현재 순서가 맞다).
  추가로 `PlanTable` 섹션 헤더 우측에 `계산기 열기` 보조 버튼을 두고,
  `PlanCalculator` 의 선택 UI를 `ui/Modal.tsx` 로도 띄울 수 있게 본문을 분리
  (`PlanCalculatorBody.tsx` 추출). 둘이 같은 상태를 쓰려면 `[carrier]/page.tsx` 에 클라이언트
  래퍼가 필요하므로, 비용이 크면 P2로 미룬다
- 우선순위: P2

### G-15 [상세페이지] 결합 할인 매트릭스가 없다
- 탐나넷: 탭2 에 모바일 총액 6구간 × 인터넷 2종 × 3행(인터넷할인/모바일할인/총할인) 매트릭스
- TS-Net 현재: 휴대폰 결합이 `PlanTable` 의 `휴대폰 결합` 그룹 3행으로 들어가 있다
  (실측: `거의 안씀(5G 슬림 4GB)` / `기본 데이터(5G 슬림 10GB)` / `완전 무제한(5G 베이직)`).
  구간별 할인 구조가 아니라 **요금제 3개 나열**
- 격차: 결합 할인은 "내 휴대폰 요금이 얼마냐"에 따라 달라지는 구간 함수인데, 우리는 상품 3개로
  단순화했다. 실제 상담에서 가장 많이 나올 질문에 페이지가 답하지 않는다
- 조치: DB 선행 작업. `BE/supabase/migrations/` 에 `combo_discounts` 테이블 신규
  (`carrier`, `internet_tier`, `mobile_total_min`, `internet_discount`, `mobile_discount`).
  FE는 `ComboDiscountTable.tsx`. **데이터 확보 전에는 만들지 않는다** — 빈 표가 더 나쁘다(G-07)
- 우선순위: P2 (데이터 선행)

---

## 4. 동적 요소·애니메이션

### 탐나넷 — 선언된 전부

`@keyframes` 는 `main_n.css` 에만 6개 있고, 그 외 CSS 6파일에는 0개다.

| # | 이름 | 대상 | 지속·이징 | 동작 |
|---|---|---|---|---|
| 1 | `mainFlow` | `.ani_bg ul` (히어로 배경) | **36s linear infinite** | `translate3d(0,0,0) → (-1200px,0,0)`. `width:3000px` 안에 24장(12장×2) 중복 배치. `will-change:transform` |
| 2 | `liveBadgeGlow` | `.live_badge` | 1.5s ease-in-out infinite | box-shadow 확산 (`rgba(255,66,66,.2)` ↔ 0) |
| 3 | `liveShine` | `.live_badge:after` | 2.5s ease-in-out infinite | 45% 폭 흰 띠가 `rotate(20deg)` 로 뱃지를 횡단 |
| 4 | `livePulse` | `.live_badge i:before/:after` | 1.8s ease-out infinite, **두 번째는 `.7s` 지연** | 점에서 링 2겹 확산 |
| 5 | `heroPulse` | 히어로 (2곳) | 1.8s infinite | (실측 — CSS 미확인) |
| 6 | `heroArrow` | 히어로 화살표 (2곳) | 1s infinite | (실측 — CSS 미확인) |
| 7 | `supportModalShow` | 지원금 모달 | 0.35s 1회 | 등장 |

**트랜지션**: `background-color·border-color 0.22s ease` 가 **145개 요소에 일괄 적용**(실측).
0.22s 가 이 사이트 호버 반응의 기본 단위. `a` 는 `reset.css` 에서 `0.1s ease-in-out`.

**캐러셀/롤링** (인라인 `<script>` 실측):

| 대상 | 라이브러리 | 설정 |
|---|---|---|
| 가입현황 `.rolling-box01` | slick | `vertical:true, slidesToShow:6, slidesToScroll:1, autoplay, autoplaySpeed:1200`, `draggable:false, swipe:false, pauseOnHover:false`, `arrows:false, dots:false`. 행 높이 `58px!important` |
| 자유게시판 `.rolling-box02` | slick | 동일, `autoplaySpeed:1350`. **탭 클릭 시 lazy init** |
| 후기 `.review_swiper` | Swiper 11 | `slidesPerView:4.15, spaceBetween:18, autoplay{delay:3000}, loop(슬라이드≥6)`. breakpoints `0:1.25 / 560:2.15 / 900:4.15` |
| 사은품 `.gift_swiper` | Swiper 11 | `effect:'coverflow'`, `coverflowEffect{rotate:40, stretch:0, depth:140, modifier:1, scale:1, slideShadows:false}`, `centeredSlides, slidesPerView:'auto', loop, grabCursor`. **autoplay 없음** (수동) |
| 혜택 `.benefit_swiper` | Swiper 11 | 동일 + 6장을 JS로 복제해 12장 loop, 페이지네이션은 6개로 매핑 |
| 모바일 절차·빠른메뉴 | Swiper 11 | `≤900px` 에서만 init (`.mobile_auto_swiper`) |

**호버**: `.gift_card` 가 `transition: border-color .25s ease, box-shadow .25s ease, opacity .25s ease`
(`main_n.css:252`). `.fee_info_tab_link:hover { color:#ff5a22 }`.

### 탐나넷에 **없는** 것 — 이게 더 중요하다

- **스크롤 등장 애니메이션 0개.** `IntersectionObserver` 가 HTML·JS 전체에 **없다**.
  AOS·WOW 류 라이브러리도 없다. `common.js:141` 의 `scrollAnimate()` 는 헤더 sticky
  (`scrollTop > 100` → `.scroll-top` 클래스)와 맨위로 버튼만 한다
- **숫자 카운트업 0개.** 계산기 결과는 readonly `<input>` 값 직접 대입
- **단어 교체 롤링 밴드 없음** (2026-09-23 2차 관찰 자료에는 있었으나 현행 메인에서 제거됨)
- **`prefers-reduced-motion` 대응 0개.** 7개 CSS 파일 전체 grep 결과 0건. 36s 무한 마퀴 +
  4개 무한 펄스 + 3개 autoplay 캐러셀이 모션 민감 사용자에게 그대로 간다 — **접근성 결함**

### TS-Net 현재

| 자산 | 위치 | 상태 |
|---|---|---|
| `animate-promo-word` | `globals.css` `--animate-promo-word: promo-word 0.62s cubic-bezier(0.16,1,0.3,1) both` | **메인에서 유일하게 작동 중인 애니메이션** (실측: `animate-` 클래스 1종) |
| `animate-feed-scroll` | `feed-scroll 32s linear infinite`, `translateY(0 → -50%)` | LiveFeed 소거로 **미작동** |
| `animate-slide-down` / `animate-pop` | 0.25s / 0.35s `cubic-bezier(0.22,1,0.36,1)` | 드로어·모달 |
| 스크롤 등장 | `ui/Reveal.tsx`(56줄, `IntersectionObserver{rootMargin:"0px 0px -10% 0px", threshold:0.05}`, 1회성 `io.disconnect()`) + `globals.css:190-199` `opacity/transform 0.6s cubic-bezier(0.22,1,0.36,1)`, `translateY(18px)` | **있으나 `CarrierHub.tsx:19` 단 1곳.** 카드 4장에 `delay={i*70}` 스태거 |
| `prefers-reduced-motion` | `globals.css:203-217` — `animation-duration:0.01ms !important`, `transition-duration:0.01ms`, `[data-reveal]` 즉시 노출 | **있다.** 탐나넷 대비 우위 |
| 자동 순환 | `PromoBand.tsx:35-42` `setInterval(holdMs=2400)` 프레임 로테이터 + 단어 `animationDelay: wi*170ms` | 작동 중 |
| 스냅 캐러셀 | `Reviews.tsx:65,70` 네이티브 `-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3` + 카드 `w-72 shrink-0 snap-start` | **있다.** 라이브러리 없이 |
| 캐러셀 라이브러리 | Swiper/slick/embla **미사용** | — |
| 카운트업 | **없다** (11개 섹션 전수) | — |
| 호버 트랜지션 | `duration-200`(`PlanCalculator.tsx:43`, `CarrierHub.tsx:23`) / `duration-300`(`CarrierHub.tsx:27,48`, `Process.tsx:26`) / 미지정 150ms(`PlanTable.tsx:52`, `LiveFeed.tsx:70`) | 150/200/300 혼재 |
| 이징 | `cubic-bezier(0.22,1,0.36,1)` (대부분, `--ease-out-soft` 와 동일) / `cubic-bezier(0.16,1,0.3,1)` (promo-word 전용) | 2종으로 수렴 — 양호 |

---

### G-16 [애니메이션] 실제로 움직이는 요소가 메인에 1개뿐
- 탐나넷: 상시 작동 모션 — 배경 마퀴(36s) + LIVE 뱃지 3중 펄스 + 가입현황 롤링(1.2s/행) +
  후기 autoplay(3s). **스크롤을 멈춰도 화면이 살아 있다**
- TS-Net 현재: `curl localhost:3100/` 의 `animate-*` 클래스 = `animate-promo-word` **1종**.
  `animate-feed-scroll`(`feed-scroll 32s linear infinite`, `LiveFeed.tsx:66`, hover 시
  `[animation-play-state:paused]`) 은 LiveFeed 소거로 **미작동**.
  `Reviews.tsx` 의 snap 캐러셀도 `reviews.length === 0` 이면 `return null`(`:43`) 로 미렌더.
  Hero·Journey·Process·Footer 는 모션 **0개** (hover 전환 외)
- 격차: 레퍼런스 대비 "살아있다는 느낌" 격차가 가장 큰 축. 다만 ⚠ 모션을 늘리는 게 목표가
  아니다 — 탐나넷 모션의 **대부분이 콘텐츠(후기·현황·사은품)에 붙어 있다**.
  우리가 비어 있는 건 **모션이 아니라 그 콘텐츠**다. 실제로 우리는 캐러셀 구현도(Reviews),
  마키 구현도(LiveFeed) 이미 갖고 있고 **데이터가 없어서 둘 다 렌더되지 않는다**.
  G-03·G-05 가 선행이고 모션은 그 뒤에 자동으로 따라온다
- 조치: ① G-05 LiveFeed fallback 으로 `animate-feed-scroll` 복구.
  ② G-03 `GiftShowcase.tsx` 는 `Reviews.tsx:65,70` 의 스냅 패턴을 **그대로 재사용**
  (`-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3` + `w-72 shrink-0 snap-start`).
  **Swiper 도입 금지** — 번들 비용 대비 효용이 없고, 네이티브 scroll-snap 자산이 이미 있다.
  ③ `Reviews.tsx:70` 의 고정폭 `w-72` 를 `basis-[85%] sm:basis-[46%] lg:basis-[23%]` 로 바꿔
  탐나넷의 "다음 장이 걸쳐 보이는" 비율(`1.25 / 2.15 / 4.15`)을 재현.
  현재 `w-72`(288px) 고정은 1440 에서 4장 + 여백이 어정쩡하게 남는다.
  autoplay 는 넣지 말 것(`prefers-reduced-motion` 처리 비용 > 효용)
- 우선순위: P1

### G-17 [애니메이션] 스크롤 등장이 `CarrierHub` 1섹션에만 적용돼 있다
- 탐나넷: 스크롤 등장 **0개** (위 참조) — 이 축은 우리가 가진 자산이다
- TS-Net 현재: `ui/Reveal.tsx` 를 쓰는 섹션은 **`CarrierHub.tsx:19` 단 하나**
  (`<Reveal key={c.slug} delay={i * 70}>`). `Journey`·`Process`·`Reviews`·`LiveFeed` 는
  **CarrierHub 와 사실상 같은 카드 그리드 패턴**(`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)인데
  `Reveal` 이 빠져 있다. `/kt` 는 `animate-`·`data-reveal` 모두 0 (실측)
- 격차: 같은 생김새의 카드 줄 4개 중 1개만 등장 애니메이션이 있다 → **일관성 결함**.
  방문자는 CarrierHub 만 움직이고 Journey 는 정지한 이유를 알 수 없다.
  추가로 `0.6s` + `translateY(18px)`(`globals.css:190-196`)는 섹션 단위로 느린 편 —
  사이트 다른 전환이 0.2~0.3s 로 수렴하는데(G-18) 등장만 0.6s 라 늘어진다
- 조치: ① `globals.css:190-196` 의 `0.6s` → `0.45s`, `translateY(18px)` → `14px`.
  ② `Journey.tsx:21-45`, `Process.tsx:22-44`, `Reviews.tsx:65-88` 의 반복 아이템을
  `<Reveal delay={i * 70}>` 로 감싼다 — `CarrierHub.tsx:19` 와 동일 패턴.
  `LiveFeed` 는 내부가 무한 마키라 섹션 전체를 1개 `<Reveal>` 로만 감싼다.
  ③ G-02·G-03·G-04·G-12 신규 섹션 전부 적용.
  ④ 서브페이지 `[carrier]/page.tsx:51-54` PlanCalculator/PlanCards/PlanTable 에도 적용
- 우선순위: P1 (일관성 결함이라 P2 에서 올림)

### G-18 [애니메이션] 호버 트랜지션 값이 150 / 200 / 300ms 로 갈린다
- 탐나넷: `background-color·border-color 0.22s ease` 를 **145개 요소에 일괄** 적용(실측).
  사이트 전체 반응 속도가 한 몸처럼 느껴진다
- TS-Net 현재 — 실측 3종 혼재:
  - `duration-150`(미지정 기본): `PlanTable.tsx:52`, `LiveFeed.tsx:70` 행 hover
  - `duration-200`: `PlanCalculator.tsx:43` 칩, `CarrierHub.tsx:23` 카드 테두리,
    `Header.tsx:81` navLink, `Footer.tsx:36,43` CTA
  - `duration-300`: `CarrierHub.tsx:27` 컬러바, `:48` 화살표, `Process.tsx:26,28` 아이콘칩,
    `Header.tsx:88` 밑줄·`:182,:188` 드로어, `BackToTop.tsx:32`
  `globals.css` 에 호버 공통 토큰이 없다
- 격차: **같은 카드 안에서 테두리는 200ms, 컬러바는 300ms, 화살표는 300ms** 로 움직인다
  (`CarrierHub.tsx:23,27,48`). 한 번의 hover 가 세 박자로 끝나 "마감이 안 된" 인상을 만든다
- 조치: ① `globals.css` 에 `@theme { --default-transition-duration: 220ms; }` 추가.
  ② 색·테두리 전환의 개별 `duration-*` 를 **제거**해 기본값을 받게 한다
  (`PlanTable.tsx:52`, `LiveFeed.tsx:70`, `PlanCalculator.tsx:43`, `CarrierHub.tsx:23`).
  ③ **위치·크기 이동(translate/scale)은 300ms 유지** — 색보다 느려야 자연스럽다.
  즉 `CarrierHub.tsx:27,48` 과 `Process.tsx:26` 은 그대로.
  탐나넷의 0.22s 를 수치로 차용하는 건 CSS 복제가 아니라 타이밍 참고라 규칙 5에 걸리지 않는다
- 우선순위: P2

---

## 5. 색 구조

### 탐나넷 — 면적 가중 실측 (1440×1000)

**배경**
| HEX | 면적 (px²) | 용도 |
|---|---|---|
| `#ffffff` | 22,867k | 기본 면. **배경 총면적의 약 90%** |
| `#f4f7fa` | 905k | 보조 면 — 푸른기 뉴트럴 |
| `#111111` | 715k | 히어로 배너 **단독** |
| `#edf0f3` | 622k | 이미지 플레이스홀더(`review_img`) |
| `#f8f9fb` | 365k | `--bg-1-color` |

**글자**
| HEX | 면적 | 용도 |
|---|---|---|
| `#171717` | 6,488k | 본문·제목 (`--black-1-color`) |
| `#33373c` | 597k | 테이블 셀 |
| `#ffffff` | 538k | 히어로·CTA 위 |
| `#333333` | 448k | 섹션 설명문 |
| **`#ff641f`** | **257k** | **포인트색 — 글자로만** |

**그라데이션**
| 정의 | 면적 | 용도 |
|---|---|---|
| `linear-gradient(#f3f7fb 0%, #fbfdff 74%, #fff 100%)` | 1,182k | 후기 섹션 면 (`main_n.css:188`) |
| `linear-gradient(90deg,#fff8f2,#fff0e7)` | 572k | 옅은 주황 면 |
| `linear-gradient(#ff8b28 0%, #ff6a15 48%, #ff4d0c 100%)` | **25k** | CTA 버튼 |

### 결론 — "포인트색은 면이 아니라 점이다"

**주황이 배경 상위 10위에 단 하나도 없다.** 유일한 주황 색면은 CTA 버튼 **25k px²** —
흰 배경 22,867k 의 **0.11%** 다. 주황은 글자(257k)와 알약 뱃지로만 나타난다.
그래서 CTA 버튼이 페이지에서 유일한 채도 덩어리가 되고, 시선이 거기로 간다.

보조 면도 순회색이 아니라 **푸른기 뉴트럴**(`#f4f7fa` / `#edf0f3` / `#f8f9fb`)이다.
주황(난색) 포인트 ↔ 푸른기(한색) 면 = 보색 대비로 포인트가 더 튀어 보인다.

### TS-Net 현재 — `FE/app/globals.css:7-36`

```
--brand: #2f9e52   --brand-dark: #23803f   --brand-deep: #14532b
--brand-light: #e3f5e9   --brand-soft: #f3fbf5
--accent: #f7a928  --accent-dark: #e0940f  --accent-ink: #3a2a05
--surface-muted: #f6faf7   --line: #dceBe1   --line-strong: #c3ddcb
--muted: #5f7268   --faint: #93a69b
```

실측 섹션 배경 (`curl` 의 `<section class>`):
```
메인: bg-white / PromoBand 그라데이션(brand-soft→#fff→brand-soft) / bg-white / bg-white
      / bg-brand-soft / Footer 그라데이션(brand-deep→brand-dark→brand)
/kt : bg-white / bg-brand-soft / bg-white / bg-brand-soft / bg-white / bg-brand-soft / Footer
```

---

### G-19 [색] 보조 면을 초록 틴트로 깔아 포인트가 묻힌다 — 가장 큰 색 구조 격차
- 탐나넷: 흰색 90% + **푸른기** 뉴트럴 보조면(`#f4f7fa`). 포인트색 면적 0.11%.
  브랜드색과 보조면이 **다른 색 계열**이라 서로 간섭하지 않는다
- TS-Net 현재: 보조면이 `bg-brand-soft`(`#f3fbf5`) — **브랜드색의 옅은 버전**.
  `/kt` 는 `bg-white` ↔ `bg-brand-soft` 를 3회 교대. `--surface-muted: #f6faf7` 도 초록 틴트.
  `--line: #dceBe1` 도 초록쪽(`globals.css:26` 주석 "순회색이 아니라 초록쪽으로")
- 격차: 초록 브랜드 + 초록 틴트 면 + 초록 선 = 화면 전체가 같은 색조에 잠긴다.
  이 상태에서 `--brand` 로 강조한 요소(`PlanTable.tsx:67` 할인가 `text-brand`)는 배경과
  같은 색상환에 있어 **덜 튄다.** 탐나넷의 "0.11% 포인트가 지배한다" 구조가 성립하는 이유는
  나머지 99.89%가 포인트와 무관한 색이기 때문
- 조치: 브랜드 컬러는 CLAUDE.md 확정이라 건드리지 않는다. **보조면만 중립화한다.**
  `globals.css:25-27` 를 교체:
  ```
  --surface-muted: #f5f7f8;   /* 초록기 제거 — 아주 옅은 중립 */
  --line:          #e3e8e6;
  --line-strong:   #cdd6d1;
  ```
  그리고 **섹션 배경**으로 쓰인 `bg-brand-soft` 를 `bg-surface-muted` 로 바꾼다 — 실측 5곳:
  `PlanTable.tsx:17`, `PlanCalculator.tsx:50`, `LiveFeed.tsx:41`, `Process.tsx:15`,
  `[carrier]/page.tsx:80`.
  (`Process.tsx` 는 G-06 에서 삭제 예정이므로 통합 후 처리)
  ⚠ `PromoBand.tsx:60-62` 의 인라인 그라데이션도 `var(--brand-soft)` 를 쓴다. 여기는
  **밴드 정체성이라 그대로 둔다** — `UI_PORT_LOG.md` 3회차에서 "밝은 면이 밴드로 안 읽힌다"
  문제를 이미 보수한 지점이고, 중립색으로 바꾸면 그 문제가 재발한다.
  `--brand-soft`(`#f3fbf5`)는 뱃지·칩 배경 같은 **작은 면적에만** 남긴다.
  ⚠ 변경 후 `--brand` 대비비 재확인 필요: `#2f9e52` on `#f5f7f8` = 약 3.5:1 →
  큰 글자(18px+ bold)는 통과, 본문 크기 강조에는 `--brand-dark`(#23803f, 약 5.4:1) 사용
- 우선순위: **P0**

### G-20 [색] 액센트가 CTA 외로 번져 포인트 지위를 잃었다
- 탐나넷: 주황 색면 = CTA 버튼 **단 하나**. 나머지는 글자/테두리/알약
- TS-Net 현재: `--accent` 가 ① CTA 버튼 (`PlanCards` `bg-accent`, `[carrier]/page.tsx` 영역)
  ② `PlanTable.tsx:73` 사은품 열 `font-bold text-accent` — 그런데 그 열은 전 행이 `-`(G-07).
  즉 **액센트의 두 번째 용도가 하이픈 9개를 노랗게 칠하는 데 쓰인다**
- 격차: 액센트 총면적 중 상당 부분이 의미 없는 기호에 소비된다
- 조치: G-07 로 사은품 열이 조건부가 되면 자동 해소. 추가로 `--accent` 사용처를
  `grep -rn "accent" FE/components/` 로 전수 점검해 **CTA + 추천 뱃지(G-08) 2용도로 제한**
- 우선순위: P1

### G-21 [색] 히어로 다크 면이 없다 — 퍼스트뷰 대비가 약하다
- 탐나넷: `main_banner` 배경 `#111` (`main_n.css:44`), 면적 715k. 그 위에 흰 폼 카드를 얹어
  **흰 카드가 떠오른다**. 흰 글씨 538k 의 대부분이 여기
- TS-Net 현재: 메인 Hero `<section id="consult" class="... bg-white">` — 흰 배경.
  다크 면은 **Footer 에만** (`brand-deep → brand-dark → brand` 그라데이션)
- 격차: 퍼스트뷰에서 폼 카드가 배경과 같은 흰색이라 카드가 "떠오르지" 않는다.
  랜딩의 유일한 목적이 그 폼인데 가장 약한 대비를 쓰고 있다
- 조치: `FE/components/sections/Hero.tsx` 의 섹션 배경을 다크 면으로.
  CLAUDE.md 는 브랜드 그린을 지정했으니 `#111` 은 쓰지 않고
  `--brand-deep`(#14532b) 기반 그라데이션 + `docs/MIRICANVAS_HERO_PROMPT.md` 로 준비 중인
  히어로 이미지를 `isolate` 아래 깔고 `bg-brand-deep/70` 오버레이.
  폼 카드는 `bg-white shadow-float` 유지 → 대비 확보.
  ⚠ 카피 색 전환 필요 — 현재 히어로 텍스트 클래스가 다크 면에서 안 읽히면 같이 수정
- 우선순위: **P0**

---

## 6. 타이포그래피

### 탐나넷

**폰트**: `reset.css:5-8` → `* { font-family: 'SUIT', sans-serif; }`
(jsdelivr `sun-typeface/SUIT@2` static woff2). 즉 **전역 1종**.
부분적으로 `notoRegular`/`notoBold` 를 지정하지만 `@font-face` 선언이 CSS에 없어
**폴백으로 떨어진다** (결함). 포인트 폰트 `OngleIpSeaBreeze` (손글씨)는 `.p_t` 1클래스,
가격 섹션 아이브로우에만 — jsdelivr `projectnoonnu/2510-1` 에서 로드.

**스케일** (`common.css:23-31`):
```
--font-1-size: 38px   --font-2-size: 30px   --font-2-1-size: 22px
--font-3-size: 19px   --font-4-size: 16px   --font-5-size: 15px (기본)
--font-6-size: 14px   --font-7-size: 12px
--letter-1-spacing: -1.2px
```
토큰 밖 직접 지정이 더 중요하다 (`main_n.css`):
| 용도 | 값 |
|---|---|
| 섹션 h2 | **45px / 800** (`:28`) — 모바일 **26px** (`:541`) |
| 섹션 설명 p | 16px / line-height 1.4, `#333` (`:31`) |
| 아이브로우 | 16px / 700 / `letter-spacing:1px`, 알약 (`:38`) |
| 히어로 h2 | **48px** (인라인) — 모바일 38px (`:551`) |
| 가격 아이브로우 | **26px** (손글씨체) — 모바일 20px |
| 가격 h2 | 45px / **900** (`:299`) |
| 차트 h3 | 24px / 800 |
| 막대 금액·업체명 | 20px / 800·700 |
| 현황 탭 | **22px / 800** — 모바일 18px |
| 후기 카드 h3 | 18px / 800 |
| 빠른메뉴 h3 | 25px / 800 |
| 계열 링크 | 20px / 800 |

**굵기 운용**: `800` 이 사실상 기본 강조. `900` 은 가격 h2 1곳.
`reset.css` 에서 `h1~h6, strong { font-size:100%; font-weight:normal }` 로 전부 리셋한 뒤
개별 재지정 — 즉 **의미태그와 시각 위계가 분리**돼 있다.

**`word-break: keep-all`** 을 `*` 에 적용 (`reset.css:7`). 국문 어절 단위 줄바꿈.

### TS-Net 현재

`globals.css`:
```
--font-sans: var(--font-noto-sans-kr)
--font-display: var(--font-jua)   /* 포인트 전용 — 본문·금액에는 쓰지 않는다 */
body { line-height: 1.7; word-break: keep-all }
h1,h2,h3 { letter-spacing: -0.012em }
```
실측 사용 크기:
| 용도 | 클래스 | px |
|---|---|---|
| 섹션 h2 (`SectionHeading`) | `text-2xl md:text-[2rem] font-black` | **24 → 32** |
| 카드 h3 | `text-lg font-bold` | 18 |
| 표 본문 | `text-sm` | 14 |
| 표 할인가 | `text-base font-black` | 16 |
| 카드 월요금 | `text-2xl font-black` | 24 |
| 각주 | `text-xs text-faint` | 12 |
| Journey 번호 | `text-[4rem] font-black text-brand-light` | 64 |

---

### G-22 [타이포] 섹션 제목이 32px — 레퍼런스의 71%
- 탐나넷: 섹션 h2 **45px / 800**, 모바일 26px. 가격 섹션은 45px / **900**
- TS-Net 현재: `ui/SectionHeading.tsx` → `text-2xl md:text-[2rem]` = **24px / 32px**.
  모바일 24px 는 탐나넷(26px)과 비슷하지만 **데스크톱이 32 vs 45 로 13px 차이**
- 격차: 데스크톱에서 섹션 경계가 약하다. `line-height:1.7`(`globals.css` body)까지 겹쳐
  제목이 본문처럼 흐른다. 탐나넷 h2 의 실질 line-height 는 1.25 수준
- 조치: `ui/SectionHeading.tsx` 의 h2 를 `text-[1.625rem] leading-[1.25] md:text-[2.5rem]`
  (26 / 40px) 로. 45px 까지 올리지 않는 이유는 우리 `max-w-6xl`(1152px)이 탐나넷
  `max-w 1240px` 보다 좁아 같은 크기면 더 꽉 차 보인다. `font-black`(900) 유지
- 우선순위: P1

### G-23 [타이포] 아이브로우(섹션 상단 소제목) 장치가 없다
- 탐나넷: `.eyebrow` — `16px/700`, `letter-spacing:1px`, 알약 (`border:1px solid #ffd8c5;
  background:#fef1ed; color:#ff641f`), h2 와 `margin-bottom:11px`.
  변형 `.eyebrow_text`(배경 없음), `.eyebrow.before_one`(앞에 10px 주황 점).
  실제 사용: `GIFT`, `GOVERNMENT CERTIFIED`, `REAL REVIEW`, `탐나넷이 쌓아온 기록` 등
- TS-Net 현재: `ui/SectionHeading.tsx` 는 `title` + `description` **2슬롯**뿐.
  섹션 상단 라벨 자리가 없다
- 격차: 13섹션을 스크롤할 때 "지금 어느 블록인가"를 알려주는 가장 싼 장치다.
  우리는 섹션이 4개뿐이라 지금은 덜 아프지만, G-02~G-04 로 섹션이 늘면 바로 필요해진다
- 조치: `FE/components/ui/SectionHeading.tsx` 에 `eyebrow?: string` prop 추가.
  스타일은 우리 토큰으로 — `inline-flex rounded-full border border-brand/20 bg-brand-light
  px-4 py-1.5 text-sm font-bold tracking-wide text-brand-dark mb-3`.
  탐나넷 문구(`GIFT`, `REAL REVIEW` 등) **복제 금지** — 한국어 라벨 직접 작성
- 우선순위: P1

### G-24 [타이포] `--font-display`(Jua)가 PromoBand 에만 쓰이고, 그 PromoBand 가 재검토 대상
- 탐나넷: 손글씨 포인트 폰트 `OngleIpSeaBreeze` 를 `.p_t` 1클래스, 가격 섹션 아이브로우
  (26px) 와 그 안의 `<strong>` 2곳에만 쓴다. 극도로 절제된 1회성 사용 — **가격 섹션에**
- TS-Net 현재: `globals.css` `--font-display: var(--font-jua)` + 주석 "포인트 전용 —
  본문·금액에는 쓰지 않는다". 실제 사용처는 **`PromoBand.tsx:82` 단 1곳**
  (`font-display ... text-[clamp(1.75rem,5.2vw,3.5rem)]`)
- 격차: 절제된 1회 사용이라는 운용은 **탐나넷과 동일하게 올바르다.** 문제는 **어디에 썼냐**다.
  탐나넷은 그 1회를 "가격이 제일 싸다"는 핵심 주장에 쓰고, 우리는 중립 자리표시자 문구가
  담긴 밴드(G-06 에서 레퍼런스 근거 소멸로 재검토 대상)에 쓴다.
  즉 **사이트에서 가장 눈에 띄는 폰트가 가장 의미 없는 문장을 떠받친다**
- 조치: Jua 로드는 유지. G-02 `Compare.tsx` 아이브로우 또는 금액 강조 1곳으로 **이전**한다.
  PromoBand 를 유지하기로 결정하면 둘 중 한 곳에서만 쓴다 — 두 곳에 쓰면 포인트가 아니다.
  ⚠ Jua 는 숫자 자폭이 균일하지 않아 **금액 표기에는 쓰지 말 것**
  (`globals.css` 주석의 기존 판단이 맞다). `.tabular` 와 병용 금지
- 우선순위: P2

---

## 7. 전환 장치 (폼·고정바·CTA)

### 탐나넷 — 전환 접점 전수

| # | 장치 | 위치 | 상태 |
|---|---|---|---|
| 1 | 히어로 폼 | `main_banner` 좌측 흰 카드 | 상시 |
| 2 | 지원금 모달 폼 | `#supportModal` | `.support_modal_open` 트리거 **4곳** |
| 3 | PC 우측 스티키 레일 | `position:fixed; top:15%; right:1.5rem; width:190px; z-index:999999`. 흰 카드 `radius 18px`, `box-shadow 0 14px 38px rgba(15,23,42,.12)` | 상시 (스크롤 무관) |
| 4 | 모바일 하단바 | `.m_quick` — `position:fixed; bottom:0; z-index:99`, `padding-bottom: calc(10px + env(safe-area-inset-bottom))`, `box-shadow 0 -8px 28px rgba(15,23,42,.10)` | ≤900px |
| 5 | 헤더 `신청서 작성` | gnb 우측 채움 버튼 | sticky (`scrollTop>100`) |
| 6 | 서브 `product_button_wrap` | 탭1·탭2 각각 2버튼 | 상시 |
| 7 | 계산기 모달 하단 CTA | 2버튼 | 모달 내 |
| 8 | `contact_cta` 섹션 | 400px 전용 밴드 — `☎ 1644-7873` + `문의하기` | 상시 |

**레일 구성** (5항목): `상담센터 대표번호 1644-7873` / `비밀지원금 신청`(모달) /
`월요금 계산기`(모달) / `자유게시판` / `.top`(맨위로)
**모바일 하단바** (4항목): `월요금 계산` / `문의전화` / `지원금 문자받기` / `자유게시판`.
`flex-basis:32%`, 색 분화 — 1번 흰배경+주황테두리+주황글씨, 2·3번 주황배경+흰글씨

HTML 실측 접점 수: `tel:` 4 / `<form>` 2 / `apply.php` 3 / `support_modal_open` 4 = **13개**.
8,819px 당 13개 = **약 680px 마다 1개**.

### TS-Net 현재

| 장치 | 위치 | 실측 |
|---|---|---|
| 히어로 인라인 폼 | `Hero.tsx:185-189` `LeadForm variant="full"`, `page.tsx:39`. `#consult` 앵커를 히어로 섹션(`Hero.tsx:88`)이 보유 | 상시. **Hero 파일 자체의 `<a>`/`<button>` 은 0개** — 전환을 폼에 전부 위임 |
| 하단 고정 상담바 | `StickyConsultBar.tsx`(465줄), `(site)/layout.tsx:19` 전역. `fixed inset-x-0 bottom-0 z-40` | **노출 조건 `scrollY > innerHeight * 0.72`** (`:53-59`). `translate-y-full` ↔ `translate-y-0`, `duration-300` |
| └ 데스크톱 (`lg+`) | `:169-298` 한 줄 폼 — 대표번호 / 관심상품 `w-36` / 이름 `w-28` / 연락처 `w-40` / 필수동의 / 제출 / 접기. `bg-brand-deep/95 backdrop-blur-md` | 접기 상태를 `sessionStorage["tsnet_consultbar_collapsed"]` 보존 (`:62-77`) |
| └ 모바일 (`lg:hidden`) | `:418-446` 하단 **2분할 `nav`** — 좌 `tel:` "전화 상담" `bg-brand-deep py-4` / 우 "상담 신청" `bg-accent py-4` 토글. `paddingBottom: env(safe-area-inset-bottom)` | 탭하면 `:315` 시트 `animate-slide-down max-h-[70vh]` 전개 |
| 헤더 CTA | **없다.** `Header.tsx:125` 주석에 신청 CTA를 **의도적으로 제거**했다고 기록 | 헤더 링크 16개는 전부 통신사/게시판 이동 + `tel:` |
| 맨위로 | `ui/BackToTop.tsx:32` `fixed right-4 bottom-[11rem] z-30 size-11` | `scrollY > 720` 에서 fade-in |
| Turnstile | `StickyConsultBar.tsx:121` `fixed right-4 bottom-24 z-50 lg:bottom-28`. `appearance:"interaction-only"`, `engaged` 이후에만 마운트 | 전역 **1개만** |
| 서브페이지 폼 | `[carrier]/page.tsx:78-100` `#consult` 섹션, `LeadForm variant="compact"` | 상시 |
| 카드별 CTA | `PlanCards.tsx:73-81` `이 상품 상담하기` → `#consult` (최대 3개), `PlanCalculator.tsx:168-174` `이 구성으로 상담 신청`, `CarrierHero.tsx:41-47` | 상시 |
| 전화 링크 | — | 메인 `tel:` **6개**, `/kt` 8개 |
| `#consult` 링크 | — | 메인 **1개**(Footer `:35` 뿐), `/kt` 6개 |

---

### G-25 [전환] 메인 본문의 `#consult` 유도가 0개 — 유일한 1개가 Footer 다
- 탐나넷: 8,819px 에 13접점 (약 680px/1개). 섹션 중간에도 `support_modal_open` 4곳.
  더해 `contact_cta` 400px **전용 전환 밴드**를 Footer 앞에 따로 둔다
- TS-Net 현재: 메인 2,939px 에 `href="#consult"` **단 1개** — 그것도 `Footer.tsx:35` 다(실측).
  즉 **본문 섹션(PromoBand·CarrierHub·Journey·Process)에는 폼으로 가는 링크가 하나도 없다.**
  `Hero.tsx` 자체 링크 0개, `PromoBand.tsx` CTA 0개, `Journey.tsx` CTA 0개,
  `Process.tsx` CTA 0개, `Header.tsx:125` 신청 CTA 의도적 제거
- 격차: 2중 공백이다. ① 헤더에 신청 CTA가 없고 ② 본문에도 없다. 남은 장치는 하단 상담바인데
  그조차 **`scrollY > innerHeight * 0.72` 전에는 화면에 없다**(`StickyConsultBar.tsx:53-59`).
  퍼스트뷰에서는 히어로 폼이 그 역할을 하므로 문제없지만, **히어로를 지나친 뒤 본문을 읽는
  동안 폼으로 돌아갈 명시적 링크가 Footer 까지 내려가야 비로소 나온다**
- 조치: ① `Journey.tsx:46`·`Process.tsx:44` 뒤에 각각 `#consult` 유도 1줄
  (`text-center` + `ui/Button.tsx` 보조 variant). ② 탐나넷 `contact_cta` 에 상당하는
  전용 밴드를 `page.tsx` 의 `Reviews` 뒤에 1개 신설 — 대표번호 + 폼 앵커.
  Footer 전환 밴드(`Footer.tsx:24-50`)와 **중복되므로 Footer 쪽을 축소**하거나 신규 밴드를
  Footer 밴드로 대체. ③ `CarrierHub.tsx` 카드에는 `#consult` 를 붙이지 말 것 —
  카드의 목적은 서브페이지 이동이고, 거기 가면 `#consult` 6개가 기다린다
- 우선순위: **P0**

### G-26 [전환] 우측 스티키 레일에서 "계산기" 만 재검토 대상
- 탐나넷: 레일 5항목. 그중 `월요금 계산기` 는 **다른 어디에도 없는 고유 접점**
- TS-Net 현재: `UI_PORT_LOG.md` 에서 레일을 1:1 대조해 "맨 위로"만 채택하고 나머지는
  중복으로 판정 — 당시 판단은 타당했다. 단 그 대조표에 **계산기가 없었다**
  (PlanCalculator 가 그 뒤 2026-09-28 에 생겼다)
- 격차: 지금 계산기는 서브페이지 고정 섹션 1곳에만 있다. 메인에서는 접근 경로가 0이다
- 조치: 레일 전체 복원은 여전히 불필요. `ui/BackToTop.tsx` 와 같은 우하단 스택에
  **계산기 버튼 1개만** 추가하는 안. 다만 하단 상담바(4.5~5.5rem) + Turnstile(`bottom-24`)
  + BackToTop(`bottom-[11rem]`) 이 이미 쌓여 있어 네 번째를 넣을 수직 공간이 없다.
  → 대안: 메인 `CarrierHub.tsx` 카드에 `요금 계산` 보조 링크(`/{slug}#calc`)를 넣고
  `PlanCalculator` 섹션에 `id="calc"` + `scroll-mt-24` 부여. 이게 비용 대비 효과가 낫다
- 우선순위: P1

### G-27 [전환] 모바일 하단바는 거의 동등 — 남은 격차는 "계산기" 접점과 노출 시점
- 탐나넷: `.m_quick` 4항목 `flex-basis:32%`, 색으로 위계 분화(1번 흰배경+주황테두리 /
  2·3번 주황 채움). `padding-bottom: calc(10px + env(safe-area-inset-bottom))`,
  `box-shadow: 0 -8px 28px rgba(15,23,42,.10)`, `z-index:99`.
  항목: `월요금 계산` / `문의전화` / `지원금 문자받기` / `자유게시판`.
  **스크롤 위치와 무관하게 상시 노출**
- TS-Net 현재: `StickyConsultBar.tsx:418-446` — 하단 2분할 `nav`(`grid grid-cols-2`),
  좌 `tel:` "전화 상담" `bg-brand-deep py-4` / 우 "상담 신청" `bg-accent py-4` 토글
  (`aria-expanded`, 셰브론 `rotate-180`). `paddingBottom: env(safe-area-inset-bottom)` **적용됨**.
  탭하면 `:315` 시트가 `animate-slide-down max-h-[70vh] overflow-y-auto rounded-t-panel`
  로 전개되고 그 안에 전체 폼(관심상품/이름/연락처/동의/제출)
- 격차: **당초 추정과 달리 구조·safe-area·색 위계는 이미 동등하거나 우위다**
  (탐나넷은 바에서 폼을 못 열고 다른 페이지로 보낸다. 우리는 바에서 바로 접수한다).
  남은 실제 격차 2개 — ① **항목 수 2 vs 4**: 계산기·게시판 접점이 모바일 바에 없다.
  ② **노출 시점**: 우리는 `scrollY > innerHeight*0.72` 전에는 바가 없고(`:53-59`),
  탐나넷은 상시다. 모바일 퍼스트뷰 하단 72%까지는 전환 장치가 히어로 폼 하나뿐
- 조치: ① 2분할을 3분할로 늘리지 **말 것** — 터치 타겟이 좁아지고 폼 전개 버튼이 약해진다.
  대신 G-26 처럼 계산기는 `CarrierHub` 카드 내 보조 링크로 해결.
  ② `:53-59` 임계값 `0.72` → `0.55` 로 낮추는 안을 검토. 단 히어로 폼과 바가 동시에
  보이면 중복이므로, 모바일에서는 **히어로 폼이 뷰포트를 벗어나는 지점**을
  `IntersectionObserver` 로 잡는 쪽이 정확하다 (`ui/Reveal.tsx` 패턴 재사용 가능)
- 우선순위: P1

### G-28 [전환] 동의 체크박스 — 우리가 법적으로 옳고 레퍼런스가 틀렸다 (복제 금지 확인)
- 탐나넷: 히어로 폼의 동의 체크박스가 `<input type="checkbox" name="agree" value="1" **checked**>`
  — **기본 체크 1개로 통합**. 라벨 `개인정보 수집 및 이용에 동의합니다.`
  마케팅 수신 동의가 **분리되어 있지 않다**
- TS-Net 현재: `site-config.ts:196-220` `CONSENT` — `privacyLabel` / `privacyShort` /
  `privacyDetail[]` / **`marketingLabel: "마케팅 정보 수신 동의"`** 로 **분리 보유**
- 격차: 없다. 우리 쪽이 CLAUDE.md 규칙 2(동의 분리)와 개인정보보호법에 맞다
- 조치: **아무것도 하지 않는다.** 이 항목은 "레퍼런스를 따라가면 안 되는 지점"의 기록으로 남긴다.
  구현자가 폼 전환율 개선을 위해 체크박스를 통합하거나 기본 체크하려 할 경우 **금지**
- 우선순위: — (금지 사항)

---

## 8. ⚠ 복제 금지 목록 (CLAUDE.md 규칙 위반 항목)

구현자가 이 문서를 읽고 "탐나넷처럼 하자"고 가져가면 **위법·규칙위반이 되는 항목**이다.
구조만 참조하고 내용은 우리가 근거를 가진 것으로 채운다.

| # | 탐나넷 패턴 | 충돌 | 우리 처리 |
|---|---|---|---|
| 1 | 실시간 현황에 `지원금 94만원`·`108만원` 금액 노출, 12행 상시 롤링 | CLAUDE.md **규칙 1**(실제 `leads` 만 마스킹 노출, 가짜 데이터 금지) + **규칙 6** | `LiveFeed` 는 실 데이터 5건 이상에서만. `gift_label` 필드(`LiveFeed.tsx:15`)는 **DB에 실제 값이 있을 때만** 표시. 5건 미만은 G-05 정적 대체 |
| 2 | 가격 막대차트의 `A업체 52,800 / B업체 49,500` 경쟁사 비교 + 손글씨 `월 최대 12,100원 더 저렴!` | 표시광고법 — 비교광고는 객관적 근거·출처 필수. 익명 "A업체" 표기로는 입증 불가 | G-02 Compare 는 **통신사 4사 비교**(우리 `plans` 데이터)로만. **경쟁 대리점 비교 금지**. "업계 최저가", "최대 N원 더 저렴" 류 문구 금지 |
| 3 | `3년 연속 한국 소비자 베스트 브랜드 대상 수상` (664px) | 미보유 수상 표시 = 허위표시 | G-04 `TRUST` 는 `enabled:false` 기본. 실제 보유 서류만 |
| 4 | `국가 공인기관에서 인증 받은 공식 가입센터` + 인증서 8장 (1,097px) | 동일 | 사업자등록증·통신판매업신고증·사전승낙서 등 **실보유분만**, 증빙 확보 후 |
| 5 | `네이버 인터넷 누적 가입자수 1위` 뱃지 | 출처 없는 순위 주장 | 금지 |
| 6 | 사은품 카드 `890,000원 → 무료 + 사은품` | 규칙 6 — 근거 없는 금액 하드코딩 | G-03 `GIFT_SECTION` 설정값으로만. 운영자가 실제 지급 품목·금액 제공 시 입력 |
| 7 | 동의 체크박스 1개 통합 + 기본 `checked` | 규칙 2 (동의 분리) + 개인정보보호법(사전 동의) | G-28 — 현재 분리 구조 유지. 기본 체크 금지 |
| 8 | 요금표 사은품 셀에 `@만원` 자리표시자 프로덕션 노출 | 품질 결함 | 우리는 데이터 없으면 **열을 숨긴다** (G-07) |
| 9 | `prefers-reduced-motion` 미대응 | 접근성 | 우리 `globals.css` 대응 유지. 신규 모션도 같은 블록 적용 |
| 10 | 카피·이미지·CSS 전반 | **규칙 5** | 본 문서의 탐나넷 문구 인용은 전부 **분석 목적 인용**이며 15자 이내로 제한했다. 구현물에 옮기지 말 것 |

---

## 9. P0 실행 체크리스트

전환에 직접 영향 있는 항목만. 위에서 아래 순서로 처리하면 의존성이 맞는다.

### 0차 — UI 작업보다 먼저 (§10 선행 이슈)

- [ ] `CONSENT.privacyDetail` 고지 보유기간(D+1095 / D+14)과 `leads.purge_at`(now()+2y) 불일치 해소
      — 마이그레이션 추가 또는 고지 문구 수정 중 하나. **법적 리스크**
- [ ] `docs/PORT_TAMNANET.md`·`docs/UI_PORT_LOG.md` 상단에 "헤더 구조 변경됨(2026-10-08),
      2단 헤더 관련 기술은 과거 기록" 경고 추가
- [ ] `SITE.tel` 자리표시자(`1600-0000`) 교체 — 현재 `tel:` 링크 14개가 무효 번호를 가리킨다

### 1차 — 지금 코드만으로 가능 (데이터 불필요)

> **2026-10-13 전수 재확인.** 체크박스가 비어 있었지만 **대부분 이미 되어 있었다** —
> 이 목록은 10-08 작성 시점의 코드를 기준으로 쓰였고, 그 뒤 두 라운드의 작업이
> 반영되지 않았다. 빈 체크박스를 믿고 다시 손대면 같은 일을 두 번 하거나
> 이미 내린 결정을 되돌린다(G-21 이 그 경우다). 실제 상태를 근거와 함께 적는다.

- [x] **G-07** 사은품 열 조건부 렌더 — `PlanTable.tsx` `gift: list.some((p) => p.gift_amount != null)`.
      열 폭 합으로 표 최소 폭을 계산해, 숨긴 열만큼 폭이 실제로 줄어든다
- [x] **G-19** 색 토큰에서 초록기 제거 — `globals.css` `--surface-muted: #f5f8fa`,
      `--line: #e4eaf0`, `--line-strong: #cbd5df` (중성 회청). 섹션 배경도 전환 완료
- [x] **G-06** `Journey` + `Process` 통합 — `Process.tsx` 는 삭제됐고 `Journey` 하나다
- [x] **G-09** 모바일 요금표 — **카드로 바꿨다 (2026-10-13).**
      390px 실측에서 표는 최소 430~540px 이 필요한데 들어오는 폭이 356px 이라
      **74~184px 이 잘려 있었고, 잘린 쪽에 `약정` 이 있었다.** 금액은 보여 주고
      조건은 가린 화면이다. "밀면 보인다" 힌트(`TABLE_SCROLL_HINT`)를 띄워
      뒀지만 힌트는 조건을 보여 주는 게 아니라 직접 찾으라는 안내다.
      `md` 미만은 `PlanCards`(상품명 + 월 요금 + 나머지를 `dl` 로), `md` 이상은
      표 그대로. 열 숨김 판정(`cols`)을 **두 레이아웃이 공유**해 서로 다른
      항목을 보여 줄 수 없다. 측정: 390px 에서 표 0개 렌더·카드 14장·
      페이지 가로 스크롤 없음·대비 위반 0 / 768px 에서 표 복귀·잘림 0px
- [~] **G-08** 추천 행 강조 — **전제가 바뀌어 해당 없음.** 추천 상품은 표에서
      제외되고(`sort_order < TABLE_SORT_MIN`) 별도 카드로 나간다. 표 안에
      강조할 "추천 행" 이 없다. 표에 추천을 되살릴 이유가 생기면 그때 다시 본다
- [x] **G-25** `#consult` 밀도 — 메인(390px, 17,081px 높이)에 인라인 유도 **14개**
      (평균 간격 1,268px) + **상시 고정 하단 바**(`StickyConsultBar`, 59px) +
      헤더 CTA. "메인 `#consult` = Footer 1개뿐" 은 10-08 이전 상태다.
      최대 공백 구간은 3,283px(통신사 카드 → 비교 섹션)이지만 그 구간에도
      고정 바가 화면에 떠 있어 전환 수단이 끊기지 않는다

### 2차 — 신규 컴포넌트 (설정 슬롯은 비워두고 `enabled:false` 시작)

- [ ] **G-05** `LiveFeed.tsx:35` — 5건 미만 정적 대체 블록.
      **지어낸 접수 데이터 금지**. 통신사 4사·절차 소요시간·대표번호만
- [ ] **G-03** `site-config.ts` `GIFT_SECTION = { enabled:false, items:[] }` +
      `sections/GiftShowcase.tsx` (카드당 `#consult` CTA 1개, CSS scroll-snap 캐러셀)
- [ ] **G-02** `sections/Compare.tsx` — 통신사 4사 월요금 가로 막대.
      데이터 `lib/plans.ts` `getCompareRows()`. **경쟁 대리점 비교 절대 금지**
- [ ] **G-12** `sections/PlanNotice.tsx` — `<details>` 3블록 (신청 전 확인 / 약정·위약금 /
      사은품 반환조건). 본문 `text-sm text-muted`(faint 금지).
      `site-config.ts` `PLAN_NOTICE`. **내용은 우리 실제 계약 조건** — 탐나넷 문구 복제 금지
- [x] ~~**G-21** `Hero.tsx` 배경을 `--brand-deep` 기반 다크 면~~ —
      **폐기 (CLAUDE.md 와 정면 충돌).** 2026-10-08 결정이 "진초록 풀블리드는
      쓰지 않는다 / 히어로가 초록 풀블리드이던 이전 구성은 폐기" 이고,
      레퍼런스 실측도 "배경 면적 90%가 순백, 포인트색은 글자로만" 이었다.
      이 항목은 그 실측 **이전**에 쓰였다. 되살리면 색면 비율 상한(메인 1.22%)이
      한 번에 깨진다. 요구사항 4번(완전 하얀색 + 쨍한 녹색)과도 반대 방향이다

### 검증

- [ ] `npx tsc --noEmit` / `npx next lint --max-warnings=0` / `npm run build`
- [ ] 1440 / 1024 / 768 / 375 뷰포트 실측 — 특히 G-09 표, G-19 색 대비, G-21 히어로 카피 가독성
- [ ] `prefers-reduced-motion: reduce` 에서 신규 모션 전부 정지 확인
- [ ] 신규 섹션 전부 `<Reveal>` 적용 확인 (G-17)
- [ ] 메인 `#consult` 링크 수 재측정 — 목표 2,939px → (섹션 추가 후) 약 600~700px 당 1개

---

## 10. 미조사 / 불확실 영역 (추측하지 않은 것)

정직하게 남긴다. 구현 전 확인이 필요하다.

1. **`heroPulse` / `heroArrow` 의 CSS 정의** — 실측 데이터에 1.8s·1s 로 존재하지만,
   취득한 7개 CSS 파일 어디에도 `@keyframes heroPulse` 가 없다. 인라인 `<style>` 또는
   취득 못 한 파일에 있을 수 있다. **지속시간만 알고 변형 내용은 모른다**
2. **탐나넷 섹션별 실제 스크롤 체류 시간·전환율** — 측정 불가
3. **모바일 실기기 렌더** — `curl` 기반 조사라 iOS Safari 의 `100vh`·safe-area 실동작 미확인.
   우리 쪽 `env(safe-area-inset-bottom)` 은 코드상 적용 확인됨(`StickyConsultBar.tsx:421`)
4. **`gif_bn`(334px) GIF 배너의 내용** — 이미지라 텍스트 추출 불가. 2026-09-23 관찰 자료의
   "단어 교체 애니메이션 밴드"가 이 GIF로 대체된 것인지 단정하지 못한다
5. **`PromoBand` 의 레퍼런스 근거 소멸** — 현행 `main_n.css`·HTML 에 해당 구조가 없음을 확인했으나,
   탐나넷이 의도적으로 제거한 것인지 다른 페이지로 옮긴 것인지는 모른다 (G-06)

### 조사 중 발견한, 본 문서 범위 밖의 선행 이슈

UI 품질 축은 아니지만 구현자가 먼저 알아야 하는 것.

1. **기존 분석 문서 2종이 현재 코드와 어긋난다.** `docs/PORT_TAMNANET.md`·`docs/UI_PORT_LOG.md`
   의 핵심 산출물인 **2단 헤더가 현재 코드에 없다.** `Header.tsx`(263줄)는
   `sticky top-0 z-40` **1단 바**이고, 브랜드 존 / 2단 내비 / 바 높이를 채운 accent CTA 가
   모두 사라졌다(`Header.tsx:125` 주석: 신청 CTA 의도적 제거). 두 문서의 "최종 검증" 표는
   더 이상 현재 상태를 서술하지 않는다 → **두 문서 상단에 "2026-10-08 기준 헤더 구조 변경됨,
   아래 헤더 관련 기술은 과거 기록" 경고를 추가**하거나 해당 절을 갱신할 것
2. **`CONSENT.privacyDetail` 의 보유기간이 DB 스키마와 불일치.**
   `site-config.ts:201-209` 주석이 이미 경고하고 있다 — 화면에는 `D+1095 / D+14` 로 고지하는데
   `BE/supabase/migrations/001_init_schema.sql` 의 `leads.purge_at` 은 일괄 `now() + 2 years`.
   **고지한 보유기간과 실제 삭제 시점이 다른 상태**이므로, 마이그레이션 또는 고지 문구 중
   하나를 맞춰야 한다. UI 작업보다 우선순위가 높다
3. **`SITE.business` 6개 필드가 전부 `TODO`** (`site-config.ts:17-24`), `SITE.tel` 도
   `"1600-0000"` 자리표시자(`:15`). G-04 신뢰 섹션은 이게 채워지기 전에는 켤 수 없다.
   현재 `tel:` 링크 14개(메인 6 + `/kt` 8)가 전부 존재하지 않는 번호를 가리킨다
4. **`PARTNER_CARD.details`** 에 구체적 할인 금액이 비어 있다(`site-config.ts:235` TODO).
   `/kt` 의 `제휴카드 할인 안내` 섹션이 내용 없이 렌더되고 있다

---

## 변경 이력

- 2026-10-08 문서 생성. 탐나넷 HTML·CSS 7종·JS 2종·통신사 서브페이지 원본 취득 후 작성.
  색 면적·섹션 높이·호버 트랜지션은 라이브 DOM 실측 데이터 사용.
  "흰색 + 쨍한 녹색" 전제를 CSS 실측으로 정정 (실제: 흰색 90% + 주황 포인트 0.11%)
- 2026-10-08 TS-Net 컴포넌트 21종 전수 직독 후 1차 초안 정정 —
  ① Reveal 이 `CarrierHub` 1곳에만 적용됨 확인 (G-17 을 P2→P1 승격)
  ② `Reviews.tsx` 에 네이티브 snap 캐러셀이 **이미 있음** 확인 (G-16 조치 축소)
  ③ `--font-display` 가 `PromoBand.tsx:82` 에 쓰이고 있음 확인 (G-24 전면 재작성)
  ④ `Header.tsx` 의 2단 구조·신청 CTA 가 **제거됨** 확인 (G-25 격차 확대, §0·§10 경고 추가)
  ⑤ `StickyConsultBar.tsx` 모바일 2분할 + safe-area 대응 **이미 구현됨** 확인 (G-27 축소)
  ⑥ `Journey`/`Process` 중복의 구체 내용 확인 (G-06 통합 방향 확정)
