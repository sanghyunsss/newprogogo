// app/admin/UploadModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function UploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean;
    created?: number;
    failed?: number;
    errors?: Array<{ row: number; reason: string }>;
    error?: string;
  } | null>(null);
  const [showExample, setShowExample] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 실패 이유 표기 단일화
  const normReason = (s: string) => (s?.startsWith("중복") ? "중복" : s || "오류");

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch("/api/admin/daily-upload", { method: "POST", body: form });
      const data = await r.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: "업로드 실패" });
    } finally {
      setLoading(false);
    }
  }

  // 샘플 데이터 + CSV 다운로드
  const sampleRows: Array<Record<string, string>> = [
    { 객실타입: "스튜디오", 호실: "P-101호", 입실일시: "2025-10-09 15:00", 퇴실일시: "2025-10-10 11:00", 예약자명: "안민수", 연락처: "010-3713-7271" },
    { 객실타입: "플러스",   호실: "P-201호", 입실일시: "2025-10-10 15:00", 퇴실일시: "2025-10-12 11:00", 예약자명: "Jin Seong Heo", 연락처: "010-9046-6306" },
    { 객실타입: "오션뷰",   호실: "P-301호", 입실일시: "2025-10-09 15:00", 퇴실일시: "2025-10-11 11:00", 예약자명: "서승희", 연락처: "0503-5087-9379" },
  ];
  const toCSV = (rows: Array<Record<string, string>>): string => {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = headers.map(esc).join(",");
    const body = rows.map(r => headers.map(h => esc(String(r[h] ?? ""))).join(",")).join("\n");
    return `${head}\n${body}\n`;
  };
  const downloadSampleCSV = () => {
    const csv = toCSV(sampleRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "daily-upload-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exampleTable = useMemo(() => (
    <table className="result-table" style={{ minWidth: 720, borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>객실타입</th>
          <th>호실</th>
          <th>입실일시</th>
          <th>퇴실일시</th>
          <th>예약자명</th>
          <th>연락처</th>
        </tr>
      </thead>
      <tbody>
        {sampleRows.map((r, i) => (
          <tr key={i}>
            <td>{r.객실타입}</td>
            <td>{r.호실}</td>
            <td>{r.입실일시}</td>
            <td>{r.퇴실일시}</td>
            <td>{r.예약자명}</td>
            <td>{r.연락처}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ), []);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Excel 대량업로드</h2>

        {/* 안내 + 예시 */}
        <div className="hint-box">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>필수 컬럼</div>
          <ul className="hint-list">
            <li>객실타입</li>
            <li>호실</li>
            <li>입실일시 (예: 2025-10-09 15:00 또는 2025.10.09 15:00)</li>
            <li>퇴실일시 (예: 2025-10-10 11:00 또는 2025.10.10 11:00)</li>
            <li>예약자명</li>
            <li>연락처 (예: 010-1234-5678 / 0507-1234-5678)</li>
          </ul>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowExample(v => !v)}>
              {showExample ? "예시 접기" : "예시 펼치기"}
            </button>
            <button className="btn" onClick={downloadSampleCSV}>샘플 CSV 다운로드</button>
          </div>

          {showExample && (
            <div className="result-table-wrap" style={{ marginTop: 8 }}>
              {exampleTable}
            </div>
          )}
        </div>

        {/* 업로드 폼 */}
        <div style={{ display: "grid", gap: 10, marginBottom: 12, marginTop: 12 }}>
          <input
            ref={inputRef}
            className="input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose} disabled={loading}>닫기</button>
            <button className="btn btn-brown" onClick={handleUpload} disabled={!file || loading}>
              {loading ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </div>

        {/* 결과 영역 */}
        {result && (
          <div className="result-box">
            {result.ok ? (
              <>
                <div className="result-summary">
                  <div>성공: <b>{result.created ?? 0}</b> 건</div>
                  <div>실패: <b>{result.failed ?? 0}</b> 건</div>
                </div>
                {Boolean(result.failed) && Array.isArray(result.errors) && result.errors!.length > 0 && (
                  <div className="result-table-wrap">
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>행 번호</th>
                          <th>실패 사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors!.map((e, i) => (
                          <tr key={i}>
                            <td>Row {e.row}</td>
                            <td>{normReason(e.reason)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ textAlign: "right", marginTop: 12 }}>
                  <button className="btn btn-brown" onClick={onSuccess}>확인</button>
                </div>
              </>
            ) : (
              <div className="error-box">에러: {result.error ?? "알 수 없는 오류"}</div>
            )}
          </div>
        )}

        <style jsx>{`
          .modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.4);
            display: grid; place-items: center; z-index: 1000;
          }
          .modal-content {
            width: min(820px, 92vw);
            background: #fff; border: 1px solid #eee; border-radius: 14px;
            padding: 16px; box-shadow: 0 12px 28px rgba(0,0,0,.12);
          }
          .hint-box { border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px; background: #fafafa; }
          .hint-list { margin: 0 0 0 16px; padding: 0; font-size: 13px; line-height: 1.6; }
          .result-box { margin-top: 8px; border-top: 1px solid #f0f0f0; padding-top: 12px; }
          .result-summary { display: flex; gap: 16px; font-size: 14px; margin-bottom: 8px; }
          .result-table-wrap { max-height: 260px; overflow: auto; border: 1px solid #eee; border-radius: 8px; background: #fff; }
          .result-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .result-table th, .result-table td { padding: 8px 10px; border-bottom: 1px solid #f2f2f2; text-align: left; }
          .error-box { color: #c0392b; background: #fdecea; border: 1px solid #f5c6cb; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
        `}</style>
      </div>
    </div>
  );
}