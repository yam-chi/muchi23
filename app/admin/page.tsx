"use client";

import { useEffect, useState } from "react";
import { supabase, signOut } from "@/lib/supabase";

type Stats = {
  cardsTotal: number | null;
  cardsRecent7: number | null;
  usersTotal: number | null;
  feedbackTotal: number | null;
};

type TrendPoint = { date: string; count: number };
type LogEntry = {
  id: string;
  level: string;
  message: string;
  context: any;
  created_at: string;
};

type FeedbackEntry = {
  id: string;
  text: string;
  user_id: string | null;
  created_at: string | null;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    cardsTotal: null,
    cardsRecent7: null,
    usersTotal: null,
    feedbackTotal: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);

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
        // 사용자 총합은 admin API 경유
        const usersRes = await fetch("/api/admin/users");
        let usersTotal = null;
        if (usersRes.ok) {
          const json = await usersRes.json();
          if (Array.isArray(json.users)) usersTotal = json.users.length;
        }
        // 문의/제보 총합 + 최신 5건
        const { count: feedbackTotal } = await supabase
          .from("feedback")
          .select("*", { count: "exact", head: true });
        const { data: feedbackRows } = await supabase
          .from("feedback")
          .select("id,text,created_at,user_id")
          .order("created_at", { ascending: false })
          .limit(5);

        if (mounted) {
          setStats({
            cardsTotal: cardsTotal ?? null,
            cardsRecent7: cardsRecent7 ?? null,
            usersTotal,
            feedbackTotal: feedbackTotal ?? null,
          });
          setFeedbacks(feedbackRows ?? []);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "통계 조회 중 오류");
      }
      try {
        const res = await fetch("/api/admin/logs");
        if (res.ok) {
          const json = await res.json();
          if (mounted) setLogs(json.logs ?? []);
        }
      } catch (e) {
        console.error("log fetch error", e);
      }
    })();
    // 선택한 기간의 카드 생성 추이
    (async () => {
      try {
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        // endDate 포함되도록 하루 더
        const endPlus = new Date(endDate);
        endPlus.setDate(endPlus.getDate() + 1);

        const { data, error: trendErr } = await supabase
          .from("cards")
          .select("created_at")
          .gte("created_at", startDate.toISOString())
          .lt("created_at", endPlus.toISOString());
        if (trendErr) throw trendErr;

        const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const counts = new Map<string, number>();
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          counts.set(key, 0);
        }
        data?.forEach((row) => {
          const key = row.created_at?.slice(0, 10);
          if (key && counts.has(key)) {
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        });
        const points: TrendPoint[] = Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
        if (mounted) setTrend(points);
      } catch (e) {
        console.error("trend fetch error", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [range]);

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
          <StatCard label="총 유저 수" value={stats.usersTotal} />
          <StatCard label="총 문의/제보" value={stats.feedbackTotal} />
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
        <h3 style={{ margin: "0 0 8px" }}>카드 생성 추이</h3>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", fontSize: "13px", color: "#374151" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontWeight: 600, color: "#f97316" }}>시작일</span>
            <input
              type="date"
              value={range.start}
              onChange={(e) => setRange((prev) => ({ ...prev, start: e.target.value }))}
              max={range.end}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "#111827",
                background: "#fff",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontWeight: 600, color: "#f97316" }}>종료일</span>
            <input
              type="date"
              value={range.end}
              onChange={(e) => setRange((prev) => ({ ...prev, end: e.target.value }))}
              min={range.start}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "#111827",
                background: "#fff",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </label>
        </div>
        <UsageChart trend={trend} />
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
        {feedbacks.length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>최근 문의/제보가 없습니다.</p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={{ padding: "8px 10px", width: "140px" }}>작성일</th>
                  <th style={{ padding: "8px 10px" }}>내용 (앞부분)</th>
                  <th style={{ padding: "8px 10px", width: "160px" }}>user_id</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 10px", color: "#6b7280" }}>
                      {f.created_at ? new Date(f.created_at).toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#111827" }}>
                      {f.text?.length ? `${f.text.slice(0, 60)}${f.text.length > 60 ? "…" : ""}` : "-"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#6b7280", wordBreak: "break-all" }}>
                      {f.user_id ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <h3 style={{ margin: "0 0 8px" }}>에러/동기화 로그 (최근 50건)</h3>
        <LogList logs={logs} />
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

function UsageChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) {
    return <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>데이터 없음</p>;
  }
  const max = Math.max(...trend.map((p) => p.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "140px" }}>
      {trend.map((p) => {
        const h = (p.count / max) * 120;
        return (
          <div
            key={p.date}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "8px",
              cursor: "default",
            }}
          >
            {p.count > 0 && (
              <div style={{ fontSize: "10px", color: "#111827", marginBottom: "2px" }}>{p.count}</div>
            )}
            <div
              style={{
                width: "10px",
                height: `${h}px`,
                background: "#f97316",
                borderRadius: "4px 4px 0 0",
                transition: "opacity 0.15s",
                opacity: 0.9,
              }}
              title={`${p.date} : ${p.count}`}
            />
            <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "4px" }}>{p.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

function LogList({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) {
    return <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>로그 없음</p>;
  }
  return (
    <div style={{ maxHeight: "240px", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: "8px 6px", width: "80px" }}>레벨</th>
            <th style={{ padding: "8px 6px" }}>메시지</th>
            <th style={{ padding: "8px 6px", width: "160px" }}>시간</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "8px 6px", color: l.level === "error" ? "#dc2626" : "#111827" }}>{l.level}</td>
              <td style={{ padding: "8px 6px" }}>{l.message}</td>
              <td style={{ padding: "8px 6px", color: "#6b7280" }}>
                {l.created_at ? new Date(l.created_at).toLocaleString() : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
