"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPage() {
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessErr }) => {
      if (sessErr) {
        setError(sessErr.message);
      } else if (!data.session) {
        setError("로그인 후 비밀번호를 변경할 수 있습니다.");
      } else {
        setSessionReady(true);
      }
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
    if (!sessionReady) {
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
        <h1 className="auth-title">비밀번호 변경</h1>
        {loading ? (
          <div className="auth-actions">세션 확인 중...</div>
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
