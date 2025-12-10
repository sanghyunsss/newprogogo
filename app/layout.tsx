// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://admins.morethansc.co.kr"), // 도메인
  title: {
    default: "모어댄 속초해변점 | 객실 이용 가이드",
    template: "%s | 모어댄 속초", // 개별 페이지가 있으면 여기에 붙음
  },
  description: "체크인/체크아웃, 객실 제어, 주차등록까지 한 번에!",
  openGraph: {
    title: "모어댄 속초해변점 | 객실 이용 가이드",
    description: "체크인/체크아웃, 객실 제어, 주차등록까지 한 번에!",
    url: "https://admins.morethansc.co.kr",
    siteName: "모어댄 속초",
    images: [
      {
        url: "https://cdn.imweb.me/upload/S2024061415aaa01b5e500/e2ea55ed2a058.png", // public/og-image.png (넣어두셔야 합니다!)
        width: 1200,
        height: 630,
        alt: "모어댄 속초해변점",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "모어댄 속초해변점 | 객실 이용 가이드",
    description: "체크인/체크아웃, 객실 제어, 주차등록까지 한 번에!",
    images: ["https://cdn.imweb.me/upload/S2024061415aaa01b5e500/e2ea55ed2a058.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}