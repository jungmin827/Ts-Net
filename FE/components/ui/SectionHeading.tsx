/**
 * 섹션 머리말 — 눈썹 라벨 / 제목 / 보조설명의 위계를 전 섹션에서 통일한다.
 *
 * `tone="dark"` 분기가 있었는데 쓰는 곳이 한 군데도 없었다. 안에는
 * 폐기된 색 결정("남색 배경 위에 얹을 때")과 대비 미달(`text-white/75`,
 * 진초록 면 위 3.48:1)이 함께 들어 있어, 누가 쓰는 순간 위반이 되는 상태였다.
 * 쓰지 않는 분기는 지운다 — 어두운 면이 다시 필요해지면 그때 대비를 재서 넣는다.
 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  return (
    <div className={`mb-10 ${isCenter ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <span className="mb-3 inline-block rounded-full bg-brand-light px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-deep">
          {eyebrow}
        </span>
      )}
      <h2 className="text-2xl leading-snug font-black text-foreground md:text-[2rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
