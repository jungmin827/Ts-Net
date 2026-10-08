"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 현재 경로 표시만을 위한 클라이언트 컴포넌트.
// 어드민은 기본 서버 컴포넌트이고, use client 는 상호작용에만 쓴다 (CLAUDE.md).

const ITEMS = [
  { href: "/admin", label: "대시보드", exact: true },
  { href: "/admin/leads", label: "상담신청", exact: false },
  // 방문자가 제출한 후기는 비공개로 들어온다 — 승인 화면이 없으면
  // 영원히 공개되지 않는다 (008 이 제출 경로를 열었다).
  { href: "/admin/reviews", label: "후기 승인", exact: false },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2.5 text-sm font-bold transition-colors duration-200 ${
              active
                ? "bg-brand-dark text-white"
                : "text-muted hover:bg-brand-soft hover:text-brand-dark"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
