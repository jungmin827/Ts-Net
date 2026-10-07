# 홍보 이미지 구조·에셋 비평 (목표 5 · 6)

검증일 2026-10-08 · 대상 커밋 `4bd35ab` 기준 작업본
검증 환경 — dev :3100 (이미 기동 중), `npx tsc --noEmit` 0, `npx eslint .` 0.
`next build` 는 지시대로 돌리지 않았다. Supabase 쓰기 없음.

실제로 돌린 실험 —
`PROMO_IMAGES` 에 항목 추가 → 렌더 확인 → `width`/`height` 오기 → `enabled:false` →
**원복 완료**(`md5 e1d0289c3b8dc5da52ae1b9ec99f9406`, 추가 전후 동일).
브라우저는 전용 탭(2011918775)을 만들어 쓰고 닫았다. 모바일 폭은 `resize_window` 가
먹지 않아(요청 후에도 `innerWidth` 1512 고정) **같은 오리진 iframe 을 386px 로 띄워** 확인했다.

---

## ⚠ 먼저 — 내 실험 항목이 커밋에 섞여 들어갔다

```
$ git log --oneline -S"zz-critique-probe" -- FE/lib/site-config.ts
413c801 fe: 엑셀 내보내기 검증 스크립트 — 기간 역전이 조용히 통과하고 있었다 (목표 3)
```

내가 구조 검증용으로 잠깐 넣었던 `id: "zz-critique-probe"` 항목이, 메인 세션이
`413c801` 을 커밋하는 순간 같이 빨려 들어갔다. 작업본에서는 이미 지웠으므로
`git status` 에 `FE/lib/site-config.ts` 가 삭제 9줄로 남아 있다.
**이 삭제를 그대로 커밋하면 해소된다.** 내 쪽에서는 커밋하지 않았다.

---

## P-01 [중간] `alt: ""` 가 아무 저항 없이 통과한다

- **주장**: `docs/PROMO_IMAGE_GUIDE.md` "`alt` — … **비워두지 말 것.**",
  `FE/lib/site-config.ts:294` "빈 문자열 금지".
- **실제**: 타입은 `alt: string` 뿐이다(`site-config.ts:295`). `PromoSlot.tsx:20-22` 의
  필터는 `enabled`·`slot`·`desktop` 만 본다. 재현 — `PROMO_IMAGES` 에
  `{ id:"zz-critique-probe", slot:"afterHero", desktop:"/promo/check-three.png",
  width:2240, height:938, alt:"", enabled:true }` 를 넣으면
  `curl -s localhost:3100/ | grep 'alt=""'` 가 그대로 잡힌다. `tsc`·`eslint` 둘 다 통과.
- **왜 문제인가**: `alt=""` 는 "장식 이미지"라는 **적극적 선언**이라 스크린리더가 통째로
  건너뛴다. 이 이미지들은 본문 전부가 그림 안에 박혀 있어서, 빈 alt 하나로
  "하는 일 / 하지 않는 일" 전체가 보조기기에서 사라진다. 게다가 `href` 가 있으면
  **이름 없는 링크**가 되어 WCAG 2.4.4·4.1.2 를 동시에 깬다(P-05 참고).
  운영자가 "나중에 채우지" 하고 비워두면 아무도 못 잡는다.
- **조치**: `FE/lib/site-config.ts` — `PROMO_IMAGES` 선언 직후에
  `PROMO_IMAGES.forEach(i => { if (i.enabled && i.desktop && !i.alt.trim()) throw new Error(...) })`
  같은 모듈 로드 시점 단언을 둔다. 서버 컴포넌트에서 import 되므로 개발 중 즉시 터진다.
  또는 `FE/scripts/verify-goals.mjs` 의 G5 에 "alt 비어 있지 않음" 검사를 추가한다.

## P-02 [중간] 가이드의 슬롯 위치표가 실제 삽입 지점과 다르다

