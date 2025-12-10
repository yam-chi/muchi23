/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://cdnjs.cloudflare.com https://frontend-assets.supabase.com https://vercel.live https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Supabase 프로젝트 도메인
      "connect-src 'self' https://ndayxojdgsolszqamzbq.supabase.co",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
