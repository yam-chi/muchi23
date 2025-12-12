"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (mounted) setUsers(data.users || []);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "사용자 조회 중 오류");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
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
    </div>
  );
}
