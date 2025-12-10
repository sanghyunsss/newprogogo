#!/bin/bash
API_HOST="https://admin.itsokey.kr"
API_URI="/api/device/control.do"

# === 환경 변수 (이미 export 되어 있다면 생략 가능) ===
ITSOKEY_ACCESS_KEY="SICPBM4DoUvHd33ZDcfe"
ITSOKEY_SECRET_KEY="IT6IP25lChLhcHX1a62gGIj2D058ESwt6dhMQa29"
ITSOKEY_SPACE="주식회사 모어덴속초"

# === 타임스탬프 (밀리초) ===
TS=$(date +%s%3N)

# === StringToSign (3줄) ===
MSG=$'POST '"$API_URI"$'\n'"$TS"$'\n'"$ITSOKEY_ACCESS_KEY"

# === 시그니처 생성 ===
SIG=$(printf "%s" "$MSG" \
  | openssl dgst -sha256 -hmac "$ITSOKEY_SECRET_KEY" -binary \
  | base64)

echo "==== MSG (서명 원문) ===="
echo "$MSG"
echo "==== SIG (HMAC 결과) ===="
echo "$SIG"
echo "========================"

# === 요청 실행 ===
curl -v "$API_HOST$API_URI" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "itsokey-api-timestamp: $TS" \
  -H "itsokey-api-access-key: $ITSOKEY_ACCESS_KEY" \
  -H "itsokey-api-space: $ITSOKEY_SPACE" \
  -H "itsokey-api-signature: $SIG" \
  --data-binary '{
    "deviceId":"rT0kqNAh6N7AjDFpom0Kcw==",
    "name":"테스트",
    "phone":"01012341234",
    "controlType":"open"
  }'