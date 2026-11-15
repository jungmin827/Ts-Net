import Image from "next/image";
import { SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 신청 → 상담 → 설치 → 사은품 4단계 — 문구는 `SITE.journey` 에만 있다.
 * 실제로 순서가 있는 내용이라 번호를 붙인다. 클릭할 수 없는 카드라 hover 반응이 없다.
 *
 * 카드 = 왼쪽 글자 + 오른쪽 사진. 사진 왼쪽 가장자리는 선 없이 카드 면으로 풀린다
 * (`.photo-fade-l`). 흰 그라데이션을 덮지 않고 사진 자체에 마스크를 거는 이유는
 * 카드 면 색이 바뀌어도 경계가 따라오게 하기 위해서다.
 *
 * 사진은 `alt=""` 다. 단계 제목·설명이 전부 HTML 에 있고 사진은 분위기를 더할 뿐이라
 * "장식" 선언이 참이다 (CLAUDE.md 가 막는 일괄 `alt=""` 는 게시판 홍보 이미지 얘기다).
 */
export default function Journey() {
  const { eyebrow, title, steps } = SITE.journey;

  return (
    <section className="pt-14 pb-16 md:pt-20 md:pb-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="md:flex md:items-end md:justify-between">
          <SectionHeading eyebrow={eyebrow} title={title} align="left" />
          {/* 모바일에서는 하단 고정 상담바가 같은 일을 하므로 md 이상에서만 둔다.
              SectionHeading 이 mb-10 을 가져서 같은 값을 줘야 아랫선이 맞는다 */}
          <a
            href="#consult"
            className="cta-fill mb-10 hidden shrink-0 items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-black transition-colors md:inline-flex"
          >
            {SITE.hero.cta}
            <Icon name="arrowRight" size={16} />
          </a>
        </div>

        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative isolate flex min-h-[9.5rem] overflow-hidden rounded-card border border-line-strong bg-surface md:min-h-[12.5rem]"
            >
              {/* 글자가 사진 위 레이어다 — 사진이 풀리는 구간과 겹쳐도 읽히게 */}
              <div className="relative z-10 flex w-[60%] flex-col justify-center p-5 md:w-[56%] md:p-7">
                <span className="tabular text-sm font-black text-muted">
                  STEP {i + 1}
                </span>
                <h3 className="mt-1.5 text-lg font-bold md:text-[1.375rem]">
                  <span className="sr-only">{i + 1}단계. </span>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">
                  {s.desc}
                </p>
              </div>
              <div className="photo-fade-l absolute inset-y-0 right-0 w-[46%] md:w-[50%]">
                <Image
                  src={s.image.src}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 280px, 46vw"
                  className="object-cover"
                  style={{ objectPosition: s.image.focus }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
