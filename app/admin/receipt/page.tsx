// app/admin/receipt/page.tsx
"use client";

import { useEffect, useState } from "react";

type Biz = { number: string; owner: string; name: string; tel: string; addr: string };

export default function ReceiptGeneratorPage() {
  const [biz, setBiz] = useState<Biz>({
    number: "010-6421-5512",
    owner: "권혜숙",
    name: "모어댄속초해변점",
    tel: "1661-5512",
    addr: "강원도 속초시 해오름로 201",
  });
  const [htmlA, setHtmlA] = useState("");
  const [htmlB, setHtmlB] = useState("");

  // ---- 유틸 ----
  const cardNames = [
    "KB국민카드",
    "신한카드",
    "삼성카드",
    "현대카드",
    "BC카드",
    "롯데카드",
    "우리카드",
    "하나카드",
    "NH농협카드",
    "우체국체크",
  ];
  const acquirers = ["KB국민", "신한", "삼성", "현대", "BC", "롯데", "우리", "하나", "NH농협"];
  const entryType = "전자매입";
  const tradeName = "IC 승인 일시불";

  function rint(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function choice<T>(a: T[]) {
    return a[rint(0, a.length - 1)];
  }
  function pad(n: number, w: number) {
    return String(n).padStart(w, "0");
  }
  function won(n: number) {
    return n.toLocaleString("ko-KR");
  }
  function randomAmount() {
    return rint(100, 200) * 1000;
  }
  function randomCardNumber() {
    const last4 = pad(rint(0, 9999), 4);
    const first4 = pad(rint(4000, 9999), 4);
    const mid2 = pad(rint(10, 99), 2);
    return `${first4}-${mid2}**-****-${last4}`;
  }
  function randomMerchantId() {
    const len = rint(10, 15);
    let s = "";
    for (let i = 0; i < len; i++) s += rint(0, 9);
    return s;
  }
  function randomApproval() {
    const len = rint(6, 10);
    let s = "";
    for (let i = 0; i < len; i++) s += rint(0, 9);
    return s;
  }
  function nowKST() {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const parts = new Intl.DateTimeFormat("ko-KR", opts).formatToParts(new Date());
    const m: Record<string, string> = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}.${m.month}.${m.day} ${m.hour}:${m.minute}:${m.second}`;
  }

  function renderOne(): string {
    const card = choice(cardNames);
    const acq = choice(acquirers);
    const amt = randomAmount();
    const vat = Math.round(amt * 0.1);
    const sum = amt + vat;
    return `
      <h2 style="font-size:18px;margin:0 0 2px">신용카드 매출전표 (고객용)</h2>
      <div style="color:#6b7280;font-size:12px;white-space:pre-line">${biz.name} · 문의 ${biz.tel}\n${biz.addr}</div>
      <div class="hr"></div>
      <table class="kvs">
        <tr><td class="k">사업자No</td><td class="v mono">${biz.number}</td></tr>
        <tr><td class="k">대표자</td><td class="v">${biz.owner}</td></tr>
        <tr><td class="k">가맹점명</td><td class="v">${biz.name}</td></tr>
        <tr><td class="k">문의전화</td><td class="v mono">${biz.tel}</td></tr>
        <tr><td class="k">카드명</td><td class="v">${card}</td></tr>
        <tr><td class="k">카드번호</td><td class="v mono">${randomCardNumber()}</td></tr>
        <tr><td class="k">매입사</td><td class="v">${acq}</td></tr>
        <tr><td class="k">거래일시</td><td class="v mono">${nowKST()}</td></tr>
        <tr><td class="k">전표구분</td><td class="v">${entryType}</td></tr>
        <tr><td class="k">거래명</td><td class="v">${tradeName}</td></tr>
      </table>
      <div class="hr"></div>
      <div class="sum mono">
        <div class="row"><span>금액</span><span>${won(amt)}원</span></div>
        <div class="row"><span>부가세(10%)</span><span>${won(vat)}원</span></div>
        <div class="row total"><span>합계</span><span>${won(sum)}원</span></div>
      </div>
      <div class="hr"></div>
      <table class="kvs">
        <tr><td class="k">승인</td><td class="v mono">${randomApproval()}</td></tr>
        <tr><td class="k">가맹점번호</td><td class="v mono">${randomMerchantId()}</td></tr>
      </table>
      <div style="color:#6b7280;font-size:12px;margin-top:12px">전표구분: ${entryType} · 본 전표는 리뷰·테스트 용으로 생성됨</div>
    `;
  }

  function regenerate() {
    setHtmlA(renderOne());
    setHtmlB(renderOne());
  }

  useEffect(() => {
    regenerate();
  }, []);

  return (
    <section className="card" style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>카드영수증 생성기</h1>
      <p style={{ color: "#6b7280", marginTop: 6 }}>리뷰·테스트용 전표를 무작위 규칙으로 생성</p>

      {/* 입력 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 6,
          marginTop: 12,
        }}
      >
        <input
          className="input"
          placeholder="사업자번호"
          value={biz.number}
          onChange={e => setBiz({ ...biz, number: e.target.value })}
        />
        <input
          className="input"
          placeholder="대표자"
          value={biz.owner}
          onChange={e => setBiz({ ...biz, owner: e.target.value })}
        />
        <input
          className="input"
          placeholder="가맹점명"
          value={biz.name}
          onChange={e => setBiz({ ...biz, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="문의전화"
          value={biz.tel}
          onChange={e => setBiz({ ...biz, tel: e.target.value })}
        />
        <input
          className="input"
          placeholder="주소"
          value={biz.addr}
          onChange={e => setBiz({ ...biz, addr: e.target.value })}
        />
      </div>

      {/* 버튼 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <button className="btn" onClick={regenerate}>
          적용
        </button>
        <button className="btn" onClick={regenerate}>
          새 영수증 생성
        </button>
        <button className="btn" onClick={() => window.print()}>
          인쇄
        </button>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          금액 100,000~200,000원(1,000원 단위), 부가세 10%, 합계=금액+부가세
        </span>
      </div>

      {/* 미리보기 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 12,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
          <div className="pad" style={{ padding: 18 }}>
            <ReceiptStyles />
            <div dangerouslySetInnerHTML={{ __html: htmlA }} />
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
          <div className="pad" style={{ padding: 18 }}>
            <ReceiptStyles />
            <div dangerouslySetInnerHTML={{ __html: htmlB }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReceiptStyles() {
  return (
    <style>{`
      .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
      .hr{border-top:1px dashed #d1d5db;margin:12px 0}
      .kvs{width:100%;border-collapse:collapse;font-size:14px}
      .kvs td{padding:6px 0;vertical-align:top}
      .kvs td.k{color:#374151;width:96px}
      .sum{font-size:15px}
      .sum .row{display:flex;justify-content:space-between;margin:6px 0}
      .sum .row.total{font-weight:700;font-size:16px}
    `}</style>
  );
}