"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  signInWithEmail,
  signInWithGoogle,
  requestPasswordReset,
} from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setInfo(null);
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
        <div className="auth-tagline">슥슥 쓰고 지우는 To do list</div>
      </div>
      <div className="auth-card">
        <div className="auth-header-row">
          <h1 className="auth-title">로그인</h1>
          <Link href="/?preview=1" className="auth-preview-link">
            미리 써보기
          </Link>
        </div>
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
          className="btn auth-secondary auth-reset"
          onClick={() => {
            setError(null);
            setInfo(null);
            setResetMessage(null);
            setResetEmail(email);
            setResetModalOpen(true);
          }}
        >
          비밀번호 찾기
        </button>
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
        {info && <div className="auth-success">{info}</div>}
      </div>

      {resetModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setResetModalOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="auth-title">비밀번호 찾기</h2>
            <p className="auth-helper">가입한 이메일로 재설정 링크를 보내드려요.</p>
            <form
              className="auth-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setResetMessage(null);
                setError(null);
                setLoadingReset(true);
                const { error: resetErr } = await requestPasswordReset(resetEmail);
                setLoadingReset(false);
                if (resetErr) {
                  setError(resetErr.message);
                } else {
                  setResetMessage("재설정 이메일을 보냈습니다. 메일함을 확인해주세요.");
                }
              }}
            >
              <label className="auth-field">
                <span>이메일</span>
                <input
                  className="auth-input"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </label>
              <div className="auth-modal-actions">
                <button
                  type="button"
                  className="btn auth-secondary"
                  onClick={() => setResetModalOpen(false)}
                >
                  닫기
                </button>
                <button className="btn auth-submit" type="submit" disabled={loadingReset}>
                  {loadingReset ? "보내는 중..." : "이메일 보내기"}
                </button>
              </div>
              {resetMessage && <div className="auth-success">{resetMessage}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
