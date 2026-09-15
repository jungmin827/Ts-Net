import { createClient } from "@supabase/supabase-js";

/**
 * 공개 콘텐츠(plans / reviews / notices) 읽기 전용 클라이언트.
 * anon key만 쓰므로 RLS의 public_read 정책 범위 밖 데이터는 애초에 조회되지 않는다.
 * 키가 없으면 null — 호출부가 빈 상태로 렌더링해 빌드가 깨지지 않게 한다.
 */
export function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
