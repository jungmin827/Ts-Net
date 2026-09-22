"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CARRIER_MENU, SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

const BOARD_MENU = [
  { href: "/review", label: "가입후기" },
  { href: "/notice", label: "정보공유" },
];

/** 로고 마크 — 신호 세기 막대를 형상화. 외부 이미지 없이 SVG로 그려 선명도를 유지한다 */
function LogoMark() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-deep shadow-brand">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="1" y="11" width="3.2" height="6" rx="1.3" fill="#fff" opacity=".55" />
        <rect x="6" y="7" width="3.2" height="10" rx="1.3" fill="#fff" opacity=".8" />
        <rect x="11" y="2" width="3.2" height="15" rx="1.3" fill="#fff" />
      </svg>
    </span>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 스크롤이 시작되면 헤더에 그림자와 반투명 배경을 입혀 콘텐츠와 층을 분리한다
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 라우트가 바뀌면 모바일 메뉴를 닫는다
  useEffect(() => setOpen(false), [pathname]);

  // 메뉴가 열려 있는 동안 배경 스크롤 잠금 + Escape 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          scrolled
            ? "border-b border-line bg-white/85 shadow-soft backdrop-blur-md"
            : "border-b border-transparent bg-white"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-all duration-300 ${
            scrolled ? "py-2.5" : "py-3.5"
          }`}
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${SITE.name} 홈`}
          >
            <LogoMark />
            <span className="text-xl font-black tracking-tight text-brand-deep">
              {SITE.name}
            </span>
          </Link>

          {/* 데스크톱 내비 — 밑줄이 좌에서 우로 자라며 호버를 알린다 */}
          <nav className="hidden items-center gap-1 lg:flex">
            {[
              ...CARRIER_MENU.map((c) => ({ href: `/${c.slug}`, label: c.label })),
              ...BOARD_MENU,
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative rounded-lg px-3 py-2 text-sm font-bold transition-colors duration-200 ${
                  isActive(item.href)
                    ? "text-brand"
                    : "text-slate-600 hover:text-brand"
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive(item.href)
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2.5 text-sm font-black text-white shadow-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-lift active:translate-y-0 sm:px-4"
            >
              <Icon name="phone" size={16} />
              <span className="hidden sm:inline">{SITE.tel}</span>
              <span className="sm:hidden">전화</span>
            </a>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
              aria-expanded={open}
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line text-slate-700 transition-colors duration-200 hover:border-brand/40 hover:bg-brand-soft hover:text-brand lg:hidden"
            >
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 드로어 — 통신사·게시판 메뉴가 데스크톱에서만 보이던 문제를 해소 */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          aria-label="전체 메뉴"
          className={`absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-white shadow-float transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="flex items-center gap-2.5">
              <LogoMark />
              <span className="text-lg font-black text-brand-deep">
                {SITE.name}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-surface-muted hover:text-brand"
            >
              <Icon name="close" size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className="px-2 pb-2 text-xs font-bold tracking-wide text-slate-400">
              통신사
            </p>
            <ul className="mb-5 flex flex-col gap-1">
              {CARRIER_MENU.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    className="flex items-center justify-between rounded-xl px-3 py-3 font-bold text-slate-700 transition-colors hover:bg-brand-soft hover:text-brand"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: `var(${c.colorVar})` }}
                      />
                      {c.label}
                    </span>
                    <Icon
                      name="chevronRight"
                      size={18}
                      className="text-slate-300"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <p className="px-2 pb-2 text-xs font-bold tracking-wide text-slate-400">
              게시판
            </p>
            <ul className="flex flex-col gap-1">
              {BOARD_MENU.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className="flex items-center justify-between rounded-xl px-3 py-3 font-bold text-slate-700 transition-colors hover:bg-brand-soft hover:text-brand"
                  >
                    {m.label}
                    <Icon
                      name="chevronRight"
                      size={18}
                      className="text-slate-300"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-line p-4">
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-black text-white shadow-brand"
            >
              <Icon name="phone" size={18} />
              {SITE.tel}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
