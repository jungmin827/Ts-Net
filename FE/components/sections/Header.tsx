"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CARRIER_MENU, SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/**
 * 게시판 메뉴.
 *
 * 한동안 빈 배열이었다 — `/review` `/notice` 가 404 를 내던 때, 눌러서
 * 에러로 떨어지는 메뉴를 두는 쪽이 메뉴가 적은 것보다 신뢰를 더 깎기 때문이다.
 * 두 라우트를 만들었으므로 되돌린다. 라벨은 DB 테이블 이름(`notices`)이 아니라
 * **방문자가 기대하는 말**로 적는다 — 여기 올라가는 건 공지가 아니라 가입
 * 절차·요금 안내다.
 *
 * 링크와 라우트가 다시 어긋나지 않도록 `verify-goals` 의 G0 검사가
 * "코드가 거는 내부 링크 ⊆ 존재하는 라우트" 를 데이터 상태와 무관하게 본다.
 */
const BOARD_MENU: { href: string; label: string }[] = [
  { href: "/review", label: "가입후기" },
  { href: "/notice", label: "정보공유" },
];

const CARRIER_NAV = CARRIER_MENU.map((c) => ({
  href: `/${c.slug}`,
  label: c.label,
}));

/**
 * 인스타그램 바로가기. 새 창으로 연다 — 상담 중이던 페이지를 잃지 않게.
 * 아이콘만 있는 버튼이라 이름은 `aria-label` 이 맡는다.
 */
function InstagramLink({ className }: { className: string }) {
  return (
    <a
      href={SITE.instagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="인스타그램 (새 창)"
      title="인스타그램"
      className={`flex shrink-0 items-center justify-center rounded-xl border border-line-strong text-foreground transition-colors duration-200 hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark ${className}`}
    >
      <Icon name="instagram" size={22} />
    </a>
  );
}

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
 * 로고와 이 바만 브랜드 그린을 쓴다(`brand-scope`). 페이지 본문은 무채색이다.
 * 통신사 페이지에 들어와도 바의 색은 바뀌지 않는다 — 통신사색은 쓰지 않는다.
 *
 * 이전에는 브랜드 존(1단)과 내비 바(2단)로 나뉘어 있었다. 세로로 100px 넘게 먹으면서
 * 정작 스크롤하면 1단이 흘러가 로고가 사라졌고, 2단 항목은 `flex-1` 균등 분배라
 * 1440px 에서 항목 간격이 120px 씩 벌어져 메뉴가 한 묶음으로 읽히지 않았다.
 *
 * 지금은 한 줄이다: 로고 · 통신사 4사 · (구분선) 게시판 2종 · 인스타그램 · 신청 CTA.
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
      className={`group relative flex items-center px-3 py-6 text-[1.0625rem] font-semibold whitespace-nowrap transition-colors duration-200 xl:px-[1.125rem] ${
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
        className={`brand-scope sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? "shadow-soft" : ""
        }`}
      >
        {/* ── 데스크톱: 한 줄 ─────────────────────────────── */}
        <div className="mx-auto hidden max-w-6xl items-center px-4 lg:flex">
          <Link
            href="/"
            className="mr-6 flex shrink-0 items-center xl:mr-10"
            aria-label={`${SITE.name} 홈`}
          >
            {/* 포스터가 1120px 폭으로 크게 깔리는 페이지라 바도 그에 맞춰 키웠다 (66 → 80px) */}
            <Wordmark className="h-[48px]" />
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
            {/* 메뉴바에는 대표번호를 싣지 않는다(10-25 운영자 결정 — 푸터·하단 띠에만 둔다).
                스크롤 위치와 무관하게 접수로 가는 길이 헤더에 항상 있어야 한다. */}
            <InstagramLink className="size-12" />
            <a
              href="#consult"
              className="cta-fill flex items-center gap-2 rounded-xl px-6 py-3 text-[1.0625rem] font-black whitespace-nowrap shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0"
            >
              <Icon name="clipboard" size={19} />
              상담 신청
            </a>
          </div>
        </div>

        {/* ── 모바일 컴팩트 바 ───────────────────────────── */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:hidden">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${SITE.name} 홈`}
          >
            <Wordmark className="h-[34px]" />
          </Link>

          <div className="flex items-center gap-2">
            <InstagramLink className="size-10" />
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

      {/*
        모바일 드로어.

        닫힌 상태는 `inert` 로 둔다. `aria-hidden` 만으로는 부족하다 —
        그건 스크린리더에서만 감추고 **탭 순서에서는 빼지 않는다.**
        화면 밖(`translate-x-full`)에 있는 메뉴 링크 5개로 포커스가 들어가는데
        스크린리더는 아무것도 읽지 않는, 선언만 있고 동작이 없는 상태가 된다.
        (포커스 가능한 요소를 품은 `aria-hidden` 은 그 자체로 ARIA 위반이다.)
        `inert` 는 포커스·포인터·접근성 트리를 한 번에 막으므로 이것만 쓴다.
      */}
      <div
        className={`brand-scope fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        inert={!open}
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
                    {c.label}
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

        </nav>
      </div>
    </>
  );
}
