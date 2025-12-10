"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const qs = useSearchParams();
  const presetEmail = qs.get("email") ?? "";
  const presetMsg = qs.get("msg") ?? ""; // 필요시 ?msg= 로 안내문 표기

  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(presetMsg || null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(typeof j?.error === "string" ? j.error : "로그인에 실패했습니다.");
        setBusy(false);
        return;
      }
      // 로그인 성공 → 관리자 대시보드로
      location.href = "/admin";
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "48px auto", padding: "0 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>관리자 로그인</div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#666" }}>이메일</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            style={{
              height: 40,
              padding: "0 12px",
              border: "1px solid #e6e6e6",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#666" }}>비밀번호</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              height: 40,
              padding: "0 12px",
              border: "1px solid #e6e6e6",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fff4f4",
              color: "#b00020",
              border: "1px solid #ffd6d6",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 4,
            height: 44,
            border: "none",
            borderRadius: 10,
            background: "#a4825f",
            color: "#fff",
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}