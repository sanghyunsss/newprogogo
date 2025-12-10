// app/worker/cleaning/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import WorkerCleaningClient from "./page.client";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>로딩…</div>}>
      <WorkerCleaningClient />
    </Suspense>
  );
}