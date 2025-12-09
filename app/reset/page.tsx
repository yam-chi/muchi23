"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPage() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error: sessErr }) => {
          if (sessErr) setError(sessErr.message);
          setLoading(false);
        });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (!c) {
      setError("유효하지 않은 링크입니다. 메일의 최신 링크를 다시 확인해주세요.");
      setLoading(false);
      return;
    }
    setCode(c);
    supabase.auth.exchangeCodeForSession(c).then(({ error: exErr }) => {
      if (exErr) setError(exErr.message);
      setLoading(false);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 같지 않습니다.");
      return;
    }
    if (!code) {
      setError("유효하지 않은 요청입니다.");
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSuccess("비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">비밀번호 재설정</h1>
        {loading ? (
          <div className="auth-actions">링크 확인 중...</div>
        ) : error ? (
          <div className="auth-error">{error}</div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>새 비밀번호</span>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              <span>비밀번호 확인</span>
              <input
                className="auth-input"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </label>
            <button className="btn auth-submit" type="submit">
              변경하기
            </button>
            {success && <div className="auth-success">{success}</div>}
          </form>
        )}
        <button
          type="button"
          className="btn auth-secondary"
          onClick={() => (window.location.href = "/login")}
        >
          로그인으로 돌아가기
        </button>
      </div>
    </div>
  );
}
