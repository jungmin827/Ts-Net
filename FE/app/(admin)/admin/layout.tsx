import type { Metadata } from "next";
import Link from "next/link";
import { checkAdmin } from "@/lib/admin/auth";
import AdminNav from "./AdminNav";

// 어드민 셸 + 인증 가드.
// 가드는 3중이다 — (1) middleware.ts 에서 세션 유무, (2) 이 레이아웃에서 셸 노출 여부,
// (3) 각 페이지의 requireAdmin() 이 admin_users·2FA 까지 확인하고 리다이렉트.
// 로그인 페이지도 이 레이아웃 아래 있으므로 여기서는 리다이렉트하지 않고 셸만 생략한다.

export const metadata: Metadata = {
  title: "어드민",
  robots: { index: false, follow: false },
};

// 세션 쿠키에 따라 결과가 달라지므로 절대 정적 생성되지 않게 한다
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await checkAdmin();

  if (!session.ok) {
    // 비로그인·권한없음 — 로그인 화면만 단독으로 렌더링
    return (
      <div className="min-h-screen bg-surface-muted font-sans text-foreground">
        {children}
      </div>
    );
  }

  const { admin } = session;

  return (
    <div className="min-h-screen bg-surface-muted font-sans text-foreground">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="rounded-lg bg-brand-dark px-2 py-1 text-xs font-bold text-white">
              TS-Net
            </span>
            <span className="text-sm font-bold">어드민</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">
              {admin.displayName ?? admin.email}
              <span className="ml-1.5 rounded bg-brand-light px-1.5 py-0.5 text-[11px] font-bold text-brand-deep">
                {admin.role}
              </span>
            </span>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="cursor-pointer rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-dark"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-5 lg:flex-row lg:px-6">
        <aside className="lg:w-44 lg:shrink-0">
          <div className="rounded-card border border-line bg-surface p-2 lg:sticky lg:top-20">
            <AdminNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
