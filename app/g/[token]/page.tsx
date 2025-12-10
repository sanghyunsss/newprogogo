// app/g/[token]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { FiCopy } from "react-icons/fi";

/* ======================== 상수 ======================== */
const ADDRESS = "강원특별자치도 속초시 해오름로 201";
const PLACE_NAME = "모어댄속초해변점";
const PLACE_NAMEK = "모어댄 속초해변점";

const WIFI_SSID = "투숙하신 호실명";
const WIFI_PASSWORD = "morethansc1";

/* ======================== 유틸 ======================== */
function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

const GOOGLE_WEB = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  ADDRESS,
)}`;

const NAVER_APP = `nmap://search?query=${encodeURIComponent(PLACE_NAME)}`;
const NAVER_WEB = `https://map.naver.com/v5/search/${encodeURIComponent(
  PLACE_NAME,
)}`;
function openNaverMap() {
  const t = Date.now();
  window.location.href = NAVER_APP;
  setTimeout(() => {
    if (Date.now() - t < 1500) window.location.href = NAVER_WEB;
  }, 1200);
}

const KAKAO_APP = `kakaomap://search?q=${encodeURIComponent(PLACE_NAME)}`;
const KAKAO_WEB_TO = `https://map.kakao.com/link/to/${encodeURIComponent(
  PLACE_NAMEK,
)}`;
function openKakaoMap() {
  if (isIos() || isAndroid()) {
    const t = Date.now();
    window.location.href = KAKAO_APP;
    setTimeout(() => {
      if (Date.now() - t < 1500) window.location.href = KAKAO_WEB_TO;
    }, 1200);
  } else {
    window.open(KAKAO_WEB_TO, "_blank");
  }
}

async function errorText(r: Response) {
  try {
    const j = await r.json();
    if (j && typeof j === "object" && "error" in j) {
      const msg = (j as { error?: unknown }).error;
      if (typeof msg === "string" && msg) return `HTTP ${r.status} - ${msg}`;
    }
  } catch {}
  return `HTTP ${r.status}`;
}

/* ======================== 타입 ======================== */
type GuestInfo = {
  id: number;
  roomId: number;
  room: { number: string };
  roomType?: string | null;
  name: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  contact?: string | null;
};
type Actual = {
  checkinDate: string | null;
  checkinTime: string | null;
  checkoutDate: string | null;
  checkoutTime: string | null;
};
type GuestGetResponse = {
  guest: GuestInfo;
  actual: Actual | null;
  checkedIn: boolean;
  checkedOut: boolean;
  carNo?: string | null;
};
type Action = "checkin" | "checkout";
type LangCode = "ko" | "en" | "ja" | "zh-CN";

