module.exports = {
  apps: [
    {
      name: "hotel-app",
      script: "server.js",            // Next.js 프로덕션 실행 진입점
      cwd: "/var/www/hotel-app",      // 반드시 .next 가 있는 디렉토리
      instances: 1,                   // 필요시 "max" 로 변경
      exec_mode: "fork",              // cluster 대신 fork 권장 (SSR 안정성)
      env: {
        NODE_ENV: "production",
        PORT: 3000,                   // 포트 지정
        DATABASE_URL: "file:/var/www/hotel-app/prisma/dev.db",
        BIZPPURIO_ACCOUNT: "morethanbc",  // ✅ 실제 값 반영
        BIZPPURIO_AUTH_KEY: "799330d0b6f0d14b669b82314f178158f63f45a1a9d5d1276c89a7fc1714ec88",   // ✅ 실제 키 반영
      },
    },
  ],
};