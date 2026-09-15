import { SITE } from "@/lib/site-config";

const ICONS = ["⚡", "🔍", "🎁", "🔒"];

export default function Benefits() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-2xl font-black md:text-3xl">
          {SITE.name}에서 신청해야 하는 이유
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.benefits.map((b, i) => (
            <div
              key={b.title}
              className="rounded-2xl border border-gray-100 p-6 text-center shadow-sm"
            >
              <div className="mb-3 text-4xl">{ICONS[i]}</div>
              <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {b.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
