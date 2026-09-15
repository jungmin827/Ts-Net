import { SITE } from "@/lib/site-config";

// 가입절차 5스텝 — 데스크톱 가로 화살표 연결, 모바일 세로 스택
export default function Process() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-2xl font-black md:text-3xl">
          가입 절차
        </h2>
        <ol className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-0">
          {SITE.processSteps.map((s, i) => (
            <li key={s.title} className="flex flex-col items-center md:flex-row">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-brand text-2xl font-black text-white">
                  {i + 1}
                </div>
                <p className="font-bold">{s.title}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
              {i < SITE.processSteps.length - 1 && (
                <span className="my-1 rotate-90 text-2xl text-brand/40 md:mx-5 md:rotate-0">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
