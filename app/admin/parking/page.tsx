// app/admin/parking/page.tsx  ← 서버 컴포넌트(프리렌더 설정 보관)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import ParkingClient from "./ParkingClient";

export default function Page() {
  return <ParkingClient />;
}