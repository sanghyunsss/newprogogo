// src/app/admin/tax-invoices/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/** 회사(공급받는자) 기본 정보 (DB 없을 때 초기값) */
const DEFAULT_ISSUER = {
  id: 1, // 최초 기본값(실제 값은 /api/admin/company/issuer 에서 다시 읽어옴)
  name: "모어댄 속초해변점",
  bizNo: "267-85-03121",
  ceoName: "권혜숙",
  address: "강원특별자치도 속초시 조양동 1452",
  phone: "1661-5512",
  email: "info@morethansc.co.kr",
  bankName: "국민은행",
  bankAccount: "123456-01-000000",
  bankOwner: "모어댄속초해변점",
} as const;

type Issuer = typeof DEFAULT_ISSUER;

type OwnerMini = {
  id: number;
  name: string;
  bizNo: string | null;
  roomInfo: string | null;
  ownerType: "INDIVIDUAL" | "CORPORATION" | null;
  status: "PENDING_PAYMENT" | "PAID" | "TERMINATED";
};

type CompanyMini = {
  id: number;
  name: string;
  bizNo: string;
};

type InvoiceStatus = "PENDING" | "REQUESTED" | "ISSUED" | "CANCELED";

type Row = {
  id: number;
  issueDate: string;
  supplyDate: string | null;
  yearMonth: string | null;
  title: string | null;
  qty: number;
  unitPrice: number;
  supplyValue: number;
  vat: number;
  total: number;
  roomInfo: string | null;
  memo: string | null;
  status: InvoiceStatus;
  owner: OwnerMini;
  company: CompanyMini;
};

type ResList = {
  ok: boolean;
  rows: Row[];
  total: number;
  page: number;
  size: number;
  error?: string;
};

type FormMode = "create" | "edit";

type FormState = {
  id?: number;
  ownerId: string;
  // companyId 는 UI에 안 보이지만 내부적으로는 유지(디버깅용)
  companyId: string;
  issueDate: string;
  supplyDate: string;
  yearMonth: string;
  title: string;
  qty: string;
  unitPrice: string;
  supplyValue: string;
  vat: string;
  total: string;
  roomInfo: string;
  memo: string;
  status: InvoiceStatus;
};

const emptyForm: FormState = {
  ownerId: "",
  companyId: "", // 실 사용 시점에 issuer.id 로 채움
  issueDate: "",
  supplyDate: "",
  yearMonth: "",
  title: "",
  qty: "1",
  unitPrice: "",
  supplyValue: "",
  vat: "",
  total: "",
  roomInfo: "",
  memo: "",
  status: "PENDING",
};

