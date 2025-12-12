"use client";

export default function AdminFeedbackPage() {
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
      <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
        feedback 테이블을 만들고, 무치노트 본편에 제보 입력 UI를 추가한 뒤 여기에서 row text/작성자/작성일을 보여줄 예정입니다.
      </p>
    </div>
  );
}
