/**
 * 섹션 머리말 — 눈썹 라벨 / 제목 / 보조설명의 위계를 전 섹션에서 통일한다.
 *
 * `tone="dark"` 분기가 있었는데 쓰는 곳이 한 군데도 없었다. 안에는
 * 폐기된 색 결정("남색 배경 위에 얹을 때")과 대비 미달(`text-white/75`,
 * 진초록 면 위 3.48:1)이 함께 들어 있어, 누가 쓰는 순간 위반이 되는 상태였다.
 * 쓰지 않는 분기는 지운다 — 어두운 면이 다시 필요해지면 그때 대비를 재서 넣는다.
 *
 * `accent` — 제목 안에서 초록으로 강조할 낱말. `title` 이 문자열이고 그 낱말이
 * 들어 있을 때만 처음 나오는 한 곳을 감싼다. 없으면 제목을 그대로 그린다.
 * 본문에서 초록을 쓰는 자리는 이 강조 낱말뿐이다
 * (2026-11-16 사용자 결정 — "본문은 무채색" 규칙의 예외).
 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  accent,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  accent?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  const at =
    accent && typeof title === "string" ? title.indexOf(accent) : -1;
  return (
    <div className={`mb-10 ${isCenter ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <span className="mb-3 inline-block rounded-full bg-brand-light px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-deep">
          {eyebrow}
        </span>
      )}
      {/* 섹션 제목 26 / 32px. 소제목(18~20px)과 한 단계 차이로 둔다 */}
      <h2 className="text-[1.625rem] leading-snug font-black text-foreground md:text-[2rem]">
        {at >= 0 && accent && typeof title === "string" ? (
          <>
            {title.slice(0, at)}
            {/* 초록 값의 출처는 `.brand-scope` 한 곳뿐이라 새 토큰을 만들지 않고
                그 스코프를 낱말에만 건다. `--brand`(#07b040)는 오프화이트 위 글자 대비가
                3:1 에 못 미쳐 쓰지 않고, 흰 바탕 위 글자용 `--brand-dark`(#0a8230,
                4.94:1 · 오프화이트 위 4.7:1)를 쓴다. `@theme inline` 이라
                `text-brand-dark` 는 `var(--brand-dark)` 로 풀려 스코프 값을 집는다 */}
            <span className="brand-scope text-brand-dark">{accent}</span>
            {title.slice(at + accent.length)}
          </>
        ) : (
          title
        )}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
