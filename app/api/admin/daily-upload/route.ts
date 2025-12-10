import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";

/* -------- Types -------- */
type UploadRow = {
  객실타입?: string;
  호실?: string;           // 예: "P동 433호"
  입실일시?: string | number;
  퇴실일시?: string | number;
  예약자명?: string;
  연락처?: string;
};
type UploadError = { row: number; reason: string };

const pad = (n: number) => String(n).padStart(2, "0");

/* -------- Canonical helpers -------- */
/** 하이픈류 통일 → '-', 공백 제거, 대문자. '호'는 유지. */
function canonicalKeepHo(s: string): string {
  return String(s || "")
    .replace(/[‐-‒–—―]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** 엑셀 값용: '동' → '-' 변환. '호'는 유지. 그 외는 canonical 처리. */
function normalizeExcelRoom(raw: string): string {
  const replaced = String(raw || "").replace(/동/gi, "-");
  return canonicalKeepHo(replaced); // 예: "P-433호"
}

/** DB 값용: DB에 저장된 number를 canonical 키로. */
function normalizeDbRoom(raw: string): string {
  return canonicalKeepHo(raw);
}

/* -------- Date helpers -------- */
/** Excel serial or string -> "YYYY-MM-DDTHH:mm" */
function toIsoLocal(v: string | number | undefined | null, fallbackTime = "00:00"): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v as number);
    const js = new Date(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, d.S ?? 0);
    return `${js.getFullYear()}-${pad(js.getMonth() + 1)}-${pad(js.getDate())}T${pad(js.getHours())}:${pad(
      js.getMinutes()
    )}`;
  }
  const s = String(v).trim().replace(/[./]/g, "-").replace("T", " ");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const time = m[4] ? `${m[4]}:${m[5]}` : fallbackTime;
    return `${m[1]}-${m[2]}-${m[3]}T${time}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }
  return "";
}

/* -------- Route -------- */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<UploadRow>(ws, { defval: "", raw: false });

    // ■ DB 호실 맵
    const roomRows = await prisma.room.findMany({ select: { id: true, number: true } });
    const roomMap = new Map<string, number>();
    for (const r of roomRows) {
      const dbKey = normalizeDbRoom(r.number);      // "P-433호"
      roomMap.set(dbKey, r.id);
      roomMap.set(dbKey.replace(/-/g, ""), r.id);   // "P433호"도 허용
    }

    const errors: UploadError[] = [];
    let created = 0;

    // 업로드 파일 내부 중복 체크 키
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // 1) 컬럼 매핑
      const roomType = String(r.객실타입 ?? "").trim();
      const roomLabelRaw = String(r.호실 ?? "").trim(); // 선택값
      const startIso = toIsoLocal(r.입실일시, "15:00");
      const endIso = toIsoLocal(r.퇴실일시, "11:00");
      const name = String(r.예약자명 ?? "").trim();
      const contact = String(r.연락처 ?? "").trim();    // 선택값

      // 2) 필수값 검증 (요구사항 기준): 객실타입, 예약자명, 입실일, 퇴실일
      if (!roomType || !name || !startIso || !endIso) {
        errors.push({ row: i + 2, reason: "필수값 누락" });
        continue;
      }

      // 3) 호실 매핑 (입력된 경우에만 시도)
      let roomId: number | null = null;
      if (roomLabelRaw) {
        const excelKey = normalizeExcelRoom(roomLabelRaw);      // "P-433호"
        const excelKeyNoHyphen = excelKey.replace(/-/g, "");    // "P433호"
        roomId = roomMap.get(excelKey) ?? roomMap.get(excelKeyNoHyphen) ?? null;
        if (!roomId) {
          errors.push({ row: i + 2, reason: `호실 매칭 실패(${roomLabelRaw})` });
          continue;
        }
      }

      // 4) 파일 내 중복 키: roomId는 없을 수 있으니 'null'로 표기
      const key = `${roomType}|${roomId ?? "null"}|${startIso}|${endIso}|${name}|${contact || ""}`;
      if (seen.has(key)) {
        errors.push({ row: i + 2, reason: "중복(파일 내)" });
        continue;
      }
      seen.add(key);

      // 5) DB 중복 검사(동일 기준)
      const exists = await prisma.dailyGuest.findFirst({
        where: {
          roomType,
          roomId: roomId ?? undefined,
          startDate: new Date(startIso),
          endDate: new Date(endIso),
          name,
          contact: contact || "", // 빈문자 허용
        },
        select: { id: true },
      });
      if (exists) {
        errors.push({ row: i + 2, reason: "중복(DB)" });
        continue;
      }

      // 6) 저장
      await prisma.dailyGuest.create({
        data: {
          roomType,
          roomId: roomId ?? undefined,
          startDate: new Date(startIso),
          endDate: new Date(endIso),
          name,
          contact: contact || "",
          carNo: "",
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, failed: errors.length, errors });
  } catch (e) {
    console.error("daily-upload error", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}