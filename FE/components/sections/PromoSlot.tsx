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
  const items = PROMO_IMAGES.filter((i) => {
    if (!i.enabled || i.slot !== slot || !i.desktop) return false;
    if (!i.alt.trim()) {
      console.error(
        `[PromoSlot] "${i.id}" 의 alt 가 비어 있어 렌더하지 않습니다 — ` +
          "이미지 안의 핵심 문구를 그대로 옮겨 주세요 (docs/PROMO_IMAGE_GUIDE.md)",
      );
      return false;
    }
    return true;
  });

  // 슬롯이 비면 섹션 자체가 없다 — 빈 여백을 남기지 않는다
  if (items.length === 0) return null;

  return (
    <section className="bg-white py-8 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
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
