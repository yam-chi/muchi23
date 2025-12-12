"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, getSession } from "@/lib/supabase";

const ADMIN_EMAILS =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean) ?? [];

const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 로그인 페이지에서는 관리자 체크를 건너뛰고 바로 렌더
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/login")) {
        if (mounted) setChecked(true);
        return;
      }
      const session = await getSession();
      const email = session?.user?.email ?? "";
      if (!session) {
        window.location.href = "/admin/login";
        return;
      }
      if (!ADMIN_EMAILS.length || !isAdminEmail(email)) {
        await signOut();
        window.location.href = "/login";
        return;
      }
      if (mounted) setChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!checked) return null;

  // /admin/login 에서는 레이아웃 없이 본문만 렌더
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/login")) {
    return <main>{children}</main>;
  }

  const navItems = [
    { href: "/admin", label: "대시보드" },
    { href: "/admin/users", label: "사용자" },
    { href: "/admin/cards", label: "카드" },
    { href: "/admin/feedback", label: "문의/제보" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", padding: "24px" }}>
      <header
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <span style={{ fontWeight: 800, fontSize: "18px", color: "#111827" }}>MUCHI NOTE Admin</span>
          <nav style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    color: "#f97316",
                    opacity: active ? 1 : 0.5,
                    fontWeight: active ? 700 : 600,
                    textDecoration: "none",
                    paddingBottom: "2px",
                    borderBottom: "none",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: "10px",
            padding: "6px 10px",
            cursor: "pointer",
            color: "#374151",
            alignSelf: "flex-end",
          }}
          onClick={async () => {
            await signOut();
            window.location.href = "/login";
          }}
        >
          로그아웃
        </button>
      </header>
      <main>{children}</main>
    </div>
  );
}
