import Image from "next/image";
import { SITE } from "@/lib/site-config";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 상담 방식 3칸 — 문구는 `SITE.promises` 에만 있다. 제목의 강조 낱말(`titleAccent`)만
 * 초록으로 칠한다(`SectionHeading` 의 `accent`). 눈썹 라벨은 두지 않는다.
 *
 * 사진은 `alt=""` 다. 예전 포스터는 문구가 그림 안에 구워져 있어 alt 가 본문 전체를
 * 옮겨야 했지만, 지금은 제목·설명이 전부 HTML 에 있고 사진은 분위기를 더할 뿐이라
 * "장식" 선언이 참이다. (CLAUDE.md 가 막는 일괄 `alt=""` 는 정보의 본체가 이미지 안에
 * 있는 게시판 홍보 이미지 얘기다)
 * 클릭할 수 없는 카드라 hover 반응이 없다.
 */
export default function Promises() {
  const { title, titleAccent, items } = SITE.promises;

  return (
    <section className="pt-14 md:pt-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={title} accent={titleAccent} align="left" />

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {items.map((it) => (
            <li
              key={it.title}
              className="overflow-hidden rounded-card border border-line-strong bg-surface"
            >
              {/* 모바일은 16:9 로 가운데를 잘라 써서 카드 하나가 화면을 다 먹지 않게 한다 */}
              <Image
                src={it.image.src}
                alt=""
                width={it.image.width}
                height={it.image.height}
                sizes="(min-width: 1152px) 360px, (min-width: 768px) 33vw, 100vw"
                className="aspect-video w-full object-cover md:aspect-[3/2]"
              />
              <div className="p-5 md:p-6">
                <h3 className="text-lg font-bold md:text-xl">{it.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
                  {it.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
