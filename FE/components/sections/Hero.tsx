import { SITE } from "@/lib/site-config";

// 배경 이미지는 운영자 교체가 쉽도록 public/hero.jpg 를 사용 (없으면 그라데이션만)
export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-brand-dark via-brand to-brand/80 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-20 md:py-28">
        <h1 className="text-3xl leading-tight font-black md:text-5xl">
          {SITE.hero.headline}
        </h1>
        <p className="text-lg text-white/85 md:text-xl">{SITE.hero.sub}</p>
        <a
          href="#consult"
          className="mt-2 rounded-lg bg-accent px-8 py-4 text-lg font-bold text-white transition-transform hover:scale-105"
        >
          {SITE.hero.cta}
        </a>
      </div>
    </section>
  );
}
