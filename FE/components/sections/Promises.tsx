import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/** '이렇게 상담해요' 3칸 — 문구는 `SITE.promises` 에만 있다 */
export default function Promises() {
  const { title, items } = SITE.promises;

  return (
    <section className="border-y border-line bg-surface py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={title} />

        <ul className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {items.map((it) => (
            <li key={it.title}>
              <Icon name={it.icon as IconName} size={28} />
              <h3 className="mt-4 text-xl font-black">{it.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{it.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
