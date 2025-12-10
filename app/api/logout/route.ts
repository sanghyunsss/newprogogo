// app/api/logout/route.ts  (사용자 로그아웃)
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "user_session",
    value: "",
    path: "/",
    maxAge: 0,
  });
  return res;
}