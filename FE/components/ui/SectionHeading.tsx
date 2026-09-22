/** 섹션 머리말 — 눈썹 라벨 / 제목 / 보조설명의 위계를 전 섹션에서 통일한다 */
export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
  /** dark: 남색 배경 위에 얹을 때 */
  tone?: "light" | "dark";
}) {
  const isCenter = align === "center";
  return (
    <div className={`mb-10 ${isCenter ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <span
          className={`mb-3 inline-block rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide ${
            tone === "dark"
              ? "bg-white/15 text-white"
              : "bg-brand-light text-brand"
          }`}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={`text-2xl leading-snug font-black md:text-[2rem] ${
          tone === "dark" ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-3 text-sm leading-relaxed md:text-base ${
            tone === "dark" ? "text-white/75" : "text-muted"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
