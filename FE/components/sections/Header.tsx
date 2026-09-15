import Link from "next/link";
import { CARRIER_MENU, SITE } from "@/lib/site-config";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-black text-brand">
          {SITE.name}
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-gray-700 md:flex">
          {CARRIER_MENU.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} className="hover:text-brand">
              {c.label}
            </Link>
          ))}
          <Link href="/review" className="hover:text-brand">
            가입후기
          </Link>
          <Link href="/notice" className="hover:text-brand">
            정보공유
          </Link>
        </nav>

        <a
          href={`tel:${SITE.tel}`}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
        >
          📞 {SITE.tel}
        </a>
      </div>
    </header>
  );
}
