// app/admin/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPhoneAuto } from "@/src/utils/format";
import UploadModal from "./UploadModal";

/* -------------------- utils -------------------- */
async function fetchJSON<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const r = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const t = await r.text();
      if (t) msg += ` - ${t}`;
    } catch {}
    throw new Error(msg);
  }
  try {
    return (await r.json()) as T;
  } catch {
    return {} as T;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtHm = (v?: string) => (v ? v : "—");

/* ====== overlap utils ====== */
type OverlapSource = {
  id: number;
  roomId: number | null;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
};

const toDate = (d: string, t?: string) => new Date(`${d}T${t ?? "00:00"}:00`);
const isOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

/** 현재 편집/신규 구간과 겹치는 row의 roomId 집합 */
function conflictRoomIdsByOverlap(
  rows: OverlapSource[],
  startDate: string, startTime?: string,
  endDate?: string,   endTime?: string,
  selfId?: number
): Set<number> {
  const blocked = new Set<number>();
  if (!startDate || !endDate) return blocked;

  const Astart = toDate(startDate, startTime ?? "00:00");
  const Aend   = toDate(endDate,   endTime   ?? "23:59");

  for (const r of rows) {
    if (!r.roomId || (selfId && r.id === selfId)) continue;
    const Bstart = toDate(r.startDate, r.startTime ?? "15:00");
    const Bend   = toDate(r.endDate,   r.endTime   ?? "11:00");
    if (isOverlap(Astart, Aend, Bstart, Bend)) blocked.add(r.roomId);
  }
  return blocked;
}

/** 저장 전에 같은 호실/시간 겹침 확인 */
function willOverlapWithExisting(
  rows: OverlapSource[],
  roomId: number | null,
  startDate: string, startTime?: string,
  endDate?: string,   endTime?: string,
  selfId?: number
) {
  if (!roomId || !startDate || !endDate) return false;
  const Astart = toDate(startDate, startTime ?? "00:00");
  const Aend   = toDate(endDate,   endTime   ?? "23:59");
  return rows.some(r => {
    if (!r.roomId || r.roomId !== roomId) return false;
    if (selfId && r.id === selfId) return false;
    const Bstart = toDate(r.startDate, r.startTime ?? "15:00");
    const Bend   = toDate(r.endDate,   r.endTime   ?? "11:00");
    return isOverlap(Astart, Aend, Bstart, Bend);
  });
}

/* -------------------- 24h 타임 필드 -------------------- */
function TimeField(props: {
  value?: string;
  onChange: (v: string) => void;
  minuteStep?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const { value = "00:00", onChange, minuteStep = 5, disabled, style } = props;
  const [h, m] = value.split(":");
  const hour = Math.min(23, Math.max(0, parseInt(h || "0", 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m || "0", 10)));
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  return (
    <div style={{ display: "flex", gap: 6, ...style }}>
      <select
        className="input"
        disabled={disabled}
        value={String(hour).padStart(2, "0")}
        onChange={(e) => onChange(`${e.target.value}:${String(minute).padStart(2, "0")}`)}
        style={{ width: 80 }}
      >
        {hours.map((hh) => (
          <option key={hh} value={String(hh).padStart(2, "0")}>
            {String(hh).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span style={{ alignSelf: "center", color: "#999" }}>:</span>
      <select
        className="input"
        disabled={disabled}
        value={String(minute).padStart(2, "0")}
        onChange={(e) => onChange(`${String(hour).padStart(2, "0")}:${e.target.value}`)}
        style={{ width: 80 }}
      >
        {minutes.map((mm) => (
          <option key={mm} value={String(mm).padStart(2, "0")}>
            {String(mm).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------ Types ------------------------------ */
type Room = { id: number; number: string; isActive: boolean; roomType?: string | null };
type DailyRow = {
  id: number;
  roomId: number | null;
  room: { number: string } | null;
  roomType?: string;
  name: string;
  contact: string;
  carNo: string | null;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  guestUrl: string;
};
type ActualEntry = { in?: string; out?: string; inEventId?: number; outEventId?: number };

type ActionMode =
  | "checkin_now"
  | "checkout_now"
  | "checkin_reserve_custom"
  | "checkout_reserve_custom"
  | "checkin_cancel"
  | "checkout_cancel";

type ActionRow = {
  id: number;
  name: string;
  roomType?: string;
  roomNumber: string;
  checkinAt: string;
  checkoutAt?: string;
  phone: string;
};

/* ------------------------- 문자 액션 셀 -------------------------- */
function ActionCell({ row }: { row: ActionRow }) {
  const [mode, setMode] = useState<ActionMode>("checkin_now");

  const askTime = (baseISO: string, label: string): string | null => {
    const base = new Date(baseISO);
    const y = base.getFullYear(),
      m = pad(base.getMonth() + 1),
      d = pad(base.getDate());
    const hhmm = prompt(
      `${label} 보낼 "시각"을 입력하세요 (예: 13:00 또는 ${y}-${m}-${d}T13:00)`,
      "13:00"
    );
    if (!hhmm) return null;
    if (/^\d{2}:\d{2}$/.test(hhmm)) return `${y}-${m}-${d}T${hhmm}:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(hhmm)) return `${hhmm}:00`;
    alert("형식이 올바르지 않습니다.");
    return null;
  };

  const post = async (url: string, payload: unknown) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let msg = "";
    try {
      const t = await r.text();
      msg = t || "";
    } catch {}
    if (!r.ok) throw new Error(`HTTP ${r.status}${msg ? ` - ${msg}` : ""}`);
    return msg;
  };

  const confirmAndSend = async (): Promise<void> => {
    const { id, name, roomType, roomNumber } = row;
    const phone = row.phone.replace(/\D/g, ""); // 항상 숫자만
    const base = { guestId: id, name, roomType, roomNumber, phone };

    try {
      // 즉시 전송
      if (mode === "checkin_now" || mode === "checkout_now") {
        const kind = mode.startsWith("checkin") ? "checkin" : "checkout";
        if (!confirm(`[${kind}] 즉시 전송하시겠습니까?`)) return;
        await post("/api/sms/send", { ...base, kind, type: kind, sendMode: "now" });
        alert("전송 완료");
        return;
      }

      // 예약 전송(시간 지정)
      if (mode === "checkin_reserve_custom" || mode === "checkout_reserve_custom") {
        const kind = mode.startsWith("checkin") ? "checkin" : "checkout";
        const baseTime = new Date(mode.startsWith("checkin") ? row.checkinAt : row.checkoutAt ?? row.checkinAt);
        const sendTime = askTime(baseTime.toISOString(), kind === "checkin" ? "입실 문자" : "퇴실 문자");
        if (!sendTime) return;
        if (!confirm(`[${kind}] ${sendTime} 에 예약 전송하시겠습니까?`)) return;
        await post("/api/sms/send", { ...base, kind, type: kind, sendMode: "reserve", sendTime });
        alert("예약 등록 완료");
        return;
      }

      // 예약 취소
      if (mode === "checkin_cancel" || mode === "checkout_cancel") {
        const kind = mode.startsWith("checkin") ? "checkin" : "checkout";
        if (!confirm(`[${kind}] 예약을 취소하시겠습니까?`)) return;
        await post("/api/sms/cancel", { guestId: id, kind });
        alert("예약 취소 완료");
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("SMS error", { mode, row, error: m });
      alert(`문자 처리 실패: ${m}`);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={mode} onChange={(e) => setMode(e.target.value as ActionMode)} className="input">
        <option value="checkin_now">입실 즉시 전송</option>
        <option value="checkin_reserve_custom">입실 예약 전송(시간 지정)</option>
        <option value="checkin_cancel">입실 예약 취소</option>
        <option value="checkout_now">퇴실 즉시 전송</option>
        <option value="checkout_reserve_custom">퇴실 예약 전송(시간 지정)</option>
        <option value="checkout_cancel">퇴실 예약 취소</option>
      </select>
      <button className="btn" onClick={confirmAndSend}>
        확인
      </button>
    </div>
  );
}

/* ============================ 페이지 ============================ */
type ViewMode = "todayCheckin" | "todayCheckout" | "all" | "range";
type SortKey = "start" | "end" | "roomType" | "roomNumber" | "name" | "phone" | "car";
type SortDir = "asc" | "desc";

export default function AdminDaily() {
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [ctrlBusy, setCtrlBusy] = useState<Record<number, "open" | "close" | "status" | null>>({});

  // 로그인 체크
  useEffect(() => {
    (async () => {
      try {
        await fetchJSON("/api/admin/me", { method: "GET" });
      } catch {
        const next = "/admin";
        window.location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
      }
    })();
  }, []);

  /* 호실 */
  const [rooms, setRooms] = useState<Room[]>([]);
  const loadRooms = useCallback(async () => {
    try {
      const d = await fetchJSON<{ rows: Room[] }>("/api/rooms?sort=number:asc");
      setRooms(d.rows || []);
    } catch (e) {
      alert("호실 로드 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  /* 보기 모드 & 기간 */
  const [viewMode, setViewMode] = useState<ViewMode>("todayCheckin"); // 기본: 당일 입실
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: todayYmd(),
    end: todayYmd(),
  });

  /* 검색/필터 */
  const [filterRoomType, setFilterRoomType] = useState("");
  const [filterRoomId, setFilterRoomId] = useState<number | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterCar, setFilterCar] = useState("");

  /* 정렬/페이지 */
  const [sortKey, setSortKey] = useState<SortKey>("start");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /* 데이터 상태 */
  const [rawRows, setRawRows] = useState<DailyRow[]>([]); // 서버에서 가져온 원본
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]); // 현재 화면용(수정 포함)
  const [actualMap, setActualMap] = useState<Record<number, ActualEntry>>({});
  const [roomTypeList, setRoomTypeList] = useState<string[]>([
    "스튜디오",
    "스튜디오 플러스",
    "스튜디오 오션뷰",
    "스튜디오 트윈",
    "스튜디오 배리어프리",
    "기타",
  ]);

  const resetPaging = () => setPage(1);

  const applyFiltersSort = useCallback(
    (src: DailyRow[]) => {
      // 1) 필터
      let rows = src.filter((r) => {
        if (filterRoomType && (r.roomType ?? "") !== filterRoomType) return false;
        if (filterRoomId && r.roomId !== filterRoomId) return false;
        if (filterName && !r.name.includes(filterName)) return false;
        if (filterPhone && !r.contact.replace(/\D/g, "").includes(filterPhone.replace(/\D/g, ""))) return false;
        if (filterCar && !(r.carNo ?? "").includes(filterCar)) return false;
        return true;
      });

      // 2) 정렬
      rows = [...rows].sort((a, b) => {
        let va = "";
        let vb = "";
        if (sortKey === "start") {
          va = `${a.startDate}T${a.startTime ?? "15:00"}`;
          vb = `${b.startDate}T${b.startTime ?? "15:00"}`;
        } else if (sortKey === "end") {
          va = `${a.endDate}T${a.endTime ?? "11:00"}`;
          vb = `${b.endDate}T${b.endTime ?? "11:00"}`;
        } else if (sortKey === "roomType") {
          va = (a.roomType ?? "").toUpperCase();
          vb = (b.roomType ?? "").toUpperCase();
        } else if (sortKey === "roomNumber") {
          va = (a.room?.number ?? "").toUpperCase();
          vb = (b.room?.number ?? "").toUpperCase();
        } else if (sortKey === "name") {
          va = a.name.toUpperCase();
          vb = b.name.toUpperCase();
        } else if (sortKey === "phone") {
          va = (a.contact || "").replace(/\D/g, "");
          vb = (b.contact || "").replace(/\D/g, "");
        } else if (sortKey === "car") {
          va = (a.carNo ?? "").toUpperCase();
          vb = (b.carNo ?? "").toUpperCase();
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });

      setDailyRows(rows);
      resetPaging();
    },
    [filterRoomType, filterRoomId, filterName, filterPhone, filterCar, sortKey, sortDir]
  );

  const refreshActuals = useCallback(async (ids: number[]) => {
    if (!ids.length) {
      setActualMap({});
      return;
    }
    try {
      const a = await fetchJSON<{
        rows: Array<{ guestId: number; in?: string; out?: string; inEventId?: number; outEventId?: number }>;
      }>("/api/admin/actuals", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      const map: Record<number, ActualEntry> = {};
      for (const row of a.rows || [])
        map[row.guestId] = { in: row.in, out: row.out, inEventId: row.inEventId, outEventId: row.outEventId };
      setActualMap(map);
    } catch {
      console.warn("실입실/실퇴실 조회 실패");
      setActualMap({});
    }
  }, []);

  const loadDaily = useCallback(async () => {
    const qs = new URLSearchParams();
    if (viewMode === "all") qs.set("all", "1");
    else if (viewMode === "todayCheckin") qs.set("todayCheckin", "1");
    else if (viewMode === "todayCheckout") qs.set("todayCheckout", "1");
    else {
      qs.set("start", dateRange.start);
      qs.set("end", dateRange.end || dateRange.start);
    }
    try {
      const d = await fetchJSON<{ rows: DailyRow[] }>(`/api/daily?${qs.toString()}`);
      const rows = (d.rows || []).map((row) => ({
        ...row,
        room: row.room ?? null,
        roomId: row.roomId ?? null,
        startTime: row.startTime ?? "15:00",
        endTime: row.endTime ?? "11:00",
        roomType: row.roomType ?? "",
      }));
      setRawRows(rows);
      setDirtyIds(new Set());
      applyFiltersSort(rows);
      await refreshActuals(rows.map((x) => x.id));
    } catch (e) {
      alert("손님 명부 조회 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [viewMode, dateRange.start, dateRange.end, refreshActuals, applyFiltersSort]);

  const [showUpload, setShowUpload] = useState(false);

  /* 신규 입력 */
  const [savingDaily, setSavingDaily] = useState(false);
  const [newDaily, setNewDaily] = useState<{
    roomType: string;
    roomId: number | null;
    startDate: string;
    endDate: string;
    name: string;
    contact: string;
    carNo: string;
    startTime: string;
    endTime: string;
  }>({
    roomType: "",
    roomId: null,
    startDate: todayYmd(),
    endDate: todayYmd(),
    name: "",
    contact: "",
    carNo: "",
    startTime: "15:00",
    endTime: "11:00",
  });

  // 신규 입력에서 객실 타입에 맞는 호실만 표시
  const newRowRoomOptions = useMemo(
    () =>
      rooms.filter((r) => {
        if (!newDaily.roomType) return true;
        return (r.roomType ?? "") === newDaily.roomType;
      }),
    [rooms, newDaily.roomType]
  );

  // 행 저장 유효성 검사
  const validateRow = (
    row: Pick<DailyRow, "roomType" | "name" | "startDate" | "endDate" | "startTime" | "endTime">
  ): string | null => {
    if (!row.roomType || !row.roomType.trim()) return "객실 타입은 필수입니다.";
    if (!row.name?.trim()) return "이름은 필수입니다.";
    if (!row.startDate) return "입실 날짜가 필요합니다.";
    if (!row.endDate) return "퇴실 날짜가 필요합니다.";
    if (row.startDate > row.endDate) return "입실 날짜가 퇴실 날짜보다 늦을 수 없습니다.";
    if (!row.startTime) return "입실 시간이 필요합니다.";
    if (!row.endTime) return "퇴실 시간이 필요합니다.";
    return null;
  };

  const createDaily = async () => {
    if (savingDaily) return;
    const err = validateRow({
      roomType: newDaily.roomType,
      name: newDaily.name,
      startDate: newDaily.startDate,
      endDate: newDaily.endDate,
      startTime: newDaily.startTime,
      endTime: newDaily.endTime,
    });
    if (err) {
      alert(err);
      return;
    }

    // 겹침 차단
    if (willOverlapWithExisting(
      rawRows,
      newDaily.roomId,
      newDaily.startDate, newDaily.startTime,
      newDaily.endDate,   newDaily.endTime
    )) {
      alert("해당 시간대에 이미 같은 호실 예약이 있습니다. 다른 호실을 선택하세요.");
      return;
    }

    setSavingDaily(true);
    try {
      const payload = {
        roomId: newDaily.roomId || undefined,
        roomType: newDaily.roomType || "",
        startDate: `${newDaily.startDate}T${newDaily.startTime}`,
        endDate: `${newDaily.endDate}T${newDaily.endTime}`,
        name: newDaily.name,
        contact: newDaily.contact,
        carNo: newDaily.carNo,
      };
      await fetchJSON("/api/daily", { method: "POST", body: JSON.stringify(payload) });
      if (payload.roomType && !roomTypeList.includes(payload.roomType))
        setRoomTypeList((prev) => [...prev, payload.roomType!]);
      await loadDaily();
      setNewDaily({
        roomType: "",
        roomId: null,
        startDate: todayYmd(),
        endDate: todayYmd(),
        name: "",
        contact: "",
        carNo: "",
        startTime: "15:00",
        endTime: "11:00",
      });
    } catch (e) {
      alert("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingDaily(false);
    }
  };

  const markDirty = (id: number) => setDirtyIds((s) => new Set(s).add(id));

  const saveDailyRow = async (row: DailyRow) => {
    const err = validateRow({
      roomType: row.roomType ?? "",
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      startTime: row.startTime ?? "15:00",
      endTime: row.endTime ?? "11:00",
    });
    if (err) {
      alert(err);
      return;
    }

    // 겹침 차단
    if (willOverlapWithExisting(
      rawRows,
      row.roomId,
      row.startDate, row.startTime ?? "15:00",
      row.endDate,   row.endTime   ?? "11:00",
      row.id
    )) {
      alert("해당 시간대에 이미 같은 호실 예약이 있습니다. 저장할 수 없습니다.");
      return;
    }

    setSavingIds((prev) => new Set(prev).add(row.id));

    try {
      const payload = {
        id: row.id,
        roomId: row.roomId || undefined,
        roomType: row.roomType || "",
        startDate: `${row.startDate}T${row.startTime ?? "15:00"}`,
        endDate: `${row.endDate}T${row.endTime ?? "11:00"}`,
        name: row.name,
        contact: row.contact,
        carNo: row.carNo ?? "",
      };
      await fetchJSON("/api/daily", { method: "POST", body: JSON.stringify(payload) });
      if (payload.roomType && !roomTypeList.includes(payload.roomType))
        setRoomTypeList((prev) => [...prev, payload.roomType!]);

      setDirtyIds((s) => {
        const n = new Set(s);
        n.delete(row.id);
        return n;
      });

      // 저장 후 최신 데이터 다시 로드
      await loadDaily();
    } catch (e) {
      alert("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const saveAllDirty = async () => {
    if (dirtyIds.size === 0) {
      alert("변경된 항목이 없습니다.");
      return;
    }
    if (!confirm(`변경된 ${dirtyIds.size}건을 모두 저장할까요?`)) return;
    try {
      for (const id of dirtyIds) {
        const row = dailyRows.find((r) => r.id === id);
        if (!row) continue;
        await saveDailyRow(row);
      }
      alert("전체 저장이 완료되었습니다.");
    } catch {
      alert("일부 저장에 실패했습니다.");
    }
  };

  const deleteDailyRow = async (id: number) => {
    if (!confirm("정말 삭제할까요?")) return;
    try {
      await fetchJSON(`/api/daily/${id}`, { method: "DELETE" });
      await loadDaily();
    } catch (e) {
      alert("삭제 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // 이벤트 무효처리
  const invalidateEvent = async (eventId: number) => {
    if (!confirm("이 이벤트를 무효 처리(삭제)할까요?")) return;
    try {
      await fetchJSON(`/api/admin/events/${eventId}`, { method: "DELETE" });
      await refreshActuals(dailyRows.map((x) => x.id));
    } catch (e) {
      alert("무효 처리 실패: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  /* 기기 제어 */
  const controlDevice = async (row: DailyRow, controlType: "open" | "close" | "status") => {
    setCtrlBusy((prev) => ({ ...prev, [row.id]: controlType }));
    try {
      type ItsokeyResp = {
        code: number;
        message?: string;
        timestamp?: string;
        state?: { lock?: number; sensor?: number; battery?: number };
      };

      const data = await fetchJSON<ItsokeyResp>("/api/itsokey/control", {
        method: "POST",
        body: JSON.stringify({
          roomId: row.roomId || undefined,
          guestId: row.id,
          name: row.name,
          phone: row.contact.replace(/-/g, ""),
          controlType,
        }),
      });

      if (controlType === "status") {
        const s = data.state ?? {};
        const lockTxt = s.lock === 0 ? "잠김" : s.lock === 1 ? "열림" : "알수없음";
        const sensorTxt = s.sensor === 0 ? "닫힘" : s.sensor === 1 ? "열림" : "알수없음";
        const battTxt = typeof s.battery === "number" ? `${s.battery}%` : "알수없음";
        const timeTxt = data.timestamp ? new Date(data.timestamp).toLocaleString() : "-";

        alert(
          `상태 조회\n` +
            `호실: ${row.room?.number ?? "—"}\n` +
            `도어락: ${lockTxt}\n` +
            `문센서: ${sensorTxt}\n` +
            `배터리: ${battTxt}\n` +
            `응답시간: ${timeTxt}\n` +
            `(code=${data.code}${data.message ? `, msg=${data.message}` : ""})`
        );
        return;
      }

      if (data.code === 200 || data.code === 201) {
        alert(`✅ ${(row.room?.number ?? "—")} ${controlType} 처리: ${data.message ?? "success"}`);
      } else {
        alert(`❌ ${(row.room?.number ?? "—")} 제어 실패: ${data.message ?? "오류"}`);
      }
    } catch (e) {
      console.error(e);
      alert("제어 요청 실패");
    } finally {
      setCtrlBusy((prev) => ({ ...prev, [row.id]: null }));
    }
  };

  /* 초기 로드 */
  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);
  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  // 필터/정렬 변경 시 현재 편집 데이터 기준 재적용
  useEffect(() => {
    applyFiltersSort(rawRows.map((r) => ({ ...r })));
  }, [applyFiltersSort, rawRows]);

  /* 선택 상태 (일괄 작업용) */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSelection = () => setSelected(new Set());
  const allChecked = useMemo(
    () => dailyRows.length > 0 && dailyRows.every((r) => selected.has(r.id)),
    [dailyRows, selected]
  );
  const toggleAll = () =>
    setSelected((s) => {
      if (dailyRows.length === 0) return s;
      const all = new Set<number>(pagedRows.map((r) => r.id));
      const isAll = pagedRows.every((r) => s.has(r.id));
      return isAll ? new Set() : all;
    });

  /* 페이징 계산(클라 사이드) */
  const totalPages = useMemo(() => Math.max(1, Math.ceil(dailyRows.length / pageSize)), [dailyRows.length, pageSize]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return dailyRows.slice(start, start + pageSize);
  }, [dailyRows, page, pageSize]);

  /* ===== 일괄 버튼 핸들러 ===== */
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 삭제할까요?`)) return;
    for (const id of selected) await fetchJSON(`/api/daily/${id}`, { method: "DELETE" });
    clearSelection();
    await loadDaily();
  };
  const bulkSend = async (kind: "checkin" | "checkout") => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}명에게 ${kind === "checkin" ? "입실" : "퇴실"} 문자를 즉시 전송할까요?`)) return;
    for (const id of selected) {
      const row = dailyRows.find((r) => r.id === id);
      if (!row) continue;
      const base = {
        guestId: row.id,
        name: row.name,
        roomType: row.roomType ?? "",
        roomNumber: row.room?.number ?? "",
        phone: row.contact.replace(/\D/g, ""),
      };
      await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, kind, type: kind, sendMode: "now" }),
      });
    }
    alert("요청을 보냈습니다.");
    clearSelection();
  };

  const onHeaderSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prevKey;
    });
  };

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? "" : sortDir === "asc" ? " ▲" : " ▼";

  /* ============================ 렌더 ============================ */
  return (
    <div className="admin-wrap">
      <section className="card">
        <h2 className="section-title">날짜별 손님 명부</h2>

        {/* 보기/조회 영역 */}
        <div className="filters-row">
          {/* 1) 탭 줄 */}
          <div className="filters-left">
            <button
              className="btn btn-ghost"
              onClick={() => setViewMode("todayCheckin")}
              disabled={viewMode === "todayCheckin"}
              style={{ fontWeight: viewMode === "todayCheckin" ? 700 : 400 }}
            >
              당일 입실
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setViewMode("todayCheckout")}
              disabled={viewMode === "todayCheckout"}
              style={{ fontWeight: viewMode === "todayCheckout" ? 700 : 400 }}
            >
              당일 퇴실
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setViewMode("all")}
              disabled={viewMode === "all"}
              style={{ fontWeight: viewMode === "all" ? 700 : 400 }}
            >
              전체보기
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setViewMode("range")}
              disabled={viewMode === "range"}
              style={{ fontWeight: viewMode === "range" ? 700 : 400 }}
            >
              기간조회
            </button>

            {viewMode === "range" && (
              <>
                <input
                  className="input w-140"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((v) => ({ ...v, start: e.target.value }))}
                />
                <input
                  className="input w-140"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((v) => ({ ...v, end: e.target.value }))}
                />
                <button className="btn" onClick={() => void loadDaily()}>조회</button>
              </>
            )}
          </div>

          {/* 2) 검색 줄 */}
          <div className="filters-center">
            <input
              className="input w-140"
              placeholder="객실 타입"
              value={filterRoomType}
              onChange={(e) => setFilterRoomType(e.target.value)}
              list="roomTypeList"
            />
            <select
              className="input w-160"
              value={filterRoomId ?? 0}
              onChange={(e) => setFilterRoomId(Number(e.target.value) || null)}
            >
              <option value={0}>호실 선택(선택)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.number}</option>
              ))}
            </select>
            <input
              className="input w-140"
              placeholder="이름"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
            <input
              className="input w-160"
              placeholder="연락처"
              value={filterPhone}
              onChange={(e) => setFilterPhone(formatPhoneAuto(e.target.value))}
            />
            <input
              className="input w-140"
              placeholder="차량번호"
              value={filterCar}
              onChange={(e) => setFilterCar(e.target.value)}
            />
            <button className="btn" onClick={() => applyFiltersSort(rawRows)}>검색</button>
            <button
              className="btn"
              onClick={() => {
                setFilterRoomType("");
                setFilterRoomId(null);
                setFilterName("");
                setFilterPhone("");
                setFilterCar("");
                setSortKey("start");
                setSortDir("asc");
                applyFiltersSort(rawRows);
              }}
            >
              초기화
            </button>
          </div>

          {/* 3) 액션 줄 */}
          <div
            className="filters-right"
            style={{ justifyContent: "flex-start" }}
          >
            <button className="btn" onClick={() => void refreshActuals(dailyRows.map((x) => x.id))}>
              실입실/실퇴실 새로고침
            </button>
            <button className="btn" onClick={saveAllDirty}>전체저장</button>
            <button className="btn btn-brown" onClick={() => setShowUpload(true)}>대량업로드</button>
            <select
              className="input w-120"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>표시 {n}줄</option>
              ))}
            </select>
          </div>

          {/* 신규 입력 – 2행 그리드 */}
          <div
            className="new-daily-row"
            style={{
              display: "grid",
              gridTemplateColumns: "200px 120px 220px 220px 180px 120px",
              gridAutoRows: "minmax(40px, auto)",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            {/* 1행: 입실일/시간 · 객실타입 · 이름 · 차량번호 */}
            <input
              className="input"
              type="date"
              value={newDaily.startDate}
              onChange={(e) => setNewDaily((v) => ({ ...v, startDate: e.target.value }))}
              style={{ gridColumn: "1", gridRow: "1", width: 160 }}
            />
            <div style={{ gridColumn: "2", gridRow: "1" }}>
              <TimeField
                value={newDaily.startTime}
                onChange={(val) => setNewDaily((v) => ({ ...v, startTime: val }))}
              />
            </div>

            <input
              className="input"
              list="roomTypeList"
              placeholder="객실 타입"
              value={newDaily.roomType}
              onChange={(e) => {
                const v = e.target.value;
                setNewDaily((s) => ({
                  ...s,
                  roomType: v,
                  roomId:
                    s.roomId && rooms.find((r) => r.id === s.roomId && (r.roomType ?? "") === v)
                      ? s.roomId
                      : null,
                }));
              }}
              style={{ gridColumn: "3", gridRow: "1", width: 220 }}
            />

            <input
              className="input"
              placeholder="이름"
              value={newDaily.name}
              onChange={(e) => setNewDaily((v) => ({ ...v, name: e.target.value }))}
              style={{ gridColumn: "4", gridRow: "1", width: 220 }}
            />

            <input
              className="input"
              placeholder="차량번호"
              value={newDaily.carNo}
              onChange={(e) => setNewDaily((v) => ({ ...v, carNo: e.target.value }))}
              style={{ gridColumn: "5", gridRow: "1", width: 180 }}
            />

            {/* 저장 버튼(2줄 차지) */}
            <button
              className="btn btn-brown"
              onClick={() => void createDaily()}
              style={{ gridColumn: "6", gridRow: "1 / span 2" }}
            >
              {savingDaily ? "저장 중..." : "저장"}
            </button>

            {/* 2행: 퇴실일/시간 · 호실선택 · 연락처 */}
            <input
              className="input"
              type="date"
              value={newDaily.endDate}
              onChange={(e) => setNewDaily((v) => ({ ...v, endDate: e.target.value }))}
              style={{ gridColumn: "1", gridRow: "2", width: 160 }}
            />
            <div style={{ gridColumn: "2", gridRow: "2" }}>
              <TimeField
                value={newDaily.endTime}
                onChange={(val) => setNewDaily((v) => ({ ...v, endTime: val }))}
              />
            </div>

            {/* ✅ 겹치는 시간의 호실 숨김 */}
            {(() => {
              const blockedNew = conflictRoomIdsByOverlap(
                rawRows,
                newDaily.startDate, newDaily.startTime,
                newDaily.endDate,   newDaily.endTime
              );
              const selectableNew = rooms.filter(
                r => (!newDaily.roomType || (r.roomType ?? "") === newDaily.roomType) && !blockedNew.has(r.id)
              );

              return (
                <select
                  className="input"
                  value={newDaily.roomId ?? 0}
                  onChange={(e) => setNewDaily((v) => ({ ...v, roomId: Number(e.target.value) || null }))}
                  style={{ gridColumn: "3", gridRow: "2", width: 220 }}
                >
                  <option value={0}>호실 선택(선택)</option>
                  {selectableNew.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number}
                    </option>
                  ))}
                </select>
              );
            })()}

            <input
              className="input"
              placeholder="연락처"
              inputMode="numeric"
              maxLength={14}
              value={newDaily.contact}
              onChange={(e) => setNewDaily((v) => ({ ...v, contact: formatPhoneAuto(e.target.value) }))}
              style={{ gridColumn: "4", gridRow: "2", width: 220 }}
            />

            {/* 정렬 맞춤용 빈칸 */}
            <div style={{ gridColumn: "5", gridRow: "2" }} />
          </div>
        </div>

        {/* 목록 */}
        <div style={{ marginTop: 6 }} className="table-scroll">
          <table className="daily-table" style={{ minWidth: "1200px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>

                <th onClick={() => onHeaderSort("start")} style={{ cursor: "pointer" }}>
                  입실/퇴실 (예약){sortIcon("start")}
                </th>

                {/* 객실타입/호실 묶음 */}
                <th>
                  <div className="th-pair">
                    <button type="button" onClick={() => onHeaderSort("roomType")} className="th-sort-btn">
                      객실타입{sortIcon("roomType")}
                    </button>
                    <span className="th-sep">/</span>
                    <button type="button" onClick={() => onHeaderSort("roomNumber")} className="th-sort-btn">
                      호실{sortIcon("roomNumber")}
                    </button>
                  </div>
                </th>

                {/* 이름/연락처 묶음 */}
                <th>
                  <div className="th-pair">
                    <button type="button" onClick={() => onHeaderSort("name")} className="th-sort-btn">
                      이름{sortIcon("name")}
                    </button>
                    <span className="th-sep">/</span>
                    <button type="button" onClick={() => onHeaderSort("phone")} className="th-sort-btn">
                      연락처{sortIcon("phone")}
                    </button>
                  </div>
                </th>

                <th onClick={() => onHeaderSort("car")} style={{ cursor: "pointer" }}>
                  차량번호{sortIcon("car")}
                </th>

                <th onClick={() => onHeaderSort("end")} style={{ cursor: "pointer" }}>
                  실입실 / 실퇴실{sortIcon("end")}
                </th>

                <th>링크</th>
                <th>관리</th>
                <th>기기제어</th>
                <th>문자전송</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const actual = actualMap[row.id] ?? {};
                const checkinAtIso = `${row.startDate}T${row.startTime ?? "15:00"}:00`;
                const checkoutAtIso = `${row.endDate}T${row.endTime ?? "11:00"}:00`;

                const rowRoomOptions = rooms.filter((r) => {
                  if (!row.roomType) return true;
                  return (r.roomType ?? "") === row.roomType;
                });

                return (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                    </td>

                    <td>
                      <div className="cell-dates--two">
                        <div className="muted">입실</div>
                        <input
                          className="input"
                          type="date"
                          value={row.startDate}
                          onChange={(e) => {
                            setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, startDate: e.target.value } : x)));
                            markDirty(row.id);
                          }}
                        />
                        <TimeField
                          value={row.startTime ?? "15:00"}
                          onChange={(val) => {
                            setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, startTime: val } : x)));
                            markDirty(row.id);
                          }}
                        />

                        <div className="muted">퇴실</div>
                        <input
                          className="input"
                          type="date"
                          value={row.endDate}
                          onChange={(e) => {
                            setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, endDate: e.target.value } : x)));
                            markDirty(row.id);
                          }}
                        />
                        <TimeField
                          value={row.endTime ?? "11:00"}
                          onChange={(val) => {
                            setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, endTime: val } : x)));
                            markDirty(row.id);
                          }}
                        />
                      </div>
                    </td>

                    <td>
                      <div className="cell-pair">
                        {/* 객실타입 */}
                        <input
                          className="input"
                          list="roomTypeList"
                          placeholder="객실 타입"
                          value={row.roomType ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDailyRows((prev) =>
                              prev.map((x) =>
                                x.id === row.id
                                  ? {
                                      ...x,
                                      roomType: v,
                                      roomId:
                                        x.roomId && rooms.find((r) => r.id === x.roomId && (r.roomType ?? "") === v)
                                          ? x.roomId
                                          : null,
                                      room:
                                        x.roomId && rooms.find((r) => r.id === x.roomId && (r.roomType ?? "") === v)
                                          ? x.room
                                          : null,
                                    }
                                  : x
                              )
                            );
                            markDirty(row.id);
                          }}
                        />

                        {/* ✅ 호실: 겹치는 시간의 호실 숨김 */}
                        {(() => {
                          const blocked = conflictRoomIdsByOverlap(
                            rawRows,
                            row.startDate, row.startTime ?? "15:00",
                            row.endDate,   row.endTime   ?? "11:00",
                            row.id
                          );
                          const roomOptions = rooms.filter(
                            r => (!row.roomType || (r.roomType ?? "") === row.roomType) && !blocked.has(r.id)
                          );

                          return (
                            <select
                              className="input"
                              value={row.roomId ?? 0}
                              onChange={(e) => {
                                const newRoomId = Number(e.target.value) || null;
                                const newRoom = rooms.find((r) => r.id === newRoomId!);
                                setDailyRows((prev) =>
                                  prev.map((x) =>
                                    x.id === row.id ? { ...x, roomId: newRoomId, room: newRoom ? { number: newRoom.number } : null } : x
                                  )
                                );
                                markDirty(row.id);
                              }}
                              style={{ minWidth: 110 }}
                            >
                              <option value={0}>호실 선택(선택)</option>
                              {roomOptions.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.number}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    </td>

                    <td>
                      <div className="cell-pair">
                        {/* 이름 */}
                        <input
                          className="input"
                          value={row.name}
                          onChange={(e) => {
                            setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x)));
                            markDirty(row.id);
                          }}
                        />

                        {/* 연락처 */}
                        <input
                          className="input"
                          placeholder="010-0000-0000"
                          inputMode="numeric"
                          maxLength={14}
                          value={row.contact}
                          onChange={(e) => {
                            setDailyRows((prev) =>
                              prev.map((x) => (x.id === row.id ? { ...x, contact: formatPhoneAuto(e.target.value) } : x))
                            );
                            markDirty(row.id);
                          }}
                        />
                      </div>
                    </td>

                    <td>
                      <input
                        className="input"
                        value={row.carNo ?? ""}
                        onChange={(e) => {
                          setDailyRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, carNo: e.target.value } : x)));
                          markDirty(row.id);
                        }}
                      />
                    </td>

                    <td>
                      <div className="cell-actual">
                        <div>
                          실입실: {fmtHm(actual.in)}{" "}
                          {actual.inEventId && (
                            <button className="btn btn-ghost" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => void invalidateEvent(actual.inEventId!)}>
                              (취소)
                            </button>
                          )}
                        </div>
                        <div>
                          실퇴실: {fmtHm(actual.out)}{" "}
                          {actual.outEventId && (
                            <button className="btn btn-ghost" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => void invalidateEvent(actual.outEventId!)}>
                              (취소)
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <button
                        className="btn btn-browncl"
                        style={{ display: "inline-block", textAlign: "center" }}
                        onClick={async () => {
                          try {
                            const { url } = await fetchJSON<{ url: string }>("/api/admin/magic-link", {
                              method: "POST",
                              body: JSON.stringify({ guestId: row.id }),
                            });
                            window.open(url, "_blank");
                          } catch {
                            alert("링크 생성 실패");
                          }
                        }}
                      >
                        바로가기
                      </button>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button className="btn btn-brown" onClick={() => void saveDailyRow(row)} disabled={savingIds.has(row.id)}>
                          {savingIds.has(row.id) ? "저장 중..." : "저장"}
                        </button>
                        <button className="btn" onClick={() => void deleteDailyRow(row.id)}>
                          삭제
                        </button>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button className="btn btn-brown" onClick={() => controlDevice(row, "open")} disabled={!!ctrlBusy[row.id]}>
                          {ctrlBusy[row.id] === "open" ? "여는 중..." : "열기"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => controlDevice(row, "close")} disabled={!!ctrlBusy[row.id]}>
                          {ctrlBusy[row.id] === "close" ? "닫는 중..." : "닫기"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => controlDevice(row, "status")} disabled={!!ctrlBusy[row.id]}>
                          {ctrlBusy[row.id] === "status" ? "조회 중..." : "상태"}
                        </button>
                      </div>
                    </td>

                    <td>
                      <ActionCell
                        row={{
                          id: row.id,
                          name: row.name,
                          roomType: row.roomType ?? "",
                          roomNumber: row.room?.number ?? "",
                          checkinAt: checkinAtIso,
                          checkoutAt: checkoutAtIso,
                          phone: row.contact.replace(/\D/g, ""),
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted" style={{ textAlign: "center" }}>
                    해당 조건의 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            이전
          </button>
          <span className="muted">
            {page} / {totalPages}
          </span>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            다음
          </button>
        </div>

        {selected.size > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "#666" }}>
              선택: <b>{selected.size}</b>건
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={bulkDelete}>
                삭제
              </button>
              <button className="btn btn-brown" onClick={() => bulkSend("checkin")}>
                입실 문자 전송
              </button>
              <button className="btn btn-brown" onClick={() => bulkSend("checkout")}>
                퇴실 문자 전송
              </button>
              <button className="btn btn-ghost" onClick={clearSelection}>
                선택 해제
              </button>
            </div>
          </div>
        )}
      </section>

      <datalist id="roomTypeList">
        {roomTypeList.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={async () => {
            setShowUpload(false);
            await loadDaily();
          }}
        />
      )}
    </div>
  );
}