import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role 클라이언트 — RLS를 우회한다.
 * 서버 전용: 클라이언트 컴포넌트에서 import 금지.
 * SUPABASE_SERVICE_ROLE_KEY는 NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에 노출되지 않는다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다");

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