/* ======================== 컴포넌트 ======================== */
export default function GuestPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [info, setInfo] = useState<GuestInfo | null>(null);
  const [actual, setActual] = useState<Actual | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [carNo, setCarNo] = useState<string>("");
  const [showCarModal, setShowCarModal] = useState(false);
  const [carNoInput, setCarNoInput] = useState("");

  const [controlMsg, setControlMsg] = useState<string>("");
  const [controlPending, setControlPending] = useState<
    null | "open" | "close" | "status"
  >(null);
  const [notice, setNotice] = useState<string>("");
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [lang, setLang] = useState<LangCode>("ko");

  const safeTime = (t: string | undefined, fb: string) =>
    t && /^\d{2}:\d{2}$/.test(t) ? t : fb;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/guest/by-token/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (r.status === 403) {
        alert("링크가 만료되었거나 유효하지 않습니다.");
        setInfo(null);
        setActual(null);
        setCheckedIn(false);
        setCheckedOut(false);
        setCarNo("");
        return;
      }
      if (!r.ok) throw new Error(await errorText(r));
      const d: GuestGetResponse = await r.json();
      setInfo(d.guest);
      setActual(d.actual ?? null);
      setCheckedIn(d.checkedIn);
      setCheckedOut(d.checkedOut);
      if (typeof d.carNo === "string") setCarNo(d.carNo);
    } catch {
      alert("링크가 만료되었거나 유효하지 않습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  type ActionResp = {
    success: boolean;
    action: "checkin" | "checkout";
    checkedIn: boolean;
    checkedOut: boolean;
    actual?: Actual;
  };

  const doAction = async (action: Action) => {
    if (!info || busy) return;
    if (action === "checkout" && checkedOut) return;

    if (action === "checkin") {
      const inTime = safeTime(info.startTime, "15:00");
      const checkinStart = new Date(`${info.startDate}T${inTime}:00`);
      if (new Date() < checkinStart) {
        alert("체크인 시간 이후에 체크인이 가능합니다.");
        return;
      }
    }

    if (
      !confirm(
        action === "checkin"
          ? "체크인 하시겠습니까?"
          : "체크아웃 하시겠습니까?",
      )
    )
      return;

    setBusy(true);
    try {
      const r = await fetch(`/api/r/${info.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error(await errorText(r));
      const d: ActionResp = await r.json();

      setCheckedIn(d.checkedIn);
      setCheckedOut(d.checkedOut);
      if (d.actual) setActual(d.actual);

      alert(
        action === "checkin"
          ? "체크인이 완료되었습니다."
          : "체크아웃이 완료되었습니다.",
      );
    } catch {
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const pressDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "#111";
    e.currentTarget.style.color = "#fff";
  };
  const pressUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "#f3f4f6";
    e.currentTarget.style.color = "#111";
  };

  const control = async (type: "open" | "close" | "status") => {
    if (!info || busy || controlPending) return;
    setBusy(true);
    setControlMsg("");
    setControlPending(type);
    try {
      const phone = (info.contact ?? "").replace(/[^0-9]/g, "");
      const r = await fetch("/api/itsokey/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-actor": "guest",
        },
        body: JSON.stringify({
          roomId: info.roomId,
          guestId: info.id,
          name: info.name,
          phone,
          controlType: type,
        }),
      });
      const data = (await r.json()) as { code?: number; message?: string };
      if (r.ok && (data.code === 200 || data.code === 201)) {
        if (type === "open") setControlMsg("문열기에 성공하였습니다.");
        if (type === "close") setControlMsg("문닫기에 성공하였습니다.");
        if (type === "status") setShowStatusModal(true);
      } else {
        setControlMsg(`실패: ${data.message ?? "오류"}`);
      }
    } catch {
      setControlMsg("요청 실패");
    } finally {
      setBusy(false);
      setTimeout(() => setControlMsg(""), 3000);
      setControlPending(null);
    }
  };

  const saveCarNo = async () => {
    if (!info) return;
    const next = carNoInput.replace(/\s+/g, "").toUpperCase();
    if (!next) {
      alert("차량번호를 입력하세요.");
      return;
    }
    const valid = /^\d{2,3}[가-힣]\d{4}$/.test(next);
    if (!valid) {
      alert("차량번호 형식이 올바르지 않습니다.\n예: 12가3456 또는 123가4567");
      return;
    }
    try {
      const r = await fetch(`/api/guest/${info.id}/car`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carNo: next }),
      });
      if (!r.ok) throw new Error(await errorText(r));
      setCarNo(next);
      alert("주차등록이 완료되었습니다.\n※ 등록 후 수정은 불가합니다.");
      setShowCarModal(false);
    } catch {
      alert("주차등록에 실패했습니다.");
    }
  };

  if (loading) return <div className="page-root">불러오는 중…</div>;
  if (!info) return <div className="page-root">정보를 찾을 수 없습니다.</div>;

  const inTime = safeTime(info.startTime, "15:00");
  const outTime = safeTime(info.endTime, "11:00");
  const roomTypeText =
    (info.roomType ?? "").trim() || "객실 타입 정보 없음";

  const start = new Date(`${info.startDate}T${inTime}:00`);
  const end = new Date(`${info.endDate}T${outTime}:00`);
  const canControlTime = new Date() >= start && new Date() <= end;
  const showControl = checkedIn && !checkedOut && canControlTime;

  const controlWindowText = `${info.startDate.replaceAll(
    "-",
    ".",
  )} ${inTime} ~ ${info.endDate.replaceAll("-", ".")} ${outTime}`;
  const hasCar = !!carNo;

  const t = (k: string) => {
    const dict: Record<string, Record<LangCode, string>> = {
      title: {
        ko: "모어댄 | 속초해변점",
        en: "MORETHAN | Sokcho Beach",
        ja: "モアザン | 束草ビーチ",
        "zh-CN": "MORETHAN | 束草海滩",
      },
      roomInfo: {
        ko: "객실 정보",
        en: "Room Info",
        ja: "客室情報",
        "zh-CN": "客房信息",
      },
      roomType: {
        ko: "객실 타입",
        en: "Room Type",
        ja: "部屋タイプ",
        "zh-CN": "房型",
      },
      room: { ko: "객실", en: "Room", ja: "部屋", "zh-CN": "房间" },
      guest: {
        ko: "예약자",
        en: "Guest",
        ja: "予約者",
        "zh-CN": "预订人",
      },
      checkIn: {
        ko: "체크인",
        en: "Check-in",
        ja: "チェックイン",
        "zh-CN": "入住",
      },
      checkOut: {
        ko: "체크아웃",
        en: "Check-out",
        ja: "チェックアウト",
        "zh-CN": "退房",
      },
      parking: {
        ko: "주차등록",
        en: "Parking Registration",
        ja: "駐車登録",
        "zh-CN": "停车登记",
      },
      noCar: {
        ko: "등록된 차량번호가 없습니다.",
        en: "No car number registered.",
        ja: "登録された車両番号はありません。",
        "zh-CN": "未登记车牌号。",
      },
      register: { ko: "등록", en: "Register", ja: "登録", "zh-CN": "登记" },
      noCarBtn: {
        ko: "차량없음",
        en: "No Car",
        ja: "車なし",
        "zh-CN": "无车辆",
      },
      done: {
        ko: "체크아웃 완료",
        en: "Checked out",
        ja: "チェックアウト完了",
        "zh-CN": "已退房",
      },
      keyCtrl: {
        ko: "객실 키 제어",
        en: "Room Key Control",
        ja: "客室キー制御",
        "zh-CN": "房卡控制",
      },
      open: { ko: "열기", en: "Open", ja: "開く", "zh-CN": "开启" },
      close: { ko: "닫기", en: "Close", ja: "閉じる", "zh-CN": "关闭" },
      status: { ko: "상태", en: "Status", ja: "状態", "zh-CN": "状态" },
      wifiTitle: {
        ko: "WIFI 이용정보안내",
        en: "WIFI Information",
        ja: "WIFIご案内",
        "zh-CN": "WIFI 使用信息",
      },
      wifiSsid: {
        ko: "WIFI SSID :",
        en: "WIFI SSID :",
        ja: "WIFI SSID :",
        "zh-CN": "WIFI SSID：",
      },
      wifiPw: {
        ko: "PASSWORD :",
        en: "PASSWORD :",
        ja: "PASSWORD :",
        "zh-CN": "密码：",
      },
      contact: {
        ko: "문의전화",
        en: "Contact",
        ja: "お問い合わせ",
        "zh-CN": "咨询电话",
      },
      guide: {
        ko: "이용가이드",
        en: "User Guide",
        ja: "利用ガイド",
        "zh-CN": "使用指南",
      },
      checkinHint: {
        ko: "체크인을 완료하시면 객실 키 제어 버튼이 나타납니다.",
        en: "Key control appears after check-in.",
        ja: "チェックイン後にキー制御が表示されます。",
        "zh-CN": "入住后将显示房卡控制。",
      },
    };
    return dict[k]?.[lang] ?? dict[k]?.ko ?? k;
  };

  return (
    <div className="page-root">
      <div className="container">
        {/* 언어 버튼 */}
        <div className="lang-bar">
          <button
            className={`lang-chip ${lang === "ko" ? "on" : ""}`}
            onClick={() => setLang("ko")}
          >
            한국어
          </button>
          <button
            className={`lang-chip ${lang === "en" ? "on" : ""}`}
            onClick={() => setLang("en")}
          >
            English
          </button>
          <button
            className={`lang-chip ${lang === "ja" ? "on" : ""}`}
            onClick={() => setLang("ja")}
          >
            日本語
          </button>
          <button
            className={`lang-chip ${lang === "zh-CN" ? "on" : ""}`}
            onClick={() => setLang("zh-CN")}
          >
            中文
          </button>
        </div>

        {/* 헤더 / 주소 */}
        <div className="section">
          <div className="card">
            <div style={{ color: "#777", fontSize: 16, marginBottom: 4 }}>
              {t("title")}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                color: "#555",
                fontSize: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: 18 }}>📍</span>
                <span>{ADDRESS}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="icon-btn"
                  onClick={() => navigator.clipboard?.writeText?.(ADDRESS)}
                  title="주소 복사"
                >
                  <FiCopy />
                </button>
                <a
                  className="icon-btn"
                  href={GOOGLE_WEB}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span style={{ fontWeight: "bold" }}>G</span>
                </a>
                <button
                  className="icon-btn"
                  onClick={openNaverMap}
                  title="네이버지도"
                >
                  <span style={{ fontWeight: "bold" }}>N</span>
                </button>
                <button
                  className="icon-btn"
                  onClick={openKakaoMap}
                  title="카카오맵"
                >
                  <span style={{ fontWeight: "bold" }}>K</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 객실 정보 */}
        <section className="section">
          <div className="section-title">객실 정보</div>

          <div className="card" style={{ marginBottom: 10 }}>
            <div className="label">{t("roomType")}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{roomTypeText}</div>
          </div>

          <div className="card two-col">
            <div>
              <div className="label">{t("room")}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {info.room.number}
              </div>
            </div>
            <div>
              <div className="label">{t("guest")}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{info.name}</div>
            </div>
          </div>
        </section>

        {/* 체크인/아웃 시간 */}
        <section className="section">
          <div className="two-col">
            <div className="card">
              <div className="label">{t("checkIn")}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {info.startDate.replaceAll("-", ".")}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {inTime}
              </div>
            </div>
            <div className="card">
              <div className="label">{t("checkOut")}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {info.endDate.replaceAll("-", ".")}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {outTime}
              </div>
            </div>
          </div>
        </section>

        {/* 주차등록 */}
        <section className="section">
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                color: hasCar ? "#111" : "#999",
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {hasCar ? `등록 차량: ${carNo}` : t("noCar")}
            </div>

            {!hasCar && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setCarNoInput("");
                    setShowCarModal(true);
                  }}
                >
                  {t("register")}
                </button>

                <button
                  className="btn btn-ghost"
                  style={{ color: "red" }}
                  onClick={async () => {
                    if (
                      !confirm(
                        "차량이 없음을 등록하시겠습니까?\n※ 등록 후 수정은 불가합니다.",
                      )
                    )
                      return;
                    try {
                      const r = await fetch(`/api/guest/${info.id}/car`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ carNo: "차량없음" }),
                      });
                      if (!r.ok) throw new Error(await errorText(r));
                      setCarNo("차량없음");
                      alert(
                        "차량없음으로 등록되었습니다.\n※ 등록 후 수정은 불가합니다.",
                      );
                    } catch {
                      alert("등록에 실패했습니다.");
                    }
                  }}
                >
                  {t("noCarBtn")}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 체크인/아웃 버튼 + 안내 */}
        <section className="section">
          {!checkedOut ? (
            <>
              <button
                className="btn btn-primary"
                style={{
                  width: "100%",
                  padding: "14px 0",
                  fontSize: 17,
                  background: "#a4825f",
                  color: "#fff",
                  borderRadius: 14,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                disabled={busy}
                onClick={() =>
                  void doAction(checkedIn ? "checkout" : "checkin")
                }
              >
                {checkedIn ? t("checkOut") : t("checkIn")}
              </button>
              {!checkedIn && (
                <div
                  className="muted"
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  {t("checkinHint")}
                </div>
              )}
            </>
          ) : (
            <div
              className="card"
              style={{
                textAlign: "center",
                fontSize: 16,
              }}
            >
              {t("done")}
            </div>
          )}
        </section>

        {/* 객실 제어 */}
        {showControl && (
          <section className="section">
            <div className="section-title">객실 키 제어</div>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>
              객실 키를 원격으로 제어할 수 있습니다. 열림·닫힘 버튼을 눌러
              편리하게 이용해 주세요.
            </p>

            <div
              className="card"
              style={{ display: "flex", gap: 8, padding: 10, marginTop: 4 }}
            >
              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  textAlign: "center",
                  background: "#f3f4f6",
                  color: "#111",
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                disabled={busy || !!controlPending}
                aria-busy={controlPending === "open"}
                onMouseDown={pressDown}
                onMouseUp={pressUp}
                onClick={() => void control("open")}
              >
                {controlPending === "open"
                  ? "문을 여는 중입니다."
                  : t("open")}
              </button>

              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 10,
                  textAlign: "center",
                  background: "#f3f4f6",
                  color: "#111",
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                disabled={busy || !!controlPending}
                aria-busy={controlPending === "close"}
                onMouseDown={pressDown}
                onMouseUp={pressUp}
                onClick={() => void control("close")}
              >
                {controlPending === "close"
                  ? "문을 닫는 중입니다."
                  : t("close")}
              </button>
            </div>

            <div
              className="card"
              style={{ marginTop: 8, padding: 10 }}
            >
              <button
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 10,
                  textAlign: "center",
                  background: "#f3f4f6",
                  color: "#111",
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                }}
                disabled={busy || !!controlPending}
                aria-busy={controlPending === "status"}
                onMouseDown={pressDown}
                onMouseUp={pressUp}
                onClick={() => void control("status")}
              >
                {controlPending === "status"
                  ? "상태를 확인 중입니다."
                  : t("status")}
              </button>
            </div>

            {notice && (
              <div
                className="card"
                style={{
                  marginTop: 8,
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                {notice}
              </div>
            )}
            {controlMsg && (
              <div
                className="card"
                style={{
                  marginTop: 8,
                  color: "#374151",
                  textAlign: "center",
                  fontSize: 13,
                }}
              >
                {controlMsg}
              </div>
            )}
          </section>
        )}

        {/* 실제 시각 요약 */}
        {actual && (actual.checkinTime || actual.checkoutTime) && (
          <section className="section">
            <div className="card" style={{ color: "#666", fontSize: 12 }}>
              실입실 {actual.checkinDate ?? ""} {actual.checkinTime ?? ""} /
              실퇴실 {actual.checkoutDate ?? ""} {actual.checkoutTime ?? ""}
            </div>
          </section>
        )}

        {/* 카카오톡 문의 + WIFI */}
        {checkedIn && !checkedOut && (
          <>
            <section className="section">
              <a
                href="http://pf.kakao.com/_xjmBxmn/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="kakao-contact"
              >
                <div className="kakao-inner">
                  <div className="kakao-bubble">
                    <span className="kakao-talk-text">TALK</span>
                  </div>
                  <div className="kakao-text-block">
                    <span className="kakao-text-line">카카오톡</span>
                    <span className="kakao-text-line">문의하기</span>
                  </div>
                </div>
                <p className="kakao-desc">
                  리뷰이벤트 영수증 요청, 어메니티 구입, 타올·생수 추가 구입 등 객실
                  이용 관련 문의를 카카오톡으로 편리하게 남겨주세요.
                </p>
              </a>
            </section>

            <section className="section">
              <div className="card wifi-card">
                <div className="wifi-title">{t("wifiTitle")}</div>
                <div className="wifi-grid">
                  <div className="wifi-label">{t("wifiSsid")}</div>
                  <div>
                    {info?.room?.number?.replace(/호$/, "") ?? WIFI_SSID}
                  </div>
                  <div className="wifi-label">{t("wifiPw")}</div>
                  <div>{WIFI_PASSWORD}</div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* 상태 확인 모달 */}
        {showStatusModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowStatusModal(false)}
          >
            <div
              className="card"
              style={{
                width: "88%",
                maxWidth: 360,
                background: "#ffffff",
                borderRadius: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: 8, fontSize: 16, color: "#111827" }}>
                제어 가능 시간
              </h3>
              <div style={{ color: "#374151", fontWeight: 600, fontSize: 14 }}>
                {controlWindowText}
              </div>
              <button
                className="btn"
                style={{
                  marginTop: 12,
                  width: "100%",
                  fontSize: 14,
                  borderRadius: 10,
                }}
                onClick={() => setShowStatusModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 차량번호 입력 모달 */}
        {showCarModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
            onClick={() => setShowCarModal(false)}
          >
            <div
              className="card"
              style={{
                width: "88%",
                maxWidth: 360,
                background: "#fff",
                borderRadius: 14,
                padding: 18,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: 8, fontSize: 16 }}>차량번호 등록</h3>
              <p style={{ fontSize: 13 }}>
                차량번호를 입력해 주세요 (예: 12가3456).
              </p>
              <p
                style={{
                  color: "red",
                  fontWeight: 600,
                  marginTop: 6,
                  fontSize: 12,
                }}
              >
                등록이 완료된 이후에는 변경할 수 없습니다.
              </p>
              <input
                className="input"
                placeholder="12가3456"
                value={carNoInput}
                onChange={(e) =>
                  setCarNoInput(e.target.value.replace(/\s+/g, ""))
                }
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn"
                  style={{ fontSize: 14, borderRadius: 10 }}
                  onClick={() => setShowCarModal(false)}
                >
                  취소
                </button>
                <button
                  className="btn btn-brown"
                  style={{ fontSize: 14, borderRadius: 10 }}
                  onClick={saveCarNo}
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 문의/가이드 */}
        <section className="section">
          <div className="card contact-row">
            <a className="contact-box" href="tel:16615512">
              <div className="title">{t("contact")}</div>
              <div className="value tel">1661-5512</div>
            </a>
            <a
              className="contact-box"
              href="https://bc.morethansc.co.kr/guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="title">{t("guide")}</div>
              <div className="value url">bc.morethansc.co.kr/guide</div>
            </a>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page-root {
          background: #ffffff;
          min-height: 100vh;
        }
        .container {
          max-width: 480px;
          margin: 0 auto;
          padding: 12px 12px 32px;
        }
        .section {
          margin: 12px 0;
        }
        .section-title {
          font-weight: 700;
          margin-bottom: 6px;
          font-size: 13px;
          color: #6b7280;
        }
        .card {
          border: 1px solid #ececec;
          border-radius: 16px;
          padding: 12px;
          background: #ffffff;
        }
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .label {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .icon-btn {
          border: 1px solid #e8e8e8;
          border-radius: 10px;
          padding: 8px;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn {
          border: 1px solid #ddd;
          border-radius: 12px;
          padding: 9px 12px;
          background: #f7f7f7;
          font-size: 15px;
        }
        .btn-ghost {
          background: #fff;
        }
        .btn-brown {
          background: #a4825f;
          color: #fff;
          border-color: #a4825f;
        }
        .btn-primary {
          background: #a4825f;
          color: #fff;
          border-color: #a4825f;
        }
        .muted {
          color: #888;
        }

        .contact-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 10px;
        }
        .contact-box {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 4px;
          padding: 10px 12px;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          background: #fff;
          text-decoration: none;
          color: inherit;
          min-height: 52px;
        }
        .title {
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
        }
        .value {
          font-weight: 700;
          color: #a4825f;
          white-space: nowrap;
          max-width: 100%;
        }
        .value.url {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .value.tel {
          font-size: 16px;
        }

        /* 언어 버튼 바 */
        .lang-bar {
          position: sticky;
          top: 0;
          z-index: 60;
          background: #ffffff;
          padding: 6px 0 4px;
          display: flex;
          gap: 6px;
          overflow-x: auto;
        }
        .lang-chip {
          border: 1px solid #ddd;
          border-radius: 999px;
          padding: 5px 10px;
          background: #f9f9f9;
          font-size: 12px;
          white-space: nowrap;
        }
        .lang-chip.on {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        /* 카카오톡 문의 버튼 */
        .kakao-contact {
          display: block;
          background: #fee500;
          border-radius: 18px;
          border: 1px solid #f1d400;
          text-decoration: none;
          padding: 14px 14px 10px;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
        }
        .kakao-inner {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;
        }
        .kakao-bubble {
          position: relative;
          width: 52px;
          height: 38px;
          border-radius: 22px;
          background: #381e1f;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kakao-bubble::after {
          content: "";
          position: absolute;
          bottom: -7px;
          left: 18px;
          border-width: 8px 7px 0 0;
          border-style: solid;
          border-color: #381e1f transparent transparent transparent;
        }
        .kakao-talk-text {
          color: #fee500;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 0.08em;
        }
        .kakao-text-block {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
          color: #3b1e1e;
          font-weight: 800;
          font-size: 16px;
        }
        .kakao-text-line + .kakao-text-line {
          margin-top: 2px;
        }
        .kakao-desc {
          margin-top: 25px;
          font-size: 12px;
          line-height: 1.4;
          color: #4b2b2b;
        }

        /* WIFI 카드 */
        .wifi-card {
          color: #fff;
          background: #472929;
          text-align: center;
          padding: 18px 14px;
          border-radius: 18px;
          border: none;
        }
        .wifi-title {
          font-weight: 800;
          font-size: 18px;
          margin-bottom: 8px;
        }
        .wifi-grid {
          display: grid;
          grid-template-columns: auto auto;
          justify-content: center;
          gap: 6px 14px;
          font-size: 14px;
        }
        .wifi-label {
          font-weight: 400;
        }

        @media (max-width: 360px) {
          .two-col {
            grid-template-columns: 1fr;
          }
          .contact-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}