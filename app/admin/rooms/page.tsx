// app/admin/rooms/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ---------- fetch helper ---------- */
async function fetchJSON<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const r = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status}${txt ? ` - ${txt}` : ""}`);
  }
  return (await r.json().catch(() => ({}))) as T;
}

/* ---------- types ---------- */
type Room = {
  id: number;
  number: string;
  numberSort?: number | null;
  name?: string | null;
  roomType?: string | null;
  isActive: boolean;
  deviceId?: string | null;
  spaceId?: string | null;
};

// ⬇ 잇소키 상태(최근 조회 결과 저장용)
type DeviceState = { lock: number; sensor: number; battery: number } | null;

/* 기본 객실 타입 후보 */
const DEFAULT_ROOM_TYPES = [
  "스튜디오",
  "스튜디오 플러스",
  "스튜디오 오션뷰",
  "스튜디오 트윈",
  "스튜디오 배리어프리",
  "기타",
];

export default function RoomsPage() {
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  // 상단 필터: 객실 타입
  const [typeFilter, setTypeFilter] = useState<string>("");

  // ⬇ 각 호실의 최근 상태 저장
  const [lastState, setLastState] = useState<Record<number, DeviceState>>({});

  // 드롭다운 옵션: 기본값 + 현재 데이터에 존재하는 타입을 합쳐서 중복 제거
  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_ROOM_TYPES,
          ...rows.map((r) => r.roomType ?? "").filter(Boolean),
        ])
      ),
    [rows]
  );

  // 화면 표시용(필터 적용)
  const filteredRows = useMemo(
    () => (typeFilter ? rows.filter((r) => (r.roomType ?? "") === typeFilter) : rows),
    [rows, typeFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchJSON<{ rows: Room[] }>("/api/rooms?sort=number:asc");
      setRows(d.rows || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const putRow = async (row: Room) => {
    await fetchJSON(`/api/rooms/${row.id}`, {
      method: "PUT",
      headers: { "x-actor": "admin" },
      body: JSON.stringify({
        number: row.number,
        numberSort: row.numberSort ?? null,
        name: row.name ?? "",
        isActive: row.isActive,
        deviceId: row.deviceId ?? "",
        spaceId: row.spaceId ?? "",
        roomType: row.roomType ?? "",
      }),
    });
  };

  const saveAll = async () => {
    if (loading || rows.length === 0) return;
    setLoading(true);
    const ok: string[] = [];
    const fail: string[] = [];

    for (const row of rows) {
      try {
        await putRow(row);
        ok.push(row.number);
      } catch (e) {
        fail.push(`${row.number} (${(e as Error).message})`);
      }
    }

    setLoading(false);
    void load();

    if (fail.length === 0) {
      alert(`✅ 전체 ${ok.length}개 호실 저장 완료`);
    } else {
      alert(
        `부분 성공: ${ok.length}개 저장\n실패: ${fail.length}개\n\n실패 목록:\n- ${fail.join(
          "\n- "
        )}`
      );
    }
  };

  // ✅ 행 저장 버튼이 눌려도 전체 저장이 돌도록 래핑
  const saveRow = async (_row: Room) => {
    await saveAll();
  };

  const createRow = async () => {
    const number = prompt("새 호실 번호를 입력하세요 (예: W-320호)")?.trim();
    if (!number) return;
    try {
      await fetchJSON("/api/rooms", { method: "POST", body: JSON.stringify({ number }) });
      void load();
    } catch (e) {
      alert(`생성 실패: ${(e as Error).message}`);
    }
  };

  const deleteRow = async (id: number) => {
    if (!confirm("정말 삭제할까요?")) return;
    try {
      await fetchJSON(`/api/rooms/${id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      alert(`삭제 실패: ${(e as Error).message}`);
    }
  };

  const control = async (row: Room, controlType: "open" | "close" | "status") => {
    try {
      const safeName =
        (row.name ?? "").trim() || (row.number ?? "").trim() || `관리자-${row.id}`;

      const d = await fetchJSON<{
        code: number;
        message?: string;
        state?: { lock: number; sensor: number; battery: number };
        timestamp?: string;
      }>("/api/itsokey/control", {
        method: "POST",
        headers: { "x-actor": "admin" },
        body: JSON.stringify({
          roomId: row.id,
          guestId: null,
          name: safeName,
          phone: "00000000000",
          controlType,
        }),
      });

      // ⬇ 상태 저장
      if (d.state) setLastState((prev) => ({ ...prev, [row.id]: d.state }));

      const ok = d.code === 200 || d.code === 201;
      const stateMsg = d.state
        ? `\n\n[상태]\n- 도어락: ${d.state.lock === 0 ? "잠김" : "열림"}\n- 문센서: ${
            d.state.sensor === 0 ? "닫힘" : "열림"
          }\n- 배터리: ${d.state.battery}`
        : "";

      alert(
        ok
          ? `✅ ${row.number} ${controlType} 처리: ${d.message ?? "success"}${stateMsg}`
          : `❌ ${row.number} 제어 실패: ${d.message ?? "오류"}${stateMsg}`
      );
    } catch (e) {
      alert(`제어 요청 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="admin-wrap">
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>호실 관리</h2>

          {/* 상단 필터: 객실 타입 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 16 }}>
            <span className="label" style={{ margin: 0 }}>객실 타입</span>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="">(전체 타입)</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button className="btn" onClick={() => void load()} disabled={loading}>
              새로고침
            </button>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-brown" onClick={() => void createRow()}>
              신규 호실 추가
            </button>
            <button className="btn" onClick={() => void saveAll()} disabled={loading}>
              전체 저장
            </button>
          </div>
        </div>

        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="daily-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th className="sticky-col">객실 타입</th>
                <th>호실</th>
                <th>정렬숫자</th>
                <th>표시명</th>
                <th>활성</th>
                <th>Device ID</th>
                <th>Space ID</th>
                <th>기기제어</th>
                <th>저장/삭제</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  {/* 객실 타입 */}
                  <td className="sticky-col">
                    <select
                      className="input"
                      value={r.roomType ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, roomType: e.target.value || null } : x
                          )
                        )
                      }
                      style={{ minWidth: 140 }}
                    >
                      <option value="">(미지정)</option>
                      {DEFAULT_ROOM_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>

                  {/* 호실 */}
                  <td>
                    <input
                      className="input"
                      value={r.number}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, number: e.target.value } : x))
                        )
                      }
                      style={{ minWidth: 120 }}
                    />
                  </td>

                  {/* 정렬숫자 */}
                  <td>
                    <input
                      className="input"
                      type="number"
                      value={r.numberSort ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id
                              ? {
                                  ...x,
                                  numberSort: e.target.value === "" ? null : Number(e.target.value),
                                }
                              : x
                          )
                        )
                      }
                      style={{ width: 110 }}
                    />
                  </td>

                  {/* 표시명 */}
                  <td>
                    <input
                      className="input"
                      value={r.name ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x))
                        )
                      }
                      placeholder="표시용 이름(선택)"
                    />
                  </td>

                  {/* 활성 */}
                  <td>
                    <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={r.isActive}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, isActive: e.target.checked } : x
                            )
                          )
                        }
                      />
                      <span>{r.isActive ? "활성" : "비활성"}</span>
                    </label>
                  </td>

                  {/* Device ID */}
                  <td>
                    <input
                      className="input"
                      value={r.deviceId ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, deviceId: e.target.value } : x))
                        )
                      }
                      placeholder="장치 ID"
                    />
                  </td>

                  {/* Space ID */}
                  <td>
                    <input
                      className="input"
                      value={r.spaceId ?? ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, spaceId: e.target.value } : x))
                        )
                      }
                      placeholder="공간/그룹 ID"
                    />
                  </td>

                  {/* 기기제어 */}
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button className="btn btn-brown" onClick={() => void control(r, "open")}>
                        열기
                      </button>
                      <button className="btn" onClick={() => void control(r, "close")}>
                        닫기
                      </button>
                      <button className="btn" onClick={() => void control(r, "status")}>
                        상태
                      </button>
                    </div>
                    {lastState[r.id] && (
                      <div className="muted" style={{ marginTop: 6, lineHeight: 1.3 }}>
                        <span style={{ marginRight: 8 }}>
                          도어락: <b>{lastState[r.id]!.lock === 0 ? "잠김" : "열림"}</b>
                        </span>
                        <span style={{ marginRight: 8 }}>
                          문: <b>{lastState[r.id]!.sensor === 0 ? "닫힘" : "열림"}</b>
                        </span>
                        <span>
                          배터리: <b>{lastState[r.id]!.battery}</b>
                        </span>
                      </div>
                    )}
                  </td>

                  {/* 저장/삭제 */}
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn" onClick={() => void saveRow(r)} disabled={loading}>
                        저장
                      </button>
                      <button className="btn" onClick={() => void deleteRow(r.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "#666", padding: 14 }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}