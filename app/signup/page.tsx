"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signUpWithEmail } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    const { error: err } = await signUpWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess("회원가입 메일이 발송되었습니다. 로그인 후 이용해주세요.");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">회원가입</h1>
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
              autoComplete="new-password"
            />
          </label>
          <label className="auth-field">
            <span>비밀번호 확인</span>
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <button className="btn auth-submit" type="submit" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <div className="auth-actions">
          <span>이미 계정이 있나요?</span>
          <Link href="/login" className="auth-link">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
