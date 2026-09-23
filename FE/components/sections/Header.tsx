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

/** 내비 2단에 들어가는 전체 항목 — 통신사 4사 + 게시판 2종 */
const NAV_ITEMS = [
  ...CARRIER_MENU.map((c) => ({ href: `/${c.slug}`, label: c.label })),
  ...BOARD_MENU,
];

/** 로고 마크 — 신호 세기 막대를 형상화. 외부 이미지 없이 SVG로 그려 선명도를 유지한다 */
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-deep shadow-brand"
      style={{ width: size, height: size }}
    >
      <svg
        width={size / 2}
        height={size / 2}
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <rect x="1" y="11" width="3.2" height="6" rx="1.3" fill="#fff" opacity=".55" />
        <rect x="6" y="7" width="3.2" height="10" rx="1.3" fill="#fff" opacity=".8" />
        <rect x="11" y="2" width="3.2" height="15" rx="1.3" fill="#fff" />
      </svg>
    </span>
  );
}

/**
 * 2단 헤더.
 *
 * - **1단 브랜드 존** (데스크톱 전용): 넓은 여백을 가진 와이드 캔버스 위에 로고가
 *   독립 영역을 차지한다. 우측 끝에 대표번호 아웃라인 버튼. 스크롤하면 흘러간다.
 * - **2단 내비 바**: 스크롤해도 상단에 붙는다. 메뉴를 가로로 균등 배치하고
 *   맨 우측에 바 높이를 꽉 채운 CTA 버튼을 붙여 내비와 시각적으로 분리한다.
 * - **모바일**: 1·2단을 쓰지 않고 기존 컴팩트 바 + 드로어를 그대로 유지한다.
 *   좁은 화면에서 2단을 그리면 세로 공간을 60px 넘게 먹는다.
 */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 스크롤이 시작되면 내비 바에 그림자를 입혀 콘텐츠와 층을 분리한다
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
      {/* ── 1단: 브랜드 존 (데스크톱) ────────────────────────────
          로고가 숨 쉬도록 위아래 여백을 크게 준다. 배경에 아주 옅은 방사형
          틴트를 깔아 순백 대비 로고가 떠 보이게 했다 (blur 필터 미사용). */}
      <div
        className="hidden bg-white lg:block"
        style={{
          backgroundImage: [
            // 로고 뒤에 옅은 광원 하나 — 로고가 흰 면 위에 떠 보이게
            "radial-gradient(34rem 11rem at 16% 125%, rgba(43,80,200,0.09), transparent 72%)",
            // 좌우 끝을 살짝 눌러 가운데가 넓은 캔버스처럼 읽히게
            "linear-gradient(90deg, var(--brand-soft) 0%, #fff 22%, #fff 78%, var(--brand-soft) 100%)",
          ].join(","),
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-7">
          <Link
            href="/"
            className="group flex items-center gap-3.5"
            aria-label={`${SITE.name} 홈`}
          >
            <LogoMark size={46} />
            <span className="flex flex-col">
              <span className="text-[11px] font-bold tracking-[0.11em] text-brand/70">
                {SITE.tagline}
              </span>
              <span className="text-[1.75rem] leading-tight font-black tracking-tight text-brand-deep">
                {SITE.name}
              </span>
            </span>
          </Link>

          <a
            href={`tel:${SITE.tel}`}
            className="flex items-center gap-2.5 rounded-full border-2 border-brand/25 px-6 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand hover:shadow-lift"
          >
            <span className="flex flex-col items-end leading-none">
              <span className="text-[10px] font-bold tracking-wide text-muted">
                상담 대표번호
              </span>
              <span className="mt-1 text-xl font-black tracking-tight text-brand-deep">
                {SITE.tel}
              </span>
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-light text-brand">
              <Icon name="phone" size={18} />
            </span>
          </a>
        </div>
      </div>

      {/* ── 2단: 내비 바 (데스크톱) / 컴팩트 바 (모바일) ───────────── */}
      <header
        className={`sticky top-0 z-40 border-y border-line bg-white transition-shadow duration-300 ${
          scrolled ? "shadow-soft" : ""
        }`}
      >
        {/* 데스크톱 내비 — 항목을 가로 균등 배치하고 CTA는 바 높이를 꽉 채운다 */}
        <div className="mx-auto hidden max-w-6xl items-stretch px-4 lg:flex">
          <nav aria-label="주요 메뉴" className="flex flex-1 items-stretch">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex flex-1 items-center justify-center px-2 py-4 text-[0.95rem] font-bold transition-colors duration-200 ${
                  isActive(item.href)
                    ? "text-brand"
                    : "text-slate-600 hover:text-brand"
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-4 bottom-0 h-[3px] origin-center rounded-t-full bg-brand transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive(item.href)
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            ))}
          </nav>

          <a
            // 메인·통신사 서브페이지 모두 #consult 앵커를 갖고 있어 상대 앵커로 둔다
            href="#consult"
            className="ml-4 flex shrink-0 items-center gap-2 bg-accent px-7 text-[0.95rem] font-black text-white transition-colors duration-200 hover:bg-accent-dark"
          >
            <Icon name="clipboard" size={17} />
            상담 신청
          </a>
        </div>

        {/* 모바일 컴팩트 바 — 로고 / 전화 / 햄버거 (기존 구조 유지) */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 lg:hidden">
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

          <div className="flex items-center gap-2">
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2.5 text-sm font-black text-white shadow-brand transition-colors duration-200 hover:bg-brand-dark sm:px-4"
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
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line text-slate-700 transition-colors duration-200 hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
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
