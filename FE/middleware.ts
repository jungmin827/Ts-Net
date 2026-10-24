import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { fetchWithTimeout, SUPABASE_TIMEOUT_MS } from "@/lib/supabase/fetch-timeout";

// 어드민 1차 가드. 세션 쿠키 갱신(@supabase/ssr 필수 단계)도 여기서 함께 처리한다.
// 공개 사이트는 matcher 밖이라 영향이 없다.

const LOGIN_PATH = "/admin/login";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginPath = pathname === LOGIN_PATH;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 키가 없으면 인증 자체가 불가능하다 — 열어두지 않고 로그인 화면으로 보낸다
  if (!url || !anonKey) {
    return isLoginPath
      ? NextResponse.next({ request })
      : NextResponse.redirect(new URL(`${LOGIN_PATH}?error=config`, request.url));
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    // 인증 서버가 응답을 안 주면 어드민 요청 전체가 매달린다 — 상한을 건다
    global: { fetch: fetchWithTimeout(SUPABASE_TIMEOUT_MS) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // 시간 초과·네트워크 오류는 "로그인 안 됨" 으로 닫는다 — 열어두지 않는다
  let user: User | null = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (e) {
    console.error("[middleware] 세션 확인 실패:", e instanceof Error ? e.name : e);
  }

  if (!user && !isLoginPath) {
    const redirectUrl = new URL(LOGIN_PATH, request.url);
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  // 이미 로그인한 세션이 로그인 화면에 머무르지 않게 한다.
  // admin_users / 2FA 확인은 레이아웃의 requireAdmin 이 담당한다.
  if (user && isLoginPath && request.nextUrl.searchParams.get("error") === null) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
