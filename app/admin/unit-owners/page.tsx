// src/app/admin/unit-owners/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";

/** DB enum과 동일하게 맞추기 */
type OwnerType = "INDIVIDUAL" | "CORPORATION" | null;
/** DB enum: PENDING_PAYMENT / PAID / TERMINATED */
type OwnerStatus = "PENDING_PAYMENT" | "PAID" | "TERMINATED";

type UnitOwnerRow = {
  id: number;
  name: string;
  bizNo: string | null;
  ceoName: string | null;
  address: string | null;
  bizType: string | null;
  bizItem: string | null;
  phone: string | null;
  email: string | null;
  roomInfo: string | null;
  ownerType: OwnerType;
  status: OwnerStatus;
  registryNo: string | null;
  contractNo: string | null;
  bankName: string | null;
  bankAccount: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResp = {
  ok: boolean;
  rows: UnitOwnerRow[];
  total: number;
  page: number;
  size: number;
  error?: string;
};

type FormMode = "create" | "edit";

type FormState = {
  id?: number;
  name: string;
  bizNo: string;
  ceoName: string;
  address: string;
  bizType: string;
  bizItem: string;
  phone: string;
  email: string;
  roomInfo: string;
  ownerType: OwnerType;
  status: OwnerStatus;
  registryNo: string;
  contractNo: string;
  bankName: string;
  bankAccount: string;
  memo: string;
};

/** 폼 기본값 */
const emptyForm: FormState = {
  name: "",
  bizNo: "",
  ceoName: "",
  address: "",
  bizType: "",
  bizItem: "",
  phone: "",
  email: "",
  roomInfo: "",
  ownerType: null,
  status: "PENDING_PAYMENT", // 기본값: 계약대기
  registryNo: "",
  contractNo: "",
  bankName: "",
  bankAccount: "",
  memo: "",
};

function formatDateTime(s: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function ownerTypeLabel(v: OwnerType) {
  if (v === "INDIVIDUAL") return "개인";
  if (v === "CORPORATION") return "법인";
  return "-";
}

/** 화면에 보여줄 상태 라벨 (DB 값 → 한글) */
function ownerStatusLabel(v: OwnerStatus) {
  if (v === "PENDING_PAYMENT") return "계약대기";
  if (v === "PAID") return "계약완료";
  if (v === "TERMINATED") return "계약해지";
  return v;
}

export default function UnitOwnersPage() {
  const [rows, setRows] = useState<UnitOwnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | OwnerStatus>("ALL");
  const [filterOwnerType, setFilterOwnerType] = useState<
    "ALL" | "INDIVIDUAL" | "CORPORATION"
  >("ALL");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UnitOwnerRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 엑셀 업로드 상태
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / size)),
    [total, size]
  );

  /** 목록 로드 */
  const loadList = async (nextPage?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage ?? page));
      params.set("size", String(size));
      if (keyword) params.set("q", keyword);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterOwnerType !== "ALL") params.set("ownerType", filterOwnerType);

      const res = await fetch(`/api/admin/unit-owners?${params.toString()}`);
      const json: ListResp = await res.json();
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

  useEffect(() => {
    loadList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterOwnerType]);

  /** 페이지 이동 */
  const changePage = (p: number) => {
    const np = Math.min(Math.max(1, p), totalPages);
    loadList(np);
  };

  /** 생성 모달 열기 */
  const openCreateModal = () => {
    setFormMode("create");
    setForm(emptyForm);
    setSaveError(null);
    setShowModal(true);
  };

  /** 수정 모달 열기 */
  const openEditModal = (row: UnitOwnerRow) => {
    setFormMode("edit");
    setForm({
      id: row.id,
      name: row.name || "",
      bizNo: row.bizNo || "",
      ceoName: row.ceoName || "",
      address: row.address || "",
      bizType: row.bizType || "",
      bizItem: row.bizItem || "",
      phone: row.phone || "",
      email: row.email || "",
      roomInfo: row.roomInfo || "",
      ownerType: row.ownerType || null,
      status: row.status,
      registryNo: row.registryNo || "",
      contractNo: row.contractNo || "",
      bankName: row.bankName || "",
      bankAccount: row.bankAccount || "",
      memo: row.memo || "",
    });
    setSaveError(null);
    setShowModal(true);
  };

  /** 모달 닫기 */
  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  /** 폼 입력 변경 */
  const onFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "ownerType"
          ? ((value || null) as OwnerType)
          : name === "status"
          ? (value as OwnerStatus)
          : value,
    }));
  };

  /** 저장 */
  const saveForm = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        name: form.name,
        bizNo: form.bizNo || null,
        ceoName: form.ceoName || null,
        address: form.address || null,
        bizType: form.bizType || null,
        bizItem: form.bizItem || null,
        phone: form.phone || null,
        email: form.email || null,
        roomInfo: form.roomInfo || null,
        ownerType: form.ownerType || null,
        status: form.status || "PENDING_PAYMENT",
        registryNo: form.registryNo || null,
        contractNo: form.contractNo || null,
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        memo: form.memo || null,
      };

      let res: Response;
      if (formMode === "create") {
        res = await fetch("/api/admin/unit-owners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.id = form.id;
        res = await fetch("/api/admin/unit-owners", {
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
      setSaveError("저장 중 서버 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  /** 삭제 */
  const confirmDelete = (row: UnitOwnerRow) => {
    setDeleteTarget(row);
    setDeleteError(null);
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/unit-owners?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) {
        setDeleteError(json.error || "삭제 중 오류가 발생했습니다.");
        return;
      }
      setDeleteTarget(null);
      await loadList(1);
    } catch (e) {
      console.error(e);
      setDeleteError("삭제 중 서버 통신 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  /** 엑셀 업로드 */
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

      const res = await fetch("/api/admin/unit-owners/upload", {
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
          `생성 ${json.created ?? 0}건 / 수정 ${json.updated ?? 0}건` +
          (json.errors?.length ? ` / 오류 ${json.errors.length}건` : "");
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

  return (
    <div className="page-root">
      <div className="page-inner">
        <h1 className="page-title">구분소유자 관리</h1>

        {/* 필터 바 */}
        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">검색어</label>
            <input
              type="text"
              className="filter-input"
              placeholder="이름, 사업자번호, 호실, 연락처, 계약번호"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadList(1);
              }}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">구분</label>
            <select
              className="filter-input"
              value={filterOwnerType}
              onChange={(e) =>
                setFilterOwnerType(
                  e.target.value as "ALL" | "INDIVIDUAL" | "CORPORATION"
                )
              }
            >
              <option value="ALL">전체</option>
              <option value="INDIVIDUAL">개인</option>
              <option value="CORPORATION">법인</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">상태</label>
            <select
              className="filter-input"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as "ALL" | OwnerStatus)
              }
            >
              <option value="ALL">전체</option>
              <option value="PENDING_PAYMENT">계약대기</option>
              <option value="PAID">계약완료</option>
              <option value="TERMINATED">계약해지</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn secondary" onClick={() => loadList(1)}>
              검색
            </button>
            <button className="btn primary" onClick={openCreateModal}>
              새 구분소유자
            </button>
          </div>
        </div>

        {/* 엑셀 업로드 바 */}
        <div className="upload-bar">
          <div className="upload-left">
            <label className="upload-label">엑셀 업로드</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="upload-right">
            <button
              className="btn primary"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "업로드 중..." : "엑셀 업로드 실행"}
            </button>
            {uploadMessage && (
              <div className="upload-message">{uploadMessage}</div>
            )}
            <div className="upload-help">
  화면 컬럼에 맞춘 예시 헤더 (첫 행):
  <br />
  <b>
    id    roomInfo    name    bizNo    ownerType    status    phone    email    contractNo    registryNo    bankName    bankAccount    memo
  </b>
  <br />
  ownerType: <b>INDIVIDUAL</b> 또는 <b>CORPORATION</b>
  <br />
  status: <b>PENDING_PAYMENT</b>(계약대기) / <b>PAID</b>(계약완료) / <b>TERMINATED</b>(계약해지)
  <br />
  <br />
  예시 데이터 (엑셀에서 그대로 붙여넣기용, 탭 구분):

  <textarea
    readOnly
    style={{
      fontSize: 11,
      background: "#f3f4f6",
      padding: 6,
      borderRadius: 4,
      width: "100%",
      height: "120px",
      whiteSpace: "pre",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    }}
    onFocus={(e) => e.currentTarget.select()}
  >{`id	roomInfo	name	bizNo	ownerType	status	phone	email	contractNo	registryNo	bankName	bankAccount	memo
	1203호	홍길동	123-45-67890	INDIVIDUAL	PAID	010-1111-2222	test1@example.com	MT-2025-001	RG-2025-001	국민은행	123456-01-000001	1차 계약완료
	901호	ABC주식회사	111-22-33333	CORPORATION	PENDING_PAYMENT	02-555-7777	info@abc.co.kr	MT-2025-010		신한은행	110-222-333333	법인 신규 계약대기`}</textarea>

  <br />
  id가 비어 있으면 신규 생성, id가 있으면 해당 id를 기준으로 수정 처리.
</div>
          </div>
        </div>

        {/* 오류/로딩 */}
        {error && <div className="alert error">{error}</div>}
        {loading && <div className="alert info">목록을 불러오는 중입니다...</div>}

        {/* 목록 테이블 */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>ID</th>
                <th style={{ width: "80px" }}>호실</th>
                <th>상호/성명</th>
                <th style={{ width: "130px" }}>사업자번호</th>
                <th style={{ width: "80px" }}>구분</th>
                <th style={{ width: "90px" }}>상태</th>
                <th style={{ width: "150px" }}>연락처</th>
                <th>계약/등기</th>
                <th>계좌</th>
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
                  <td>{row.roomInfo || ""}</td>
                  <td>
                    <div className="cell-main">{row.name}</div>
                    {row.ceoName && (
                      <div className="cell-sub">대표자: {row.ceoName}</div>
                    )}
                  </td>
                  <td>{row.bizNo || ""}</td>
                  <td>{ownerTypeLabel(row.ownerType)}</td>
                  <td>
                    <span className={`status-badge status-${row.status}`}>
                      {ownerStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    <div className="cell-main">{row.phone || ""}</div>
                    <div className="cell-sub">{row.email || ""}</div>
                  </td>
                  <td>
                    <div className="cell-main">
                      {row.contractNo && <>계약: {row.contractNo}</>}
                    </div>
                    <div className="cell-sub">
                      {row.registryNo && <>등기: {row.registryNo}</>}
                    </div>
                  </td>
                  <td>
                    <div className="cell-main">{row.bankName || ""}</div>
                    <div className="cell-sub">{row.bankAccount || ""}</div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn tiny"
                        onClick={() => openEditModal(row)}
                      >
                        수정
                      </button>
                      <button
                        className="btn tiny outline"
                        onClick={() => confirmDelete(row)}
                      >
                        삭제
                      </button>
                    </div>
                    <div className="cell-sub">
                      등록: {formatDateTime(row.createdAt)}
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

        {/* 생성/수정 모달 */}
        {showModal && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <h2 className="modal-title">
                  {formMode === "create" ? "구분소유자 등록" : "구분소유자 수정"}
                </h2>
              </div>
              <div className="modal-body">
                {saveError && <div className="alert error">{saveError}</div>}

                <div className="form-grid">
                  {formMode === "edit" && (
                    <div className="form-row">
                      <label>ID</label>
                      <input type="text" value={form.id} disabled />
                    </div>
                  )}

                  <div className="form-row">
                    <label>상호/성명</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>호실/객실 정보</label>
                    <input
                      name="roomInfo"
                      value={form.roomInfo}
                      onChange={onFormChange}
                      placeholder="예: 1203호"
                    />
                  </div>

                  <div className="form-row">
                    <label>구분</label>
                    <select
                      name="ownerType"
                      value={form.ownerType || ""}
                      onChange={onFormChange}
                    >
                      <option value="">선택</option>
                      <option value="INDIVIDUAL">개인</option>
                      <option value="CORPORATION">법인</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>상태</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={onFormChange}
                    >
                      <option value="PENDING_PAYMENT">계약대기</option>
                      <option value="PAID">계약완료</option>
                      <option value="TERMINATED">계약해지</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>사업자등록번호</label>
                    <input
                      name="bizNo"
                      value={form.bizNo}
                      onChange={onFormChange}
                      placeholder="예: 123-45-67890"
                    />
                  </div>

                  <div className="form-row">
                    <label>대표자</label>
                    <input
                      name="ceoName"
                      value={form.ceoName}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>주소</label>
                    <input
                      name="address"
                      value={form.address}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>업태</label>
                    <input
                      name="bizType"
                      value={form.bizType}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>종목</label>
                    <input
                      name="bizItem"
                      value={form.bizItem}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>연락처</label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={onFormChange}
                      placeholder="예: 010-0000-0000"
                    />
                  </div>

                  <div className="form-row">
                    <label>이메일</label>
                    <input
                      name="email"
                      value={form.email}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>계약번호</label>
                    <input
                      name="contractNo"
                      value={form.contractNo}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>등기번호</label>
                    <input
                      name="registryNo"
                      value={form.registryNo}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>은행명</label>
                    <input
                      name="bankName"
                      value={form.bankName}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row">
                    <label>계좌번호</label>
                    <input
                      name="bankAccount"
                      value={form.bankAccount}
                      onChange={onFormChange}
                    />
                  </div>

                  <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                    <label>메모</label>
                    <textarea
                      name="memo"
                      value={form.memo}
                      onChange={onFormChange}
                      rows={3}
                    />
                  </div>
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
                    ? "등록"
                    : "수정 저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 삭제 확인 모달 */}
        {deleteTarget && (
          <div className="modal-backdrop">
            <div className="modal small">
              <div className="modal-header">
                <h2 className="modal-title">삭제 확인</h2>
              </div>
              <div className="modal-body">
                {deleteError && <div className="alert error">{deleteError}</div>}
                <p>
                  아래 구분소유자를 삭제하시겠습니까?
                  <br />
                  <b>
                    [{deleteTarget.roomInfo || "-"}] {deleteTarget.name} (ID:{" "}
                    {deleteTarget.id})
                  </b>
                </p>
                <p style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                  관련 세금계산서(ReverseTaxInvoice)가 있는 경우 Prisma 레벨에서
                  제약 오류가 날 수 있습니다. 그런 경우 먼저 세금계산서 데이터를
                  정리한 뒤 삭제하세요.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  className="btn primary"
                  onClick={doDelete}
                  disabled={deleting}
                >
                  {deleting ? "삭제 중..." : "삭제"}
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
            max-width: 1200px;
            margin: 0 auto;
          }
          .page-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 16px;
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
            min-width: 160px;
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
            min-width: 260px;
          }
          .upload-message {
            font-size: 12px;
            color: #065f46;
          }
          .upload-help {
            font-size: 11px;
            color: #4b5563;
          }

          .alert {
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
          .status-PENDING_PAYMENT {
            background: #fef3c7;
            color: #92400e;
          }
          .status-PAID {
            background: #dcfce7;
            color: #166534;
          }
          .status-TERMINATED {
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
            width: 840px;
            max-height: 90vh;
            background: #ffffff;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .modal.small {
            width: 420px;
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

          @media (max-width: 900px) {
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
              align-items: flex-start;
            }
            .upload-right {
              margin-left: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}