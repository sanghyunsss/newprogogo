"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyRPage() {
  const router = useRouter();
  useEffect(() => {
    alert("보안 강화를 위해 새로운 링크가 적용되었습니다.\n관리자에게 새 링크를 받아주세요.");
    router.replace("/");
  }, [router]);

  return null;
}