- **주장**: `docs/PROMO_IMAGE_GUIDE.md` 의 표 —
  `afterCarrierHub` = "통신사 4카드 아래", `beforeFooter` = "후기 아래 · 푸터 위".
- **실제**: `FE/app/(site)/page.tsx:65` 의 `<PromoSlot slot="afterCarrierHub" />` 는
  `CarrierHub`(52) → `CarrierMatrix`(56) → `ConsultCue`(57) → `PriceCompare`(61) →
  `ConsultCue`(62) **다섯 섹션을 건너뛴 뒤**에 있다.
  `beforeFooter`(84) 도 `Reviews`(75) 가 아니라 `Faq`(78) → `ConsultCue`(79) →
  `PrivacyPromise`(83) 뒤다. 브라우저에서 읽은 `<main>` 자식 순서 —
  `consult · 안내문구 · PROMO:what-we-do · 실시간현황 · 통신사별 상품 보기 ·
  통신사별로 고를 수 있는 것 · (cue) · 같은 조건, 통신사별 월 요금 · (cue) ·
  PROMO:choose-criteria · 신청에서 설치…과정 · (cue) · PROMO:check-three ·
  상담은 이렇게 진행됩니다 · (cue) · 자주 묻는 질문 · (cue) ·
  연락처를 어떻게 다루는지 밝힙니다 · PROMO:before-call`.
- **왜 문제인가**: 운영자가 "통신사 카드 바로 밑에 사은품 배너"를 의도하고
  `afterCarrierHub` 를 고르면, 요금표 두 개를 지나친 한참 아래에 뜬다.
  배포하고 눈으로 봐야 알아챈다. 표가 거짓이면 슬롯 이름은 쓸모가 없다.
- **조치**: `docs/PROMO_IMAGE_GUIDE.md` 의 표를 실제 순서대로 고치거나
  (`afterCarrierHub` → "요금 비교표 아래", `beforeFooter` → "개인정보 안내 아래 · 푸터 위"),
  슬롯 이름 자체를 `afterPriceCompare` / `afterPrivacy` 로 바꾼다.
  (`page.tsx` 는 메인 세션 소유라 수정하지 않았다.)

## P-03 [중간] 가이드 "각 필드" 목록에 `mobile`·`mobileWidth`·`mobileHeight` 가 없다

- **주장**: `docs/PROMO_IMAGE_GUIDE.md` "### 각 필드" 는 `width`/`height`, `alt`,
  `href`, `enabled` 네 개만 설명한다. `mobileWidth`/`mobileHeight` 는
  위쪽 코드 예시에 값으로만 한 번 스쳐 지나간다.
- **실제**: `FE/components/sections/PromoSlot.tsx:44-45` 는
  `width={it.mobileWidth ?? it.width}` `height={it.mobileHeight ?? it.height}` 로
  **조용히 데스크톱 치수로 대체**한다.
- **왜 문제인가**: 재현 — `mobile: "/promo/x-m.png"` 는 넣고 `mobileWidth`/`mobileHeight`
  를 빠뜨리면, 750×1570 짜리 모바일 이미지가 2240×1155(가로비 1.94) 자리로 잡힌다.
  358px 폭 기준 자리표시자 185px → 로드 후 749px, **564px 가 튀어오른다.**
  빠뜨리기 가장 쉬운 필드가 설명에 없고, 빠뜨려도 아무도 경고하지 않는다.
- **조치**: `docs/PROMO_IMAGE_GUIDE.md` "각 필드" 에 세 항목을 추가하고
  "`mobile` 을 넣으면 `mobileWidth`/`mobileHeight` 도 **반드시** 함께 넣는다" 를 명시.
  코드 쪽은 `mobile` 이 있는데 `mobileWidth` 가 없으면 터지게 하는 편이 낫다.

## P-04 [중간] 가이드가 "덮어쓰기" 사고의 증상을 틀리게 적는다

