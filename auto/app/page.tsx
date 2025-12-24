"use client";

import Link from "next/link";
ㅁ
export default function Home() {
  const links = [
    { href: "/onboarding/requests", label: "담당자 대시보드 (온보딩 목록)" },
    { href: "/onboarding/1/step0", label: "예시: STEP0 페이지 (id=1)" },
    { href: "/onboarding/1/step1", label: "예시: STEP1 페이지 (id=1)" },
    { href: "/onboarding/1/step2", label: "예시: STEP2 페이지 (id=1)" },
    { href: "/onboarding/1/step3", label: "예시: STEP3 페이지 (id=1)" },
    { href: "/onboarding/1/step4", label: "예시: STEP4 페이지 (id=1)" },
    { href: "/onboarding/1/step5", label: "예시: STEP5 페이지 (id=1)" },
  ];

  return (
    <main style={{ minHeight: "100vh", padding: "32px", background: "#f9fafb" }}>
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          display: "grid",
          gap: "16px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>Onboarding Phase 1</h1>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
          아래 링크로 이동해 상태 가드/라우팅이 연결된 온보딩 더미 화면을 확인할 수 있습니다. (id=1은 예시 값이므로
          실제 존재하는 온보딩 id로 교체하세요.)
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "8px", color: "#111827" }}>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} style={{ color: "#2563eb" }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

