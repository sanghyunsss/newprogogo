// server.js (Socket.IO 제거 + 불필요한 커스텀 서버 제거)
// Next.js 기본 실행만 지원하는 최소 실행 스크립트

require("dotenv").config();
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  require("http")
    .createServer((req, res) => {
      // /healthz 헬스체크 유지 (원하면 삭제해도 됨)
      if (req.url === "/healthz") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        return;
      }

      handle(req, res);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port} (dev=${dev})`);
    });
});