"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type UserPoint = { date: string; count: number };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<UserPoint[]>([]);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "사용자 조회 실패");
        }
        const data = await res.json();
        if (mounted) {
          const list = (data.users || []) as AdminUser[];
          setUsers(list);
          setTrend(buildTrend(list, range));
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "사용자 조회 중 오류");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [range]);

  useEffect(() => {
    setTrend(buildTrend(users, range));
  }, [users, range]);

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
        <h2 style={{ margin: 0, marginBottom: "8px" }}>사용자 가입 추이</h2>
        {loading && <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>불러오는 중…</p>}
        {error && <p style={{ margin: 0, color: "#dc2626", fontSize: "13px" }}>{error}</p>}
        {!loading && !error && (
          <>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px", fontSize: "13px", color: "#374151" }}>
              <label
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                onClick={() => startInputRef.current?.showPicker && startInputRef.current.showPicker()}
              >
                <span style={{ fontWeight: 600, color: "#f97316" }}>시작일</span>
                <input
                  type="date"
                  value={range.start}
                  ref={startInputRef}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRange((prev) => {
                      const end = prev.end < next ? next : prev.end;
                      return { start: next, end };
                    });
                  }}
                  max={range.end}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "6px 8px",
                    fontSize: "12px",
                    color: "#111827",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                />
              </label>
              <label
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                onClick={() => endInputRef.current?.showPicker && endInputRef.current.showPicker()}
              >
                <span style={{ fontWeight: 600, color: "#f97316" }}>종료일</span>
                <input
                  type="date"
                  value={range.end}
                  ref={endInputRef}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRange((prev) => {
                      const start = prev.start > next ? next : prev.start;
                      return { start, end: next };
                    });
                  }}
                  min={range.start}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "6px 8px",
                    fontSize: "12px",
                    color: "#111827",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                />
              </label>
            </div>
            <UserChart trend={trend} />
          </>
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
        <h2 style={{ margin: 0, marginBottom: "8px" }}>사용자 목록</h2>
        {loading && <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>불러오는 중…</p>}
        {error && <p style={{ margin: 0, color: "#dc2626", fontSize: "13px" }}>{error}</p>}
        {!loading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>이메일</th>
                  <th style={{ padding: "8px 6px" }}>가입일</th>
                  <th style={{ padding: "8px 6px" }}>최근 로그인</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 6px" }}>{u.email ?? "-"}</td>
                    <td style={{ padding: "8px 6px" }}>{u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</td>
                    <td style={{ padding: "8px 6px" }}>
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={3} style={{ padding: "10px 6px", color: "#6b7280" }}>
                      사용자 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UserChart({ trend }: { trend: UserPoint[] }) {
  if (!trend.length) {
    return <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>데이터 없음</p>;
  }
  const max = Math.max(...trend.map((p) => p.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "140px", marginTop: "8px" }}>
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

function buildTrend(users: AdminUser[], range: { start: string; end: string }): UserPoint[] {
  if (!range.start || !range.end) return [];
  const startDate = new Date(range.start);
  const endDate = new Date(range.end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return [];
  const days =
    Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1) || 1;
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  users.forEach((u) => {
    if (!u.created_at) return;
    const key = u.created_at.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}
