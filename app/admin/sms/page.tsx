// app/admin/sms/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** ---------- types ---------- */
type Kind = "checkin" | "checkout";
type Take = 50 | 100 | 300 | 500;

type Template = { content: string; subject?: string; templateCode?: string };
type TemplateMap = { checkin: Template; checkout: Template };

type SmsTarget = {
  to: string;
  name?: string | null;
  var2?: string | null; // 호실
  resultCode?: string | null;
  resultDesc?: string | null;
};

type SmsMessageRow = {
  id: number;
  createdAt: string;
  refKey: string | null;
  messageKey: string | null;
  type: string;
  content: string;
  status: string;
  targets: SmsTarget[];
};

type HistoryResponse = {
  list: SmsMessageRow[];
  page: number;
  totalPages: number;
  total: number;
};

/** ---------- helpers ---------- */
const bytes = (s: string) => new TextEncoder().encode(s).length;
const sendKind = (b: number) => (b <= 90 ? "SMS" : "LMS");
function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

/** ================================================================== */
export default function SmsCenterPage() {
  /** 템플릿 상태 */
  const [tpls, setTpls] = useState<TemplateMap>({
    checkin: { content: "", subject: "", templateCode: "" },
    checkout: { content: "", subject: "", templateCode: "" },
  });
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [saving, setSaving] = useState<Kind | null>(null);

  /** 로그 상태 */
  const [logs, setLogs] = useState<SmsMessageRow[]>([]);
  const [take, setTake] = useState<Take>(50);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);

  /** 바이트/전송유형 메모 */
  const ciBytes = useMemo(() => bytes(tpls.checkin.content || ""), [tpls.checkin.content]);
  const coBytes = useMemo(() => bytes(tpls.checkout.content || ""), [tpls.checkout.content]);
  const ciType = sendKind(ciBytes);
  const coType = sendKind(coBytes);

  /** 템플릿 로드 */
  const loadTemplates = useCallback(async () => {
    setLoadingTpl(true);
    try {
      const r = await fetch("/api/sms/templates", { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; templates?: Record<Kind, Template> };
      if (j.ok && j.templates) {
        setTpls({
          checkin: {
            content: j.templates.checkin?.content ?? "",
            subject: j.templates.checkin?.subject ?? "",
            templateCode: j.templates.checkin?.templateCode ?? "",
          },
          checkout: {
            content: j.templates.checkout?.content ?? "",
            subject: j.templates.checkout?.subject ?? "",
            templateCode: j.templates.checkout?.templateCode ?? "",
          },
        });
      }
    } finally {
      setLoadingTpl(false);
    }
  }, []);

  /** 템플릿 저장 */
  const saveTemplate = async (kind: Kind) => {
    if (saving) return;
    setSaving(kind);
    try {
      const body =
        kind === "checkin"
          ? {
              kind,
              content: tpls.checkin.content,
              subject: ciType === "LMS" ? tpls.checkin.subject ?? "" : undefined,
              templateCode: tpls.checkin.templateCode ?? "",
            }
          : {
              kind,
              content: tpls.checkout.content,
              subject: coType === "LMS" ? tpls.checkout.subject ?? "" : undefined,
              templateCode: tpls.checkout.templateCode ?? "",
            };

      const r = await fetch("/api/sms/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) alert(j?.error || "저장 실패");
      else alert("저장되었습니다.");
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(null);
    }
  };

 /** 로그 로드 */
const loadLogs = useCallback(
  async (opts?: { page?: number; take?: Take }) => {
    setLoadingLogs(true);
    const p = opts?.page ?? page;
    const t = opts?.take ?? take;
    try {
      const r = await fetch(`/api/sms/history?take=${t}&page=${p}`, { cache: "no-store" });
      const j = (await r.json()) as HistoryResponse;
      setLogs(j.list || []);
      // 페이지는 서버 응답으로 다시 세팅하지 않음(루프 방지)
      setTotalPages(j.totalPages || 1);
      setTotal(j.total || 0);
    } finally {
      setLoadingLogs(false);
    }
  },
  [page, take]
);

useEffect(() => { loadTemplates(); }, [loadTemplates]);

// page/take 변경을 하나의 효과로 처리
useEffect(() => {
  void loadLogs({ page, take });
}, [page, take, loadLogs]);

// 표시줄 수가 바뀌면 1페이지로 이동
useEffect(() => {
  setPage(1);
}, [take]);

  /** 렌더 */
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
      {/* 템플릿 에디터들 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <TemplateEditor
          title="입실 안내 – SMS 대체문자"
          loading={loadingTpl}
          value={tpls.checkin.content}
          subject={tpls.checkin.subject ?? ""}
          templateCode={tpls.checkin.templateCode ?? ""}
          setValue={(v) => setTpls((prev) => ({ ...prev, checkin: { ...prev.checkin, content: v } }))}
          setSubject={(v) => setTpls((prev) => ({ ...prev, checkin: { ...prev.checkin, subject: v } }))}
          setTemplateCode={(v) => setTpls((prev) => ({ ...prev, checkin: { ...prev.checkin, templateCode: v } }))}
          bytes={ciBytes}
          sendType={ciType}
          onSave={() => saveTemplate("checkin")}
          saving={saving === "checkin"}
        />

        <TemplateEditor
          title="퇴실 안내 – SMS 대체문자"
          loading={loadingTpl}
          value={tpls.checkout.content}
          subject={tpls.checkout.subject ?? ""}
          templateCode={tpls.checkout.templateCode ?? ""}
          setValue={(v) => setTpls((prev) => ({ ...prev, checkout: { ...prev.checkout, content: v } }))}
          setSubject={(v) => setTpls((prev) => ({ ...prev, checkout: { ...prev.checkout, subject: v } }))}
          setTemplateCode={(v) => setTpls((prev) => ({ ...prev, checkout: { ...prev.checkout, templateCode: v } }))}
          bytes={coBytes}
          sendType={coType}
          onSave={() => saveTemplate("checkout")}
          saving={saving === "checkout"}
        />
      </div>

      {/* 발송 로그 */}
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>최근 발송 로그</h2>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#666", fontSize: 13 }}>표시 줄수</span>
            <select
              className="input"
              value={take}
              onChange={(e) => onChangeTake(Number(e.target.value) as Take)}
              style={{ width: 100 }}
            >
              <option value={50}>50줄</option>
              <option value={100}>100줄</option>
              <option value={300}>300줄</option>
              <option value={500}>500줄</option>
            </select>
          </div>
        </div>

        <div style={{ color: "#666", fontSize: 13, marginBottom: 6 }}>
          총 {total.toLocaleString()}건 · {page}/{totalPages}페이지
        </div>

        <div className="table-scroll">
          <table className="daily-table">
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <Th>시간</Th>
                <Th>이름</Th>
                <Th>연락처</Th>
                <Th>호실</Th>
                <Th>refKey</Th>
                <Th>messageKey</Th>
                <Th>상태</Th>
                <Th>유형</Th>
                <Th>내용</Th>
                <Th>대상수</Th>
                <Th>실패사유(있을 때)</Th>
              </tr>
            </thead>
            <tbody>
              {!loadingLogs && logs.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#888" }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
              {logs.map((m) => {
                const t = m.targets[0];
                const firstFail = m.targets.find((x) => x.resultCode && x.resultCode !== "1000");
                return (
                  <tr key={m.id} style={{ borderTop: "1px solid #eee" }}>
                    <Td>{new Date(m.createdAt).toLocaleString()}</Td>
                    <Td>{t?.name ?? "—"}</Td>
                    <Td>{t?.to ?? "—"}</Td>
                    <Td>{t?.var2 ?? "—"}</Td>

                    {/* 긴 값들은 말줄임 */}
                    <Td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                      {m.refKey ?? "—"}
                    </Td>
                    <Td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                      {m.messageKey ?? "—"}
                    </Td>

                    <Td>{m.status}</Td>
                    <Td>{m.type}</Td>

                    <Td
                      title={m.content}
                      style={{ maxWidth: 480, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                    >
                      {m.content}
                    </Td>
                    <Td>{m.targets?.length ?? 0}</Td>
                    <Td title={firstFail?.resultDesc ?? ""} style={{ color: firstFail ? "#b91c1c" : "#444" }}>
                      {firstFail ? `${firstFail.resultCode ?? ""} ${firstFail.resultDesc ?? ""}` : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button className="btn" disabled={page <= 1 || loadingLogs} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ◀ 이전
          </button>
          <div style={{ alignSelf: "center", color: "#666" }}>{page} / {totalPages}</div>
          <button
            className="btn"
            disabled={page >= totalPages || loadingLogs}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음 ▶
          </button>
        </div>
      </section>
    </div>
  );
}

/** ---------- small presentational bits ---------- */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 8px",
        borderBottom: "1px solid #eee",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  title,
  style,
}: {
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      title={title}
      style={{
        padding: "10px 8px",
        verticalAlign: "top",
        fontFamily: mono
          ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          : undefined,
        ...(style || {}),
      }}
    >
      {children}
    </td>
  );
}

function TemplateEditor(props: {
  title: string;
  loading: boolean;
  value: string;
  subject: string;
  templateCode: string;
  setValue: (v: string) => void;
  setSubject: (v: string) => void;
  setTemplateCode: (v: string) => void;
  bytes: number;
  sendType: "SMS" | "LMS";
  onSave: () => void;
  saving: boolean;
}) {
  const {
    title,
    loading,
    value,
    subject,
    templateCode,
    setValue,
    setSubject,
    setTemplateCode,
    bytes,
    sendType,
    onSave,
    saving,
  } = props;

  return (
    <section style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
      <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>{title}</h2>

      <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: "#444" }}>
          카카오 템플릿 코드
          <input
            className="input"
            placeholder="ppur_2025..."
            value={templateCode}
            onChange={(e) => setTemplateCode(e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
      </div>

      <div style={{ color: "#666", fontSize: 13, marginBottom: 6 }}>
        바이트: <b>{bytes}</b> / 90 · <span>전송유형: <b>{sendType}</b></span>{" "}
        <span style={{ color: "#999" }}>(90B 초과 시 LMS)</span>
      </div>

      {sendType === "LMS" && (
        <div style={{ marginBottom: 6 }}>
          <input
            className="input"
            placeholder="제목(LMS 전용)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <textarea
        rows={10}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={"템플릿 내용을 입력하세요.\n변수 예시: [*1*] 객실타입, [*2*] 객실번호, [*3*] 링크토큰"}
        style={{ width: "100%", fontFamily: "inherit" }}
      />

      <div style={{ marginTop: 8 }}>
        <button className={cx("btn", "btn-brown")} onClick={onSave} disabled={saving || loading}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </section>
  );
}