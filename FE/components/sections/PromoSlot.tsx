import Image from "next/image";
import Link from "next/link";
import { PROMO_IMAGES, type PromoSlotName } from "@/lib/site-config";

/**
 * 외부 디자인 툴로 만든 홍보 이미지를 꽂는 자리.
 *
 * 설계 전제 — **코드를 고치지 않고 이미지를 교체할 수 있어야 한다.**
 * 운영자는 `FE/public/` 에 파일을 넣고 `lib/site-config.ts` 의 `PROMO_IMAGES`
 * 배열 한 항목만 채운다. 컴포넌트에는 경로도 문구도 없다.
 *
 * 데스크톱/모바일 소스를 나눠 받는 이유 —
 * 글자가 박힌 이미지는 한 장을 축소하면 모바일(약 358px)에서 읽히지 않는다.
 * `mobile` 을 비워두면 데스크톱 소스를 그대로 쓰되, 글자가 있는 이미지라면
 * 반드시 따로 넣어야 한다 (가이드: docs/PROMO_IMAGE_GUIDE.md).
 *
 * ⚠ `alt` 가 비어 있으면 **그 항목을 렌더하지 않는다.**
 *   `alt=""` 는 "이건 장식이니 건너뛰라"는 적극적 선언이라, 본문이 통째로 그림 안에
 *   들어 있는 이 이미지들에서는 내용 전체가 보조기기에서 사라진다.
 *   `href` 까지 있으면 **이름 없는 링크**가 되어 WCAG 2.4.4·4.1.2 를 함께 깬다.
 *   운영자가 "나중에 채우지" 하고 비워두면 아무도 못 잡으므로, 조용히 통과시키지 않는다.
 *   (같은 검사가 `scripts/verify-goals.mjs` 에도 있다 — 화면에 뜨기 전에 걸린다)
 */
export default function PromoSlot({ slot }: { slot: PromoSlotName }) {
  const mine = PROMO_IMAGES.filter(
    (i) => i.enabled && i.slot === slot && i.desktop,
  );
  /** alt 가 비어 렌더하지 않은 항목 — 개발 중에는 화면에 알린다 */
  const missingAlt = mine.filter((i) => !i.alt.trim());
  const items = mine.filter((i) => i.alt.trim());

  for (const i of missingAlt) {
    console.error(
      `[PromoSlot] "${i.id}" 의 alt 가 비어 있어 렌더하지 않습니다 — ` +
        "이미지 안의 핵심 문구를 그대로 옮겨 주세요 (docs/PROMO_IMAGE_GUIDE.md)",
    );
  }

  /*
   * 개발 중에는 **화면에** 알린다.
   *
   * `console.error` 만 남기던 때는 "조용히 통과시키지 않는다"는 목적은 달성했지만
   * 대신 **원인을 알 수 없는 미렌더**를 만들었다. `PromoSlot` 은 서버 컴포넌트라
   * 그 로그는 터미널로 가고, `site-config.ts` 를 고치고 브라우저를 새로고침하는
   * 운영자 눈에는 아무것도 안 보인다. 섹션이 통째로 사라지니 경로 오타나
   * `enabled` 를 의심하며 엉뚱한 데를 뒤지게 된다.
   * 운영 빌드에서는 지금처럼 조용히 제외한다 — 방문자에게 보일 내용이 아니다.
   */
  const notice =
    process.env.NODE_ENV !== "production" && missingAlt.length > 0 ? (
      <p className="mx-auto max-w-6xl rounded-panel border-2 border-dashed border-red-400 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
        [개발 전용] {missingAlt.map((i) => `"${i.id}"`).join(", ")} 의 alt 가 비어
        있어 렌더하지 않았습니다. `FE/lib/site-config.ts` 의 `PROMO_IMAGES` 에서
        이미지 안의 핵심 문구를 그대로 옮겨 주세요.
      </p>
    ) : null;

  // 슬롯이 비면 섹션 자체가 없다 — 빈 여백을 남기지 않는다
  if (items.length === 0) {
    if (!notice) return null;
    return (
      <section className="bg-white px-4 py-6">{notice}</section>
    );
  }

  return (
    <section className="bg-white py-8 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
        {notice}
        {items.map((it) => {
          const hasMobile = Boolean(it.mobile);
          const img = (
            <>
              <Image
                src={it.desktop}
                alt={it.alt}
                width={it.width}
                height={it.height}
                sizes="(min-width: 1152px) 1120px, 100vw"
                className={`h-auto w-full rounded-panel ${hasMobile ? "hidden md:block" : ""}`}
              />
              {hasMobile && (
                <Image
                  src={it.mobile!}
                  alt={it.alt}
                  width={it.mobileWidth ?? it.width}
                  height={it.mobileHeight ?? it.height}
                  sizes="100vw"
                  className="h-auto w-full rounded-panel md:hidden"
                />
              )}
            </>
          );

          return it.href ? (
            <Link
              key={it.id}
              href={it.href}
              className="block rounded-panel transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5"
            >
              {img}
              {/*
                링크의 접근 가능한 이름은 alt 전문이다 — 이미지를 **설명하는** 글이라
                "눌렀을 때 어디로 가는지"를 말하지 않는다. 스크린리더 링크 목록에
                200자가 넘는 항목만 늘어서고 목적지는 어디에도 없다(WCAG 2.4.4).
                설명은 alt 가 맡고, 목적지는 이 한 줄이 맡는다.
              */}
              <span className="sr-only">— 상담 신청하러 가기</span>
            </Link>
          ) : (
            <div key={it.id}>{img}</div>
          );
        })}
      </div>
    </section>
  );
}
