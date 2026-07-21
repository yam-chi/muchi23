import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-ndayxojdgsolszqamzbq-auth-token",
  },
  global: {
    // keepalive: 페이지를 닫거나 새로고침하는 순간에도 이미 시작된 저장 요청이
    // 끊기지 않고 완료되도록 함 (beforeunload 시점의 마지막 저장 유실 방지)
    fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
  },
});

// 디버그용으로 브라우저 콘솔에서 접근 가능하게 노출
if (typeof window !== "undefined") {
  (window as typeof window & { supabase?: typeof supabase }).supabase = supabase;
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithGoogle(redirectTo?: string) {
  const siteUrl =
    redirectTo ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: siteUrl,
    },
  });
}

export async function requestPasswordReset(email: string, redirectTo?: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      redirectTo ??
      (typeof window !== "undefined" ? `${window.location.origin}/reset` : undefined),
  });
}
