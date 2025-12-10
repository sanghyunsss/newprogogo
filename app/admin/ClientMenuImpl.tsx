"use client";

import NavLink from "@/components/NavLink";

export default function ClientMenuImpl() {
  return (
    <>
      <NavLink href="/admin" exact>대시보드</NavLink>
      <NavLink href="/admin/rooms">객실관리</NavLink>
      <NavLink href="/admin/bookings">예약관리</NavLink>
      <NavLink href="/admin/guests">손님명부</NavLink>
      <NavLink href="/admin/settings">설정</NavLink>
    </>
  );
}