"use client";

export default function DonePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const type = searchParams?.type === "checkout" ? "checkout" : "checkin";
  const msg = type === "checkin" ? "체크인이 완료되었습니다." : "체크아웃이 완료되었습니다.";

  return (
    <div style={{ maxWidth: 560, margin: "32px auto", padding: 16, lineHeight: 1.5, textAlign: "center" }}>
      <h1 style={{ marginBottom: 12 }}>{msg}</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>
        이용해 주셔서 감사합니다.
      </p>
      <button onClick={() => window.close()}>창 닫기</button>
    </div>
  );
}