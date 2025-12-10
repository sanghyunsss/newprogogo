// app/page.tsx
export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f9f9f9",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "40px 30px",
          borderRadius: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "center",
          maxWidth: "420px",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "22px", marginBottom: "16px", color: "#333" }}>
          모어댄속초 해변점 이용가이드
        </h1>
        <p style={{ fontSize: "15px", marginBottom: "28px", color: "#555", lineHeight: "1.6" }}>
          안녕하세요, 모어댄속초 해변점을 방문해주셔서 감사합니다.<br />
          객실 예약은 <b>홈페이지 바로가기</b> 버튼을,<br />
          문의는 <b>1661-5512</b> 버튼을 눌러주세요.
        </p>

        {/* 버튼 영역 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <a
            href="https://bc.morethansc.co.kr"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "14px 0",
              background: "#a4825f",
              color: "#fff",
              borderRadius: "8px",
              fontWeight: "bold",
              textDecoration: "none",
              fontSize: "16px",
              transition: "background 0.2s",
            }}
          >
            홈페이지 바로가기
          </a>
          <a
            href="tel:16615512"
            style={{
              display: "block",
              padding: "14px 0",
              background: "#e5e7eb",
              color: "#111",
              borderRadius: "8px",
              fontWeight: "bold",
              textDecoration: "none",
              fontSize: "16px",
              transition: "background 0.2s",
            }}
          >
            문의전화 1661-5512
          </a>
        </div>
      </div>
    </div>
  );
}