function toDateInputValue(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateShort(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function ownerStatusLabel(v: OwnerMini["status"]) {
  if (v === "PENDING_PAYMENT") return "계약대기";
  if (v === "PAID") return "계약완료";
  if (v === "TERMINATED") return "계약해지";
  return v;
}

function invoiceStatusLabel(v: InvoiceStatus) {
  if (v === "PENDING") return "입금대기";
  if (v === "REQUESTED") return "입금요청";
  if (v === "ISSUED") return "발행완료";
  if (v === "CANCELED") return "취소";
  return v;
}

export default function TaxInvoicesPage() {
  // 회사(공급받는자) 상태
  const [issuer, setIssuer] = useState<Issuer>(DEFAULT_ISSUER);
  const [issuerLoading, setIssuerLoading] = useState(false);
  const [issuerError, setIssuerError] = useState<string | null>(null);

  // 세금계산서 목록 관련 상태
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const [filterMonth, setFilterMonth] = useState("");
  const [filterOwnerName, setFilterOwnerName] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | InvoiceStatus>(
    "ALL"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세금계산서 작성/수정 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 회사정보(issuer) 수정 모달 상태
  const [showIssuerModal, setShowIssuerModal] = useState(false);
  const [issuerForm, setIssuerForm] = useState<Issuer>(DEFAULT_ISSUER);
  const [savingIssuer, setSavingIssuer] = useState(false);
  const [issuerSaveError, setIssuerSaveError] = useState<string | null>(null);

  // 엑셀 업로드 상태
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / size)),
    [total, size]
  );

  // issuer.id 를 반영한 엑셀 예시 텍스트
  const exampleExcelText = useMemo(
    () =>
      [
        [
          "ownerId",
          "companyId",
          "yearMonth",
          "issueDate",
          "supplyDate",
          "title",
          "qty",
          "unitPrice",
          "supplyValue",
          "vat",
          "total",
          "roomInfo",
          "memo",
          "status",
        ].join("\t"),
        [
          "1",
          String(issuer.id || 1),
          "2025-11",
          "2025-11-30",
          "2025-11-30",
          "위탁운영수수료",
          "1",
          "1000000",
          "1000000",
          "100000",
          "1100000",
          "1203호",
          "11월 위탁운영 수수료",
          "PENDING",
        ].join("\t"),
      ].join("\n"),
    [issuer.id]
  );

  // 회사(공급받는자) 정보 로드
  const loadIssuer = async () => {
    setIssuerLoading(true);
    setIssuerError(null);
    try {
      const res = await fetch("/api/admin/company/issuer");
      if (!res.ok) throw new Error("issuer_api_error");
      const json = await res.json();
      if (!json.ok || !json.issuer) {
        throw new Error(json.error || "issuer_load_failed");
      }
      setIssuer(json.issuer as Issuer);
    } catch (e) {
      console.error(e);
      setIssuerError("회사 정보 로딩 중 오류가 발생했습니다.");
      // 오류나도 DEFAULT_ISSUER 로 최소한 동작은 하게 둔다.
    } finally {
      setIssuerLoading(false);
    }
  };

  const loadList = async (nextPage?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage ?? page));
      params.set("size", String(size));
      if (filterMonth) params.set("yearMonth", filterMonth);
      if (filterOwnerName) params.set("ownerName", filterOwnerName);
      if (filterStatus !== "ALL") params.set("status", filterStatus);

      const res = await fetch(`/api/admin/tax-invoices?${params.toString()}`);
      const json: ResList = await res.json();
      if (!json.ok) {
        setError(json.error || "목록을 불러오지 못했습니다.");
        setRows([]);
        setTotal(0);
      } else {
        setRows(json.rows || []);
        setTotal(json.total || 0);
        setPage(json.page || 1);
        setSize(json.size || size);
      }
    } catch (e) {
      console.error(e);
      setError("서버 통신 중 오류가 발생했습니다.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // 최초 정산월 기본값 설정
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    setFilterMonth(ym);
  }, []);

  // 회사 정보/목록 로딩
  useEffect(() => {
    loadIssuer();
  }, []);

  useEffect(() => {
    if (filterMonth) {
      loadList(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterOwnerName, filterStatus]);

  const openCreateModal = () => {
    setFormMode("create");
    setForm({
      ...emptyForm,
      yearMonth: filterMonth || "",
      companyId: String(issuer.id || 1),
    });
    setSaveError(null);
    setShowModal(true);
  };

  const openEditModal = (row: Row) => {
    setFormMode("edit");
    setForm({
      id: row.id,
      ownerId: String(row.owner.id),
      companyId: String(row.company.id || issuer.id || 1),
      issueDate: toDateInputValue(row.issueDate),
      supplyDate: toDateInputValue(row.supplyDate),
      yearMonth: row.yearMonth || "",
      title: row.title || "",
      qty: String(row.qty ?? 1),
      unitPrice: String(row.unitPrice ?? 0),
      supplyValue: String(row.supplyValue ?? 0),
      vat: String(row.vat ?? 0),
      total: String(row.total ?? 0),
      roomInfo: row.roomInfo || row.owner.roomInfo || "",
      memo: row.memo || "",
      status: row.status || "PENDING",
    });
    setSaveError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const onFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value as any }));
  };

  const autoCalcAmounts = () => {
    const qtyNum = Number(form.qty || 0);
    const unitPriceNum = Number(form.unitPrice || 0);
    const supplyValueNum = qtyNum * unitPriceNum;
    const vatNum = Math.round(supplyValueNum * 0.1);
    const totalNum = supplyValueNum + vatNum;
    setForm((prev) => ({
      ...prev,
      supplyValue: supplyValueNum ? String(supplyValueNum) : "",
      vat: vatNum ? String(vatNum) : "",
      total: totalNum ? String(totalNum) : "",
    }));
  };

  const saveForm = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        ownerId: form.ownerId ? Number(form.ownerId) : undefined,
        // 회사는 항상 issuer.id 로 전송
        companyId: issuer.id || 1,
        issueDate: form.issueDate || undefined,
        supplyDate: form.supplyDate || undefined,
        yearMonth: form.yearMonth || undefined,
        title: form.title || undefined,
        qty: form.qty ? Number(form.qty) : undefined,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
        supplyValue: form.supplyValue ? Number(form.supplyValue) : undefined,
        vat: form.vat ? Number(form.vat) : undefined,
        total: form.total ? Number(form.total) : undefined,
        roomInfo: form.roomInfo || undefined,
        memo: form.memo || undefined,
        status: form.status || undefined,
      };

      let res: Response;
      if (formMode === "create") {
        res = await fetch("/api/admin/tax-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.id = form.id;
        res = await fetch("/api/admin/tax-invoices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!json.ok) {
        setSaveError(json.error || "저장 중 오류가 발생했습니다.");
        return;
      }

      setShowModal(false);
      await loadList(1);
    } catch (e) {
      console.error(e);
      setSaveError("저장 중 서버 통신 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const changePage = (nextPage: number) => {
    const p = Math.min(Math.max(1, nextPage), totalPages);
    loadList(p);
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      alert("업로드할 엑셀 파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);

      const res = await fetch("/api/admin/tax-invoices/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setUploadMessage(
          "업로드 실패: " + (json.error || "서버 오류가 발생했습니다.")
        );
      } else {
        const msg =
          `생성 ${json.created ?? 0}건, 수정 ${json.updated ?? 0}건` +
          (json.errors && json.errors.length
            ? `, 오류 ${json.errors.length}건`
            : "");
        setUploadMessage(msg);
        await loadList(1);
      }
    } catch (e) {
      console.error(e);
      setUploadMessage("업로드 중 서버 통신 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  // 회사정보 수정 모달 열기
  const openIssuerModal = () => {
    setIssuerForm(issuer);
    setIssuerSaveError(null);
    setShowIssuerModal(true);
  };

  const closeIssuerModal = () => {
    if (savingIssuer) return;
    setShowIssuerModal(false);
  };

  const onIssuerFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setIssuerForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveIssuer = async () => {
    setSavingIssuer(true);
    setIssuerSaveError(null);
    try {
      const res = await fetch("/api/admin/company/issuer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issuerForm),
      });
      const json = await res.json();
      if (!json.ok) {
        setIssuerSaveError(json.error || "회사 정보 저장 중 오류가 발생했습니다.");
        return;
      }
      setIssuer(json.issuer as Issuer);
      setShowIssuerModal(false);
    } catch (e) {
      console.error(e);
      setIssuerSaveError("회사 정보 저장 중 서버 통신 오류가 발생했습니다.");
    } finally {
      setSavingIssuer(false);
    }
  };

  return (
    <div className="page-root">
      <div className="page-inner">
        <div className="page-header">
          <h1 className="page-title">역발행 세금계산서 관리</h1>
          <div className="page-header-right">
            {issuerLoading && (
              <span className="issuer-badge">회사 정보 로딩 중...</span>
            )}
            {issuerError && (
              <span className="issuer-badge error">{issuerError}</span>
            )}
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">정산월</label>
            <input
              type="month"
              className="filter-input"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">구분소유자</label>
            <input
              type="text"
              className="filter-input"
              placeholder="소유자 상호/성명"
              value={filterOwnerName}
              onChange={(e) => setFilterOwnerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadList(1);
              }}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">상태</label>
            <select
              className="filter-input"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as "ALL" | InvoiceStatus)
              }
            >
              <option value="ALL">전체</option>
              <option value="PENDING">입금대기</option>
              <option value="REQUESTED">입금요청</option>
              <option value="ISSUED">발행완료</option>
              <option value="CANCELED">취소</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn secondary" onClick={() => loadList(1)}>
              새로고침
            </button>
            <button className="btn primary" onClick={openCreateModal}>
              새 세금계산서
            </button>
          </div>
        </div>

        {/* 엑셀 업로드 영역 */}
        <div className="upload-bar">
          <div className="upload-left">
            <label className="upload-label">엑셀 업로드 (역발행 세금계산서)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="upload-right">
            <div className="upload-actions">
              <button
                className="btn primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "업로드 중..." : "엑셀 업로드 실행"}
              </button>
            </div>
            {uploadMessage && (
              <div className="upload-message">{uploadMessage}</div>
            )}
            <div className="upload-help">
              <div>
                첫 행은 헤더(열 제목)로 사용됩니다. 기본 컬럼:
                <br />
                <b>
                  ownerId, companyId, yearMonth, issueDate, supplyDate, title,
                  qty, unitPrice, supplyValue, vat, total, roomInfo, memo,
                  status
                </b>
              </div>
              <ul>
                <li>ownerId: UnitOwner ID</li>
                <li>
                  companyId: Company ID (현재 시스템에서는{" "}
                  <b>
                    {issuer.id} = {issuer.name}
                  </b>{" "}
                  로 사용)
                </li>
                <li>yearMonth: 2025-11 형식</li>
                <li>issueDate, supplyDate: YYYY-MM-DD 형식</li>
                <li>status: PENDING / REQUESTED / ISSUED / CANCELED</li>
              </ul>
              <div className="upload-example">
                아래 내용을 통째로 복사해서 엑셀에 붙여넣으면 예시 1행이
                생성됩니다.
                <textarea
                  readOnly
                  value={exampleExcelText}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 오류/로딩 표시 */}
        {error && <div className="alert error">{error}</div>}
        {loading && (
          <div className="alert info">목록을 불러오는 중입니다...</div>
        )}

        {/* 목록 테이블 */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>ID</th>
                <th style={{ width: "100px" }}>작성일</th>
                <th style={{ width: "90px" }}>정산월</th>
                <th>공급자(구분소유자)</th>
                <th>공급받는자</th>
                <th style={{ width: "120px" }}>공급가액</th>
                <th style={{ width: "90px" }}>세액</th>
                <th style={{ width: "120px" }}>합계금액</th>
                <th style={{ width: "90px" }}>상태</th>
                <th style={{ width: "150px" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: "center", padding: "20px 0" }}
                  >
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{formatDateShort(row.issueDate)}</td>
                  <td>{row.yearMonth || ""}</td>
                  <td>
                    <div className="cell-main">
                      [{row.owner.roomInfo || "-"}] {row.owner.name}
                    </div>
                    <div className="cell-sub">
                      {row.owner.bizNo && <>사업자: {row.owner.bizNo} / </>}
                      {ownerStatusLabel(row.owner.status)}
                    </div>
                  </td>
                  <td>
                    <div className="cell-main">{row.company.name}</div>
                    <div className="cell-sub">{row.company.bizNo}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatNumber(row.supplyValue)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatNumber(row.vat)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatNumber(row.total)}
                  </td>
                  <td>
                    <span className={`status-badge status-${row.status}`}>
                      {invoiceStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn tiny"
                        onClick={() => openEditModal(row)}
                      >
                        수정
                      </button>
                      <a
                        className="btn tiny outline"
                        href={`/admin/tax-invoices/${row.id}/print`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        인쇄
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="pagination-bar">
          <button
            className="btn tiny"
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
          >
            이전
          </button>
          <span className="page-info">
            {page} / {totalPages} (총 {total.toLocaleString("ko-KR")}건)
          </span>
          <button
            className="btn tiny"
            disabled={page >= totalPages}
            onClick={() => changePage(page + 1)}
          >
            다음
          </button>
        </div>

        {/* 세금계산서 작성/수정 모달 */}
        {showModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  {formMode === "create" ? "세금계산서 생성" : "세금계산서 수정"}
                </h2>
              </div>
              <div className="modal-body">
                {saveError && <div className="alert error">{saveError}</div>}

                {/* 고정 회사 정보 블록 */}
                <div className="issuer-box">
                  <div className="issuer-header">
                    <div className="issuer-title">공급받는자 (고정)</div>
                    <button
                      type="button"
                      className="btn tiny outline"
                      onClick={openIssuerModal}
                    >
                      회사정보 수정
                    </button>
                  </div>
                  <div className="issuer-cols">
                    <div className="issuer-col">
                      <div className="issuer-row">
                        <span>상호</span>
                        <strong>{issuer.name}</strong>
                      </div>
                      <div className="issuer-row">
                        <span>사업자번호</span>
                        <strong>{issuer.bizNo}</strong>
                      </div>
                      <div className="issuer-row">
                        <span>대표자</span>
                        <span>{issuer.ceoName}</span>
                      </div>
                    </div>
                    <div className="issuer-col">
                      <div className="issuer-row">
                        <span>주소</span>
                        <span>{issuer.address}</span>
                      </div>
                      <div className="issuer-row">
                        <span>연락처</span>
                        <span>{issuer.phone}</span>
                      </div>
                      <div className="issuer-row">
                        <span>이메일</span>
                        <span>{issuer.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-grid">
                  {formMode === "edit" && (
                    <div className="form-row">
                      <label>ID</label>
                      <input type="text" value={form.id} disabled />
                    </div>
                  )}

                  <div className="form-row">
                    <label>공급자(구분소유자) ID</label>
                    <input
                      type="number"
                      name="ownerId"
                      value={form.ownerId}
                      onChange={onFormChange}
                      placeholder="UnitOwner ID (숫자)"
                    />
                  </div>

                  {/* companyId는 숨긴 필드 (디버깅용) */}
                  <input
                    type="hidden"
                    name="companyId"
                    value={String(issuer.id || 1)}
                    readOnly
                  />

                  <div className="form-row">
                    <label>정산월 (YYYY-MM)</label>
                    <input
                      type="month"
                      name="yearMonth"
                      value={form.yearMonth}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>작성일자</label>
                    <input
                      type="date"
                      name="issueDate"
                      value={form.issueDate}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>공급시기</label>
                    <input
                      type="date"
                      name="supplyDate"
                      value={form.supplyDate}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>품목</label>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={onFormChange}
                      placeholder="예: 위탁운영수수료"
                    />
                  </div>

                  <div className="form-row">
                    <label>수량</label>
                    <input
                      type="number"
                      name="qty"
                      value={form.qty}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>단가</label>
                    <input
                      type="number"
                      name="unitPrice"
                      value={form.unitPrice}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>공급가액</label>
                    <input
                      type="number"
                      name="supplyValue"
                      value={form.supplyValue}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>세액</label>
                    <input
                      type="number"
                      name="vat"
                      value={form.vat}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>합계금액</label>
                    <input
                      type="number"
                      name="total"
                      value={form.total}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>객실/비고(상단 표기)</label>
                    <input
                      type="text"
                      name="roomInfo"
                      value={form.roomInfo}
                      onChange={onFormChange}
                      placeholder="예: 1203호, 계약번호 등"
                    />
                  </div>

                  <div className="form-row">
                    <label>비고(하단)</label>
                    <textarea
                      name="memo"
                      value={form.memo}
                      onChange={onFormChange}
                      rows={2}
                    />
                  </div>

                  <div className="form-row">
                    <label>상태</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={onFormChange}
                    >
                      <option value="PENDING">입금대기</option>
                      <option value="REQUESTED">입금요청</option>
                      <option value="ISSUED">발행완료</option>
                      <option value="CANCELED">취소</option>
                    </select>
                  </div>
                </div>

                <div className="form-help">
                  * 공급가액/세액/합계는 수량·단가 입력 후{" "}
                  <button
                    type="button"
                    className="btn tiny inline"
                    onClick={autoCalcAmounts}
                  >
                    자동 계산
                  </button>{" "}
                  버튼으로 10% 부가세 기준 자동 계산할 수 있습니다.
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn" onClick={closeModal} disabled={saving}>
                  닫기
                </button>
                <button
                  className="btn primary"
                  onClick={saveForm}
                  disabled={saving}
                >
                  {saving
                    ? "저장 중..."
                    : formMode === "create"
                    ? "생성"
                    : "수정 저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 회사(공급받는자) 정보 수정 모달 */}
        {showIssuerModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">회사 정보 수정 (공급받는자)</h2>
              </div>
              <div className="modal-body">
                {issuerSaveError && (
                  <div className="alert error">{issuerSaveError}</div>
                )}

                <div className="form-grid">
                  <div className="form-row">
                    <label>상호</label>
                    <input
                      name="name"
                      value={issuerForm.name}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>사업자등록번호</label>
                    <input
                      name="bizNo"
                      value={issuerForm.bizNo}
                      onChange={onIssuerFormChange}
                      placeholder="예: 267-85-03121"
                    />
                  </div>
                  <div className="form-row">
                    <label>대표자</label>
                    <input
                      name="ceoName"
                      value={issuerForm.ceoName}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>연락처</label>
                    <input
                      name="phone"
                      value={issuerForm.phone}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                    <label>주소</label>
                    <input
                      name="address"
                      value={issuerForm.address}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>이메일</label>
                    <input
                      name="email"
                      value={issuerForm.email}
                      onChange={onIssuerFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>입금은행</label>
                    <input
                      name="bankName"
                      value={issuerForm.bankName}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>계좌번호</label>
                    <input
                      name="bankAccount"
                      value={issuerForm.bankAccount}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                  <div className="form-row">
                    <label>예금주</label>
                    <input
                      name="bankOwner"
                      value={issuerForm.bankOwner}
                      onChange={onIssuerFormChange}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn"
                  onClick={closeIssuerModal}
                  disabled={savingIssuer}
                >
                  닫기
                </button>
                <button
                  className="btn primary"
                  onClick={saveIssuer}
                  disabled={savingIssuer}
                >
                  {savingIssuer ? "저장 중..." : "회사정보 저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 스타일 */}
        <style jsx>{`
          .page-root {
            padding: 24px;
            background: #f3f4f6;
            min-height: 100vh;
          }
          .page-inner {
            max-width: 1120px;
            margin: 0 auto;
          }
          .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
          }
          .page-title {
            font-size: 20px;
            font-weight: 700;
          }
          .page-header-right {
            display: flex;
            gap: 6px;
            align-items: center;
          }
          .issuer-badge {
            font-size: 11px;
            padding: 3px 6px;
            border-radius: 999px;
            background: #e5e7eb;
            color: #374151;
          }
          .issuer-badge.error {
            background: #fee2e2;
            color: #b91c1c;
          }

          .filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
            margin-bottom: 10px;
          }
          .filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .filter-label {
            font-size: 12px;
            color: #4b5563;
          }
          .filter-input {
            min-width: 140px;
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            font-size: 13px;
          }
          .filter-actions {
            margin-left: auto;
            display: flex;
            gap: 8px;
          }

          .upload-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 16px;
            padding: 8px 10px;
            border-radius: 6px;
            background: #e5e7eb;
          }
          .upload-left {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .upload-label {
            font-size: 12px;
            color: #4b5563;
          }
          .upload-right {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-left: auto;
            flex: 1 1 260px;
          }
          .upload-actions {
            display: flex;
            gap: 8px;
            margin-bottom: 4px;
          }
          .upload-message {
            font-size: 12px;
            color: #065f46;
          }
          .upload-help {
            font-size: 11px;
            color: #4b5563;
          }
          .upload-help ul {
            margin: 4px 0 6px;
            padding-left: 16px;
          }
          .upload-help li {
            list-style: disc;
          }
          .upload-example textarea {
            width: 100%;
            margin-top: 4px;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
              "Liberation Mono", "Courier New", monospace;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            background: #f9fafb;
            resize: vertical;
            min-height: 60px;
          }

          .alert {
            margin-top: 8px;
            margin-bottom: 12px;
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 13px;
          }
          .alert.error {
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #b91c1c;
          }
          .alert.info {
            background: #e0f2fe;
            border: 1px solid #bae6fd;
            color: #1d4ed8;
          }

          .table-wrap {
            background: #ffffff;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            overflow: hidden;
            margin-top: 8px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .table thead {
            background: #f9fafb;
          }
          .table th,
          .table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 6px 8px;
            text-align: left;
            vertical-align: middle;
          }
          .table th {
            font-weight: 600;
            color: #374151;
          }
          .table tbody tr:nth-child(even) {
            background: #f9fafb;
          }

          .cell-main {
            font-weight: 500;
          }
          .cell-sub {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
          }

          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 999px;
            font-size: 11px;
          }
          .status-PENDING {
            background: #fef3c7;
            color: #92400e;
          }
          .status-REQUESTED {
            background: #e0f2fe;
            color: #1d4ed8;
          }
          .status-ISSUED {
            background: #dcfce7;
            color: #166534;
          }
          .status-CANCELED {
            background: #fee2e2;
            color: #b91c1c;
          }

          .action-buttons {
            display: flex;
            gap: 4px;
          }

          .btn {
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            background: #f9fafb;
            font-size: 12px;
            cursor: pointer;
          }
          .btn.primary {
            background: #2563eb;
            border-color: #2563eb;
            color: #f9fafb;
          }
          .btn.secondary {
            background: #e5e7eb;
          }
          .btn.tiny {
            padding: 3px 8px;
            font-size: 11px;
          }
          .btn.outline {
            background: #ffffff;
          }
          .btn.inline {
            display: inline-block;
            margin-left: 4px;
          }
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .pagination-bar {
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          .page-info {
            font-size: 13px;
            color: #4b5563;
          }

          .modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
          }
          .modal {
            width: 720px;
            max-height: 90vh;
            background: #ffffff;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .modal-header {
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }
          .modal-title {
            font-size: 15px;
            font-weight: 600;
          }
          .modal-body {
            padding: 12px 14px;
            overflow-y: auto;
          }
          .modal-footer {
            padding: 10px 14px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }

          .issuer-box {
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            padding: 8px 10px;
            margin-bottom: 10px;
            background: #f9fafb;
          }
          .issuer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          }
          .issuer-title {
            font-size: 12px;
            font-weight: 600;
          }
          .issuer-cols {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .issuer-col {
            flex: 1 1 200px;
          }
          .issuer-row {
            display: flex;
            gap: 6px;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .issuer-row span:first-child {
            min-width: 70px;
            color: #6b7280;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 12px;
          }
          .form-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .form-row label {
            font-size: 12px;
            color: #4b5563;
          }
          .form-row input,
          .form-row select,
          .form-row textarea {
            padding: 5px 7px;
            border-radius: 4px;
            border: 1px solid #d1d5db;
            font-size: 12px;
          }
          .form-row textarea {
            resize: vertical;
          }

          .form-help {
            margin-top: 8px;
            font-size: 11px;
            color: #6b7280;
          }

          @media (max-width: 768px) {
            .page-inner {
              max-width: 100%;
            }
            .form-grid {
              grid-template-columns: 1fr;
            }
            .modal {
              width: 95vw;
            }
            .upload-bar {
              flex-direction: column;
            }
            .upload-right {
              margin-left: 0;
              width: 100%;
            }
            .issuer-cols {
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    </div>
  );
}