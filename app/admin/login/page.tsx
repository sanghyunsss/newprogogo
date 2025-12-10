//  app/admin/login/page.tsx

"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = await r.json();
        setErr(j.error || "로그인 실패");
        return;
      }
      location.href = "/admin";
    } catch (e) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("error");
      }
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <form onSubmit={submit} style={{ width: 320, padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>관리자 로그인</h1>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            className="input"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <div style={{ color: "red", fontSize: 14 }}>{err}</div>}
          <button className="btn btn-brown" type="submit">로그인</button>
        </div>
      </form>
    </main>
  );
}