/**
 * 하위 페이지의 제목 밴드. 게시판처럼 히어로가 없는 페이지가 `<h1>` 을 갖게 한다.
 *
 * 통신사 서브히어로(`CarrierHero`)와 달리 통신사 색이 없다 — 게시판은 특정
 * 통신사의 페이지가 아니다. 면은 흰색이고 초록은 밑줄 한 줄로만 쓴다
 * (CLAUDE.md: 초록은 '면'이 아니라 '점'으로).
 */
export default function PageHero({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line bg-white pt-10 pb-8 md:pt-14 md:pb-10">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="text-[1.75rem] leading-snug font-black md:text-[2.5rem]">
          {title}
        </h1>
        {/* 제목 아래 짧은 초록 눈금 — 글자가 얹히지 않는 장식 면이라
            `--brand`(쨍한 초록)를 쓸 수 있는 자리다. 글자를 얹으면
            대비 2.88:1 로 기준 미달이 된다. */}
        <span aria-hidden="true" className="mt-4 block h-1 w-12 rounded-full bg-brand" />
        {description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
