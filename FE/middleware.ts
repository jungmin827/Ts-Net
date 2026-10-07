import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
