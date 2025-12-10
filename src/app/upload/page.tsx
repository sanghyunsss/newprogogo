"use client";

import { useState } from "react";

type UploadResponse =
  | { ok: true; total: number; created: number; updated: number; byDate: Record<string, number> }
  | { ok: false; error: string };

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setLog("");
    try {
      const res = await fetch("/api/bookings/upload", { method: "POST", body: form });
      const data = (await res.json()) as UploadResponse;
      setLog(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog(msg);
    } finally {
      setBusy(false);
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>객실 명부 대량 업로드</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "10px 14px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 700 }}
        >
          {busy ? "업로드 중" : "업로드"}
        </button>
      </form>
      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: "#f6f6f7",
          borderRadius: 8,
          fontSize: 13,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {log}
      </pre>
    </main>
  );
}