- **주장**: `docs/PROMO_IMAGE_GUIDE.md` "## 이미지를 교체할 때" —
  "비율이 어긋나고, 결과적으로 **이미지가 눌리거나 늘어나 보이고** 레이아웃이 밀립니다."
- **실제**: 눌리지 않는다. `PromoSlot.tsx:38` 의 클래스가 `h-auto w-full` 이라
  로드가 끝나면 높이는 **실제 파일 비율로 다시 계산**된다. 브라우저에서 실측 —
  `width=1000 height=2000` 로 적은 2240×938 이미지를 1120px 폭에 놓으면
  `{"placeholderHeight":2240,"loadedHeight":469,"shiftPx":1771}`.
  계산된 `aspect-ratio` 는 `auto 1000 / 2000` 이고, `auto` 접두사 때문에
  자연 비율을 알게 된 순간 적은 값은 버려진다.
- **왜 문제인가**: 운영자가 "눌려 보이는지" 를 기준으로 점검하면 **영원히 아무 이상도
  못 본다** — 증상은 오로지 "스크롤 중 아래 내용이 1771px 튀어오름" 이기 때문이다.
  같은 문서 위쪽(“### 각 필드”)에는 레이아웃 시프트라고 바르게 적혀 있어서
  문서 안에서도 서로 모순된다.
- **조치**: `docs/PROMO_IMAGE_GUIDE.md` 해당 단락에서 "눌리거나 늘어나 보이고" 를 빼고
  "로드 전 자리표시자만 틀린 비율로 잡혀 스크롤 중 내용이 크게 튄다" 로 바꾼다.

## P-05 [중간] 홍보 이미지 링크의 이름이 alt 전문이고, 목적지를 말하지 않는다

- **주장**: `docs/GOAL_PLAN.md:414` — "홍보 이미지 링크 4개는 `img alt`로 이름을 얻는다"
  (의도된 설계로 적혀 있다).
- **실제**: `PromoSlot.tsx:57-64` 가 `<Link href="#consult">` 로 `<Image>` 를 감싼다.
  링크 4개 모두 `href="#consult"` 이고(브라우저 확인), 접근 가능한 이름은 alt 전문이다.
  `what-we-do` 의 alt 는 **249자** — "하는 일과 하지 않는 일을 먼저 적어둡니다 — 합니다:
  … 동의하지 않으신 마케팅 연락은 드리지 않습니다".
- **왜 문제인가**: 스크린리더 링크 목록에서 249자짜리 항목 4개가 뜨고, 그중 어느 것도
  "상담 신청으로 간다"는 사실을 말하지 않는다(WCAG 2.4.4). 이미지를 **설명하는 문장**과
  링크의 **목적지를 알리는 문장**은 원래 다른 글인데 하나로 겸하고 있다.
- **조치**: `PromoSlot.tsx` 에서 `<Link>` 에 `aria-label="상담 신청하기"` 를 주고
  내부 `<Image>` 의 alt 는 그대로 두거나, 반대로 이미지를 `alt=""` 로 두고
  링크에 짧은 이름을 준 뒤 본문은 `<figcaption class="sr-only">` 로 따로 낸다.
  (메인 세션 소유 파일이라 수정하지 않았다.)

## P-06 [낮음] 설정 치수가 실제 파일과 맞는지 아무 데서도 대조하지 않는다

- **주장**: 가이드 "원본 픽셀 크기를 **정확히** 적는다".
- **실제**: 지금은 8장 전부 정확하다(실측: 2240×1155/938/1012/991, 750×1570/1582/1737/1882 —
  `PROMO_IMAGES` 값과 일치). 하지만 맞는지 보는 코드는 없다.
  `FE/scripts/verify-goals.mjs:175-193` 의 G5 는 슬롯 개수·`return null` 문자열·
  `mobileWidth` 문자열 포함 여부·렌더된 소스 개수만 본다.
- **왜 문제인가**: P-04 의 1771px 시프트가 조용히 들어올 수 있는 유일한 통로가
  이 미검증 구간이다. 지금 맞는 건 사람이 맞게 적었기 때문이지 구조 때문이 아니다.
- **조치**: `FE/scripts/verify-goals.mjs` G5 에 `sharp(파일).metadata()` 로
  `width`/`height`/`mobileWidth`/`mobileHeight` 를 대조하는 검사를 추가한다.

## P-07 [낮음] 중복 `id`·빈 `desktop` 이 조용히 넘어간다

- **실제**: `PromoSlot.tsx:28` 의 `key={it.id}` 는 중복 id 를 막지 않는다.
  `desktop: ""` 는 `PromoSlot.tsx:21` 의 `&& i.desktop` 때문에 **항목이 통째로 사라진다**
  (주석과 `site-config.ts:284` 에 "비우면 렌더링되지 않는다"고 적혀 있으니 의도된 동작).
- **왜 문제인가**: 운영자가 경로를 오타내면 404 도 아니고 깨진 아이콘도 아니고
  **아무 일도 안 일어난다.** 뭐가 잘못됐는지 알 단서가 없다.
- **조치**: P-06 과 같은 자리에서 `desktop` 이 가리키는 파일이 `FE/public` 아래
  실제로 존재하는지도 함께 확인한다.

---

## P-08 [높음] `check-three` 의 마무리 문장 대비 2.87:1 — AA 미달

- **주장**: `CLAUDE.md` 는 본문 4.5:1 기준을 전제로 토큰 용도를 못박아 뒀고,
  `docs/GOAL_PLAN.md:786` 은 "G6 홍보 이미지 4/4" 로 통과를 적어 뒀다.
  PNG 라서 `FE/scripts/contrast-audit.js` 의 대상이 아니다.
- **실제**: 픽셀을 직접 세어 보니 `check-three.png` 에만 `rgb(142,154,166)` = `#8e9aa6`
  가 3,555px 쓰이고 있다. **흰 배경 대비 2.87:1.**
  - 위치: `check-three.png` bbox `(111,868) → (698,893)`, 글자 높이 26px —
    "숫자부터 말하지 않습니다. 조건부터 말씀드립니다." 꼬리 문장.
    표시 폭 1120px 기준 13px 높이(약 15px 폰트)라 **큰 글자 예외(3:1)도 못 넘긴다.**
  - 모바일판도 같다: `check-three-m.png` bbox `(57,1516) → (546,1537)`,
    354px 표시 기준 글자 높이 10.4px.
- **원인**: 생성기가 둘인데 상수가 다르다 —
  `FE/scripts/build-promo-image.mjs:32` `faint: "#8e9aa6"` (check-three 전용),
  `FE/scripts/build-promo-images-2.mjs:36` `faint: "#687380"` (나머지 3종).
  나머지 3종의 같은 자리는 4.82:1 로 통과한다. 즉 **1차 생성기만 옛 회색에 남아 있다.**
- **왜 문제인가**: 저시력 사용자가 네 장 중 한 장의 마무리 문장만 못 읽는다.
  더 나쁜 건, 이 문장이 "숫자부터 말하지 않습니다"라는 **신뢰 선언**이라는 점이다.
  PNG 안이라 자동 감사에 영원히 안 걸린다.
- **조치**: `FE/scripts/build-promo-image.mjs:32` 의 `faint` 를 `#687380` 으로 바꾸고
  재생성한다. 단 재생성 시 **파일명을 바꿔야 한다**(가이드의 덮어쓰기 주의 + P-10 주의).
  동시에 `FE/scripts/verify-goals.mjs` 에 "promo PNG 안의 색이 전부 팔레트 안이고
  흰 배경 대비 4.5:1 이상" 검사를 넣어 다음에 또 새지 않게 한다.

## P-09 [중간] 하나의 `alt` 를 두 이미지에 쓰는데, 두 이미지의 문구가 서로 다르다

- **주장**: `site-config.ts:294` "**이미지 안의 핵심 문구를 그대로 옮긴다.**"
- **실제**: `PromoSlot.tsx:35,48` 이 데스크톱·모바일 `<Image>` 에 같은 `it.alt` 를 넘긴다.
  그런데 두 소스의 제목이 다르다 —

  | id | 데스크톱 이미지 | 모바일 이미지 | `alt` 가 옮긴 쪽 |
  |---|---|---|---|
  | `choose-criteria` | "통신사는 어디가 더 좋은지가 **아니라** 무엇이 맞는지로 **고릅니다**" | "어디가 더 좋은지**보다** 무엇이 맞는지를 먼저 **봅니다**" | 데스크톱 |
  | `what-we-do` | "…같은 기준으로 **비교해 드립니다**" | "…같은 기준으로 **비교합니다**" | 데스크톱 |
  | `check-three` | "가입 전, 이 세 가지만 확인하세요" | 동일 | 어느 쪽도 아님 — alt 는 "가입 전 확인할 세 가지" |

  마무리 문장 처리도 제각각이다 — `choose-criteria`·`before-call` 은 앞 절만 옮겼고
  ("어느 통신사가 더 낫다고 말하지 않습니다", "모르셔도 상담은 됩니다"),
  `check-three` 는 꼬리 문장("숫자부터 말하지 않습니다. 조건부터 말씀드립니다.") 대신
  부제를 옮겼으며, `what-we-do` 는 "지키지 못할 약속은 적지 않았습니다." 를 통째로 뺐다.
- **왜 문제인가**: 모바일 사용자가 스크린리더로 듣는 문장과 화면에 박힌 문장이
  글자 그대로 다르다. 한 필드로 두 그림을 설명하는 구조 자체가 "그대로 옮긴다"는
  규칙과 양립하지 않는다.
- **조치**: 둘 중 하나. (a) 두 소스의 문구를 통일한다(생성기 `COPY` 의 `title`/`titleM`
  을 같은 문장으로) — 가장 싸다. (b) `PromoImage` 에 `altMobile?: string` 을 더하고
  `PromoSlot.tsx:48` 에서 `it.altMobile ?? it.alt` 를 쓴다.

## P-10 [중간] 생성기가 macOS 전용 폰트에 묶여 있다

- **주장**: `docs/GOAL_PLAN.md:786` "G6 … 생성기 2개" — 재생성 가능하다는 뜻으로 적혀 있다.
  `verify-goals.mjs:201` 도 파일 두 개의 **존재만** 확인한다.
- **실제**: `FE/scripts/build-promo-images-2.mjs:44` `const FONT = "Apple SD Gothic Neo";`
  (1차 생성기도 같다). 대체 폰트 스택도, 임베드 폰트도 없다.
  폭 계산 `textW`(197행)은 이 폰트를 전제로 한 **추정치**다(`charW` → `size * 0.55` 등).
- **왜 문제인가**: Linux CI 나 맥이 아닌 운영자 장비에서 돌리면 librsvg 가 다른 폰트로
  대체하고, 글자 폭이 달라져 상자를 넘거나 비는데, 높이는 `fit()` 의 추정치로 잡히므로
  **잘린 채로 PNG 가 써진다.** "재생성 가능"이 실제로는 "이 맥에서만 재생성 가능"이다.
- **조치**: `FE/scripts/build-promo-image*.mjs` 의 `FONT` 를
  `"Apple SD Gothic Neo, Noto Sans KR, sans-serif"` 로 바꾸고, README 나 스크립트 상단에
  필요한 폰트를 적는다. 가장 확실한 건 Noto Sans KR 을 `FE/scripts/fonts/` 에 두고
  SVG 에 `@font-face` 로 임베드하는 것이다.

## P-11 [중간] 글자 넘침 경고가 종료 코드에 안 잡히고, 1차 생성기엔 아예 없다

- **주장**: `build-promo-images-2.mjs:199` 주석 "상자 폭을 넘는 줄을 잡아낸다".
  `verify-goals.mjs:205-206` 은 "카드 높이를 내용에서 계산 / 하드코딩 제거" 로 통과를 찍는다.
- **실제**: `fit()`(200-208행)은 `WARN.push` 만 한다. 571-576행에서 출력만 하고
  **`process.exitCode` 를 건드리지 않는다** — 넘쳐도 PNG 는 이미 써진 뒤이고 종료 코드는 0.
  그리고 `build-promo-image.mjs`(check-three 생성기)에는 `fit(` 호출이 **0건**이다.
  `verify-goals.mjs:205` 는 `build-promo-image.mjs` 하나만 grep 하는데,
  `function cardHeight` 는 1차 생성기에만 있고 2차에는 없다 —
  실제로 4종 중 3종을 만든 생성기는 이 검사를 전혀 안 받는다.
- **왜 문제인가**: "과거에 카드 높이를 하드코딩해 3번째 줄이 잘린 사고" 를 막으려고 만든
  장치가, 사고를 낸 쪽(1차 생성기)에는 없고 검사는 엉뚱한 파일을 본다.
  운영자가 카피를 길게 고쳐 재생성하면 같은 사고가 그대로 재현된다.
- **조치**: `build-promo-images-2.mjs` 끝에서 `if (WARN.length) process.exitCode = 1;`.
  `build-promo-image.mjs` 에 같은 `fit()`/`textW` 를 옮겨 심는다.
  `verify-goals.mjs:205` 는 두 생성기를 모두 보도록 고친다.

## P-12 [낮음] 번호 배지 글자가 `--brand-dark` — CLAUDE.md 표는 `--brand-deep` 을 지정

- **주장**: `CLAUDE.md` 토큰 표 — "`--brand-deep #07521f` | `--brand-light` 배지 위 글자 … 8.31:1 ✓".
- **실제**: `build-promo-images-2.mjs:265-266` 이 `fill: C.brandLight` 원 위에
  `fill: C.brandDark` 숫자를 올린다. 실측 `#0a8230` on `#dff7e6` = **4.37:1**
  (지정값 `#07521f` 였다면 8.31:1).
- **왜 문제인가**: 숫자가 굵고 커서(2240px 기준 46~52px → 표시 23~26px, weight 800)
  AA 큰 글자 3:1 은 넘기므로 **지금 당장 깨지는 건 아니다.** 다만 CLAUDE.md 가
  "초록 3종의 용도를 섞지 말 것 … 실제로 19곳에서 이 조합이 쓰였다가 일괄 교정했다" 고
  명시한 바로 그 혼용이 PNG 안에서 되살아나 있고, PNG 라 감사에 안 걸린다.
- **조치**: `build-promo-images-2.mjs` 에 `brandDeep: "#07521f"` 를 더하고
  265-266행 배지 숫자와 `panel()` 의 `headColor`(292행)를 `brandDeep` 으로 바꾼다.
  (재생성 시 P-08·P-10 주의 사항 동일.)

## P-13 [낮음] `verify-goals.mjs` 의 G5·G6 는 "완료" 를 증명하지 못한다

- **주장**: `docs/GOAL_PLAN.md:543-544` "5. 홍보 이미지 삽입 구조 | 완료",
  "6. 홍보 이미지 제작·삽입 | 완료", `786` 행 "G6 홍보 이미지 4/4".
- **실제**: 실행 결과는 9개 전부 통과지만, 내용은 전부 존재·개수·문자열 포함 검사다 —
  슬롯 개수 5=5, `"return null"` 포함, `"mobileWidth"` 문자열 포함, 가이드 파일 존재,
  렌더된 소스 ≥2, PNG 8장, 생성기 파일 2개, `id:` 4건, `"function cardHeight"` 포함.
  **치수 일치·alt 유무·이미지 안 대비·글자 잘림·가이드와 코드 일치는 하나도 안 본다.**
  P-08(2.87:1)과 P-11(1차 생성기 fit 0건)은 이 9개를 전부 통과한 상태에서 존재한다.
- **왜 문제인가**: 통과 리포트가 "검증 근거" 로 쓰이면 오히려 점검을 멈추게 한다.
- **조치**: P-01·P-06·P-08·P-11 의 조치를 각각 G5/G6 검사로 추가한다.

## P-14 [낮음] 3배 디스플레이에서 모바일 소스가 원해상도에 못 미친다

- **실제**: 모바일 소스는 750px 고정. 390px 뷰포트·DPR 3 이면 1,170 device px 가 필요한데
  Next 이미지 최적화는 원본을 **확대하지 않는다**(`w=3840` 요청 시 실제 출력
  2240×1155 로 캡되는 것을 확인: `sharp` metadata 기준). 즉 750px 를 1,170px 자리에 늘린다.
  실측 — 386px iframe 에서 `-m` 소스가 `354px` 폭으로 표시(비율 정확, 왜곡 없음).
- **왜 문제인가**: 글자가 박힌 이미지라 2배 기기에서는 선명하고 3배 기기에서는
  살짝 뭉갠다. 치명적이진 않다.
- **조치**: 급하지 않다. 다음 재생성 때 모바일 폭을 1,125px(375×3)로 올리면 끝난다.

---

## 결함 없음 — 확인했으나 문제를 못 찾은 항목

- **`enabled: false` 로 내리기 · 빈 슬롯**: 정상. `enabled:false` 로 두 항목을 내리니
  `class="bg-white py-8 md:py-12"` 섹션이 4 → 3 개로 줄고, 해당 `srcSet`·`alt` 가
  HTML 에서 완전히 사라졌다. 빈 여백 없음. `afterHero` 슬롯은 지금도 비어 있고
  섹션이 아예 렌더되지 않는다(`PromoSlot.tsx:25` `return null`).
- **코드를 안 건드리고 교체 가능한가**: 가능. `PROMO_IMAGES` 에 항목 하나만 넣으니
  `PromoSlot.tsx`·`page.tsx` 수정 없이 `afterHero` 섹션이 새로 생겼다.
- **`href` 없는 이미지**: 정상. `<div>` 로 감싸져 `<a>` 가 아니다 — "눌리는데 아무 일도
  안 일어나는" 상태가 아니다. `href` 가 있는 4장은 클릭 시 `location.hash` 가
  `#consult` 가 되고 `#consult` 섹션 top 이 67px(= `scroll-mt-20`)로 맞는 것을 확인했다.
- **데스크톱/모바일 소스 분리**: 동작한다. 1512px 에서 `-m` 쪽은 `display:none` 이고
  **네트워크 요청 자체가 안 나간다**(`loading="lazy"` + `display:none` 조합 덕분,
  `currentSrc` 빈 문자열·`naturalWidth` 0 으로 확인). 386px 에서는 반대로
  데스크톱 소스가 `display:none`, `-m` 소스가 354px 폭으로 표시된다. 비율 정확
  (354×741 = 750:1570, 354×820 = 750:1737, 354×747 = 750:1582, 354×888 = 750:1882).
- **8장 전부 열어 확인 — 글자 잘림·넘침**: 없음. 모바일판은 3장이 아니라 **4장**이며
  (`what-we-do-m`, `check-three-m`, `choose-criteria-m`, `before-call-m`)
  네 장 모두 머리글·카드 본문·마무리 문장이 끝까지 들어가 있다.
  카드 3번째 줄 잘림 재발 없음.
- **표시광고법·레퍼런스 복제·미보유 수상**: 없음. 네 장 어디에도 금액·보상률·순위·
  수상·인증 표기가 없다. 통신사는 텍스트 이름(KT·SK·LG·스카이라이프)만 쓰고 CI 는 없다.
  오히려 `what-we-do` 는 "근거 없는 지원금·보상률을 숫자로 내걸지 않습니다",
  "지어낸 접수 내역을 실시간인 것처럼 띄우지 않습니다" 로 `CLAUDE.md` 규칙 1·6 을
  그대로 선언한다. "연락처는 암호화해 보관하고 열람 기록을 남깁니다" 도 실제 구현
  (`phone_enc` + `access_logs`)과 일치한다 — 지킬 수 없는 약속이 아니다.
  레퍼런스(인터넷다모아·탐나넷) 카피 복제 여부는 원문 대조를 못 했으므로 **미확인**이나,
  문구가 이 프로젝트의 내부 규칙을 그대로 옮긴 것이라 복제 가능성은 낮다.
- **용량**: 과하지 않다. 디스크 PNG 합계 727KB 이지만 전송은 WebP 다.
  데스크톱 2배(각 `w=3840` → 2240px 캡): 44,742 + 나머지 = **163,598B**.
  모바일 3배(각 `w=1200` → 750px 캡): 37,394 + 28,808 + 34,160 + 37,922 = **138,284B**.
  네 장 모두 `loading="lazy"` 라 퍼스트뷰 전송량에는 0 을 기여한다.
- **디자인 언어 일관성**: 일관된다. 네 장이 같은 수직 리듬을 쓴다 —
  `--brand` 초록 막대(둥근 끝) → `--brand-dark` 아이브로우 → 검정 2~3줄 제목 →
  `#5b6670` 보조 문장 → `#e4eaf0` 테두리 흰 카드 → 회색 마무리 문장.
  배경은 순백 93~95%(`what-we-do` 만 패널 틴트 때문에 77%)로 `CLAUDE.md` 의
  "초록은 면이 아니라 점" 원칙을 지킨다. 불투명 초록 면은 `--brand` 막대 0.04% 뿐이다.
  팔레트도 `globals.css` 토큰과 값이 일치한다
  (`#07b040`/`#0a8230`/`#dff7e6`/`#e4eaf0`/`#f5f8fa`).
  **단 두 군데가 어긋난다 — P-08 의 `#8e9aa6`, P-12 의 배지 글자색.**

---

## 치명·높음만 모은 실행 순서

치명 없음. 높음 1건.

1. **P-08** — `FE/scripts/build-promo-image.mjs:32` 의 `faint: "#8e9aa6"` 를 `"#687380"`
   으로 바꾼다. 이 상수 하나가 `check-three` 데스크톱·모바일 두 장의 마무리 문장을
   2.87:1 로 떨어뜨리고 있다.
2. **P-08 (이어서)** — 재생성 전에 **P-10 과 P-11 을 먼저 처리한다.**
   폰트가 macOS 전용이고(`FONT = "Apple SD Gothic Neo"`) 1차 생성기에는 넘침 검사가
   없으므로, 지금 그대로 돌리면 색은 고쳐지면서 글자가 잘릴 수 있다.
   순서: `FONT` 에 대체 스택 추가 → `fit()` 을 1차 생성기에도 이식 →
   `process.exitCode = 1` → 재생성 → **새 파일명으로 저장**(가이드의 덮어쓰기 주의) →
   `PROMO_IMAGES` 의 `desktop`/`mobile` 경로와 `width`/`height` 갱신.
3. 재발 방지로 **P-01·P-06** 을 `verify-goals.mjs` G5 에 넣는다
   (alt 비어 있지 않음 · 설정 치수 = 파일 실제 치수). 지금 이 두 구멍이
   P-04 의 1771px 시프트와 P-01 의 무음 alt 가 들어올 수 있는 유일한 통로다.
