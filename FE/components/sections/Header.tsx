"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CARRIER_MENU, SITE, hasTel } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/**
 * 게시판 메뉴.
 *
 * `/review` `/notice` 는 아직 구현되지 않아 **404 를 반환한다.**
 * 누르면 에러 페이지로 떨어지는 메뉴를 내비에 두는 쪽이, 메뉴가 하나 적은
 * 것보다 신뢰를 더 크게 깎는다. 페이지를 만들면 배열에 다시 넣으면 된다.
 */
const BOARD_MENU: { href: string; label: string }[] = [];

const CARRIER_NAV = CARRIER_MENU.map((c) => ({
  href: `/${c.slug}`,
  label: c.label,
}));

/** 브랜드 워드마크. 크기는 쓰는 자리에서 높이만 지정하고 폭은 비율대로 따라온다 */
function Wordmark({ className }: { className: string }) {
  return (
    <Image
      src={SITE.logo.src}
      alt={SITE.name}
      width={SITE.logo.width}
      height={SITE.logo.height}
      priority
      className={`w-auto ${className}`}
    />
  );
}

/**
 * 헤더 — 1단 고정 바.
 *
 * 이전에는 브랜드 존(1단)과 내비 바(2단)로 나뉘어 있었다. 세로로 100px 넘게 먹으면서
 * 정작 스크롤하면 1단이 흘러가 로고가 사라졌고, 2단 항목은 `flex-1` 균등 분배라
 * 1440px 에서 항목 간격이 120px 씩 벌어져 메뉴가 한 묶음으로 읽히지 않았다.
 *
 * 지금은 한 줄이다: 로고 · 통신사 4사 · (구분선) 게시판 2종 · 대표번호 · 신청 CTA.
 * 항목은 제 글자폭만큼만 차지하고, 통신사와 게시판 사이의 세로선이 두 묶음을 구분한다.
 */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 스크롤이 시작되면 바에 그림자를 입혀 콘텐츠와 층을 분리한다
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

  /** 내비 항목 한 개. 활성/호버 시 아래에서 초록 밑줄이 올라온다 */
  const navLink = (item: { href: string; label: string }) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={`group relative flex items-center px-2.5 py-5 text-[0.95rem] font-medium whitespace-nowrap transition-colors duration-200 xl:px-4 ${
        isActive(item.href) ? "text-brand-dark" : "text-foreground hover:text-brand-dark"
      }`}
    >
      {item.label}
      <span
        aria-hidden="true"
        className={`absolute inset-x-2 bottom-0 h-[3px] origin-center rounded-t-full bg-brand transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isActive(item.href)
            ? "scale-x-100"
            : "scale-x-0 group-hover:scale-x-100"
        }`}
      />
    </Link>
  );

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? "shadow-soft" : ""
        }`}
      >
        {/* ── 데스크톱: 한 줄 ─────────────────────────────── */}
        <div className="mx-auto hidden max-w-6xl items-center px-4 lg:flex">
          <Link
            href="/"
            className="mr-5 flex shrink-0 items-center xl:mr-8"
            aria-label={`${SITE.name} 홈`}
          >
            <Wordmark className="h-[38px]" />
          </Link>

          <nav aria-label="주요 메뉴" className="flex items-stretch">
            {CARRIER_NAV.map(navLink)}
            {/* 통신사 묶음과 게시판 묶음의 경계. 게시판이 비어 있으면 가를 것이 없다 */}
            {BOARD_MENU.length > 0 && (
              <span
                aria-hidden="true"
                className="my-auto h-4 w-px shrink-0 bg-line-strong"
              />
            )}
            {BOARD_MENU.map(navLink)}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-3 xl:gap-3 xl:pl-4">
            {/* 헤더 CTA 를 걷어내 자리가 생겼으므로 대표번호는 lg 부터 그대로 보인다 */}
            {hasTel() && (
            <a
              href={`tel:${SITE.tel}`}
              aria-label={`대표번호 ${SITE.tel} 로 전화하기`}
              className="flex items-center gap-2 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-brand-soft"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-light text-brand-deep">
                <Icon name="phone" size={16} />
              </span>
              <span className="tabular text-lg font-black tracking-tight text-brand-deep">
                {SITE.tel}
              </span>
            </a>
            )}

            {/* 대표번호가 없으면 헤더 우측에 전환 수단이 하나도 남지 않는다.
                스크롤 위치와 무관하게 접수로 가는 길이 헤더에 항상 있어야 한다. */}
            <a
              href="#consult"
              className="cta-fill flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[0.95rem] font-black whitespace-nowrap shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0"
            >
              <Icon name="clipboard" size={17} />
              상담 신청
            </a>
          </div>
        </div>

        {/* ── 모바일 컴팩트 바 ───────────────────────────── */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 lg:hidden">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${SITE.name} 홈`}
          >
            <Wordmark className="h-[30px]" />
          </Link>

          <div className="flex items-center gap-2">
            {hasTel() && (
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center gap-1.5 rounded-xl bg-brand-dark px-3.5 py-2.5 text-sm font-black text-white shadow-brand transition-colors duration-200 hover:bg-brand-deep sm:px-4"
            >
              <Icon name="phone" size={16} />
              <span className="tabular hidden sm:inline">{SITE.tel}</span>
              <span className="sm:hidden">전화</span>
            </a>
            )}

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
              aria-expanded={open}
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line-strong text-foreground transition-colors duration-200 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
            >
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 드로어 */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-brand-deep/45 transition-opacity duration-300 ${
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
            <Wordmark className="h-[28px]" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-brand-dark"
            >
              <Icon name="close" size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className="px-2 pb-2 text-xs font-bold text-muted">통신사</p>
            <ul className="mb-5 flex flex-col gap-1">
              {CARRIER_MENU.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    className="flex items-center justify-between rounded-xl px-3 py-3 font-bold text-foreground transition-colors hover:bg-brand-soft hover:text-brand-dark"
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
                      className="text-line-strong"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            {BOARD_MENU.length > 0 && (
              <p className="px-2 pb-2 text-xs font-bold text-muted">게시판</p>
            )}
            <ul className="flex flex-col gap-1">
              {BOARD_MENU.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className="flex items-center justify-between rounded-xl px-3 py-3 font-bold text-foreground transition-colors hover:bg-brand-soft hover:text-brand-dark"
                  >
                    {m.label}
                    <Icon
                      name="chevronRight"
                      size={18}
                      className="text-line-strong"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {hasTel() && (
          <div className="border-t border-line p-4">
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-dark py-3.5 font-black text-white shadow-brand"
            >
              <Icon name="phone" size={18} />
              <span className="tabular">{SITE.tel}</span>
            </a>
          </div>
          )}
        </nav>
      </div>
    </>
  );
}
