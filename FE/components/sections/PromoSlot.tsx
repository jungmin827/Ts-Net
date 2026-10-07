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
 */
export default function PromoSlot({ slot }: { slot: PromoSlotName }) {
  const items = PROMO_IMAGES.filter(
    (i) => i.enabled && i.slot === slot && i.desktop,
  );

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
            </Link>
          ) : (
            <div key={it.id}>{img}</div>
          );
        })}
      </div>
    </section>
  );
}
