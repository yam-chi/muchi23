"use client";

import { useEffect, useState } from "react";
import { supabase, signOut } from "@/lib/supabase";

type Stats = {
  cardsTotal: number | null;
  cardsRecent7: number | null;
  usersTotal: string | null;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ cardsTotal: null, cardsRecent7: null, usersTotal: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 카드 총합
        const { count: cardsTotal } = await supabase.from("cards").select("*", { count: "exact", head: true });
        // 최근 7일 카드
        const seven = new Date();
        seven.setDate(seven.getDate() - 7);
        const { count: cardsRecent7 } = await supabase
          .from("cards")
          .select("*", { count: "exact", head: true })
          .gte("created_at", seven.toISOString());
        // 사용자 총합 (auth.users 직접 접근이 안 될 수 있으니 null 처리)
        const usersTotal = null; // 연결 필요 시 RPC/뷰 사용
        if (mounted) setStats({ cardsTotal: cardsTotal ?? null, cardsRecent7: cardsRecent7 ?? null, usersTotal });
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "통계 조회 중 오류");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "16px",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
        }}
      >
        <h2 style={{ margin: 0, marginBottom: "10px", fontSize: "16px" }}>요약 통계</h2>
        {error && <div style={{ color: "#dc2626", fontSize: "13px" }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <StatCard label="총 카드 수" value={stats.cardsTotal} />
          <StatCard label="최근 7일 카드" value={stats.cardsRecent7} />
          <StatCard label="총 유저 수" value={stats.usersTotal} helper="auth.users RPC 필요" />
        </div>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "16px",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>문의/제보</h3>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
          feedback 테이블 연결 후 노출 예정. 무치노트 본편에 제보 입력 UI 추가 필요.
        </p>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "16px",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>에러/동기화 로그</h3>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
          수집 스토어(테이블/로그 서비스)와 연결 필요. 현재는 콘솔 수집만.
        </p>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "16px",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: "10px",
            padding: "8px 12px",
            cursor: "pointer",
          }}
          onClick={async () => {
            await signOut();
            window.location.href = "/login";
          }}
        >
          로그아웃
        </button>
        <button
          type="button"
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: "10px",
            padding: "8px 12px",
            cursor: "pointer",
          }}
          onClick={() => {
            window.location.href = "/reset";
          }}
        >
          비밀번호 변경
        </button>
      </section>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: number | string | null; helper?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "12px",
        background: "#f9fafb",
        minHeight: "72px",
      }}
    >
      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>
        {value ?? "확인 필요"}
      </div>
      {helper && <div style={{ fontSize: "12px", color: "#9ca3af" }}>{helper}</div>}
    </div>
  );
}
