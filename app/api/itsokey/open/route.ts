// app/api/itsokey/open/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { itsokeyPost } from "@/src/lib/itsokey";

/**
 * 바디 예시:
 * { "room": "W-320", "command": "open" }
 * 업체 API 스펙에 맞게 path/payload 수정.
 */
export async function POST(req: NextRequest) {
  try {
    const { room, command } = await req.json();
    if (!room || !command) {
      return NextResponse.json({ error: "room, command required" }, { status: 400 });
    }

    // 업체 엔드포인트 예시. 실제 스펙에 맞게 수정하세요.
    // 예: POST /devices/open  { roomId: "W-320" }
    const result = await itsokeyPost("/devices/open", { roomId: room, cmd: command });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("itsokey open error:", e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}