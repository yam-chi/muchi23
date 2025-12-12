"use client";

import { useEffect, useState } from "react";

type Feedback = {
  id: string;
  user_id: string | null;
  text: string | null;
  created_at: string | null;
};

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/feedback");
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "문의/제보 조회 실패");
        }
        const json = await res.json();
        if (mounted) setRows(json.feedback || []);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "문의/제보 조회 중 오류");
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
      <h2 style={{ margin: 0, marginBottom: "8px" }}>문의/제보</h2>
      {loading && <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>불러오는 중…</p>}
      {error && <p style={{ margin: 0, color: "#dc2626", fontSize: "13px" }}>{error}</p>}
      {!loading && !error && (
        <div style={{ maxHeight: "360px", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "8px 6px", width: "140px" }}>작성자</th>
                <th style={{ padding: "8px 6px" }}>내용</th>
                <th style={{ padding: "8px 6px", width: "160px" }}>시간</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 6px", color: "#374151" }}>{f.user_id ?? "-"}</td>
                  <td style={{ padding: "8px 6px", color: "#111827" }}>{f.text ?? "-"}</td>
                  <td style={{ padding: "8px 6px", color: "#6b7280" }}>
                    {f.created_at ? new Date(f.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} style={{ padding: "10px 6px", color: "#6b7280" }}>
                    문의/제보가 없습니다.
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
