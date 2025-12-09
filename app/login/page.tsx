"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signInWithEmail, signInWithGoogle } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signInWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="auth-page">
      <div className="auth-hero auth-hero-top">
        <div className="auth-logo">MUCHI NOTE</div>
        <div className="auth-tagline">월간 플래너 보드</div>
      </div>
      <div className="auth-card">
        <h1 className="auth-title">로그인</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span>이메일</span>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span>비밀번호</span>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn auth-submit" type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <button
          type="button"
          className="btn auth-secondary auth-google"
          disabled={loadingGoogle}
          onClick={async () => {
            setError(null);
            setLoadingGoogle(true);
            const { error: err } = await signInWithGoogle();
            setLoadingGoogle(false);
            if (err) setError(err.message);
          }}
        >
          {loadingGoogle ? "구글로 이동 중..." : "Google로 로그인"}
        </button>
        <div className="auth-actions">
          <span>계정이 없나요?</span>
          <Link href="/signup" className="auth-link">
            회원가입
          </Link>
        </div>
        <button
          type="button"
          className="btn auth-secondary"
          onClick={() => (window.location.href = "/?preview=1")}
        >
          미리보기
        </button>
      </div>
    </div>
  );
}
