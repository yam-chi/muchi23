"use client";

export default function AdminUsersPage() {
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
      <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
        auth.users 접근 또는 별도 뷰/RPC 연결 필요. 이메일·가입일 리스트를 여기에 표시할 예정입니다.
      </p>
    </div>
  );
}
