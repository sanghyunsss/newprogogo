import { chromium } from "playwright";
import "dotenv/config";

const CONSOLE_URL = process.env.HUMAX_CONSOLE_URL;
const ID = process.env.HUMAX_ID;
const PW = process.env.HUMAX_PW;

function toCurl({ url, method, headers, body }) {
  const pick = ["cookie","authorization","actor","content-type","origin","referer","x-xsrf-token"];
  const h = Object.entries(headers || {})
    .filter(([k]) => pick.includes(k.toLowerCase()))
    .map(([k,v]) => `  -H '${k}: ${v}'`)
    .join(" \\\n");
  const data = body ? ` \\\n  --data-binary '${String(body).replace(/'/g,"'\\''")}'` : "";
  return `curl -k -i '${url}' \\\n${h}${data}`;
}

(async () => {
  // headless 서버 환경
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // 로그인
  await page.goto(CONSOLE_URL, { waitUntil: "domcontentloaded" });
  const userSel = 'input[name="username"], input#username, input[type="text"]';
  const passSel = 'input[name="password"], input#password, input[type="password"]';
  const btnSel  = 'button[type="submit"], .btn-login, button.login';

  await page.waitForSelector(userSel, { timeout: 20000 });
  await page.fill(userSel, ID);
  await page.fill(passSel, PW);
  await page.click(btnSel);
  await page.waitForLoadState("networkidle", { timeout: 30000 });

  console.log("\n로그인 완료. 이제 브라우저 내부에서 발생하는 POST를 스니핑합니다.");
  console.log("관리 콘솔 화면에서 기간권 '추가/등록'을 실제로 수행하세요.");
  console.log("등록이 끝났다고 판단되면 이 터미널에서 Ctrl+C 로 종료하지 말고 Enter 를 눌러주세요.\n");

  const captured = [];
  page.on("requestfinished", async (req) => {
    try {
      const url = req.url();
      if (!url.includes("mhp.humax-parcs.com:8755")) return;
      if (req.method() !== "POST") return;

      const headers = await req.allHeaders();
      let body = "";
      try { body = JSON.stringify(req.postDataJSON()); }
      catch { body = req.postData() ?? ""; }

      captured.push({ url, method: "POST", headers, body });
      console.log("[POST 캡처] " + url);
    } catch {}
  });

  // 입력 대기
  await new Promise((r) => process.stdin.once("data", r));

  if (captured.length === 0) {
    console.error("POST가 캡처되지 않았습니다. 실제 '등록'까지 제출되었는지 확인하세요.");
    await browser.close();
    process.exit(1);
  }

  const last = captured[captured.length - 1];
  console.log("\n=== 재현용 cURL ===\n" + toCurl(last) + "\n");

  await browser.close();
})();