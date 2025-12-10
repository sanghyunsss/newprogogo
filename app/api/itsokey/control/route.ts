// app/api/itsokey/control/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";

type ControlType = "open" | "close" | "status";

interface ControlRequest {
  roomId: number;
  guestId?: number;
  name: string;
  phone: string;
  controlType: ControlType;
}

interface ItsokeyResponse {
  code: number; // 200: 성공, 201: 문 열림으로 close 실패, 그 외: 실패
  message: string; // "success" | "door is open and cannot be locked" | 기타
  timestamp?: string; // 응답 완료 시간
  state?: {
    lock: number; // 0: 잠김, 1: 열림
    sensor: number; // 0: 닫힘, 1: 열림
    battery: number; // 0: 부족, 100: 정상
  };
}

const ACCESS_KEY = process.env.ITSOKEY_ACCESS_KEY ?? "";
const SECRET = process.env.ITSOKEY_SECRET ?? "";
const API_HOST = (process.env.ITSOKEY_BASE ?? "https://admin.itsokey.kr").replace(/\/+$/, "");
const API_URI = "/api/device/control.do";

function makeSignature(ts: string) {
  const msg = `POST ${API_URI}\n${ts}\n${ACCESS_KEY}`;
  return crypto.createHmac("sha256", SECRET).update(msg).digest("base64");
}
const summarize = (s: string, n = 140) => s.replace(/\s+/g, " ").slice(0, n);

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ControlRequest;

  // 요청자 판별: 헤더 힌트 우선 → 없으면 쿠키로 추론
  const hint = req.headers.get("x-actor"); // "admin" | "guest"
  let actor: "admin" | "guest" | "system";
  let actorName: string | null = null;

  if (hint === "guest") {
    actor = "guest";
    actorName = body.name ?? null;
  } else if (hint === "admin") {
    actor = "admin";
    actorName = req.headers.get("x-admin-email") ?? "admin";
  } else {
    const adminSession = req.cookies.get("admin_session")?.value;
    actor = adminSession ? "admin" : body.guestId ? "guest" : "system";
    actorName = actor === "admin" ? (req.headers.get("x-admin-email") ?? "admin") : (body.name ?? null);
  }

  const room = await prisma.room.findUnique({ where: { id: body.roomId } });
  const roomNumber = room?.number ?? String(body.roomId);
  const deviceId = room?.deviceId ?? null;
  const spaceId = room?.spaceId ?? null;

  // 장치 식별값 누락
  if (!deviceId || !spaceId) {
    const msg = !deviceId ? "deviceId 없음" : "spaceId 없음";
    await prisma.deviceControlLog.create({
      data: {
        roomId: body.roomId,
        guestId: body.guestId ?? null,
        roomNumber,
        controlType: body.controlType,
        status: "fail",
        message: msg,
        requestBody: body as unknown as Prisma.InputJsonValue,
        responseBody: { message: msg } as unknown as Prisma.InputJsonValue,
        actor,
        actorName,
      },
    });
    return NextResponse.json({ code: 400, message: `❌ ${roomNumber} 제어 실패: ${msg}` }, { status: 400 });
  }

  const ts = Date.now().toString();
  const signature = makeSignature(ts);

  const payload = {
    deviceId,
    name: body.name,
    phone: body.phone.replace(/\D/g, ""),
    controlType: body.controlType,
  };

  try {
    const resp = await fetch(`${API_HOST}${API_URI}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "itsokey-api-timestamp": ts,
        "itsokey-api-access-key": ACCESS_KEY,
        "itsokey-api-signature": signature,
        "itsokey-api-space": String(spaceId),
      },
      body: JSON.stringify(payload),
    });

    const ct = resp.headers.get("content-type") || "";
    const raw = await resp.text();

    let data: ItsokeyResponse = { code: resp.status, message: summarize(raw || resp.statusText) };
    let jsonParsed = false;
    if (ct.includes("application/json")) {
      try {
        data = JSON.parse(raw) as ItsokeyResponse;
        jsonParsed = true;
      } catch {
        // JSON 파싱 실패 시 data는 위의 기본값 유지
      }
    }

    // 프런트(UI)가 201도 별도 처리하는 로직이 있으므로 여기선 200/201 모두 success로 간주
    const success = resp.ok && jsonParsed && (data.code === 200 || data.code === 201);

    // 프런트로 전달할 최종 객체 (state/timestamp 그대로 포함)
    const out: ItsokeyResponse = {
      code: data?.code ?? resp.status,
      message: data?.message ?? summarize(raw || resp.statusText),
      timestamp: data?.timestamp,
      state: data?.state,
    };

    // 로그 적재 (state/timestamp 포함 저장)
    await prisma.deviceControlLog.create({
      data: {
        roomId: body.roomId,
        guestId: body.guestId ?? null,
        roomNumber,
        controlType: body.controlType,
        status: success ? "success" : "fail",
        message: `${out.message} (http:${resp.status}${jsonParsed ? "" : " non-json"})`,
        requestBody: payload as unknown as Prisma.InputJsonValue,
        responseBody: out as unknown as Prisma.InputJsonValue,
        actor,
        actorName,
      },
    });

    // 최종 응답
    return NextResponse.json(out, { status: success ? 200 : 502 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.deviceControlLog.create({
      data: {
        roomId: body.roomId,
        guestId: body.guestId ?? null,
        roomNumber,
        controlType: body.controlType,
        status: "fail",
        message: msg,
        requestBody: payload as unknown as Prisma.InputJsonValue,
        responseBody: { error: msg } as unknown as Prisma.InputJsonValue,
        actor,
        actorName,
      },
    });
    return NextResponse.json({ code: 500, message: `❌ ${roomNumber} 제어 실패: ${msg}` }, { status: 500 });
  }
}