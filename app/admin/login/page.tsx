"use client";

import { FormEvent, useState } from "react";
import { signInWithEmail, signOut } from "@/lib/supabase";

const ADMIN_EMAILS =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean) ?? [];

const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isAdminEmail(email)) {
      setError("관리자 권한이 없는 이메일입니다.");
      return;
    }
    setLoading(true);
    const { error: err } = await signInWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="auth-page">
      <div className="auth-hero auth-hero-top">
        <div className="auth-logo">MUCHI NOTE Admin</div>
        <div className="auth-tagline">관리자 전용 로그인</div>
      </div>
      <div className="auth-card">
        <h1 className="auth-title">관리자 로그인</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span>관리자 이메일</span>
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
          className="btn auth-secondary"
          onClick={async () => {
            await signOut();
            window.location.href = "/login";
          }}
          style={{ marginTop: "8px" }}
        >
          일반 로그인으로
        </button>
      </div>
    </div>
  );
}
