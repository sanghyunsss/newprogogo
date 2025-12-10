import 'dotenv/config';
import fetch from 'node-fetch';
import FormData from 'form-data';

const BASE = process.env.HUMAX_API_BASE;
const CONSOLE = process.env.HUMAX_CONSOLE_URL;
const USER = process.env.HUMAX_USER;
const PASS = process.env.HUMAX_PASS;

if (!BASE || !CONSOLE || !USER || !PASS) {
  console.error('환경변수 HUMAX_API_BASE, HUMAX_CONSOLE_URL, HUMAX_USER, HUMAX_PASS 필요');
  process.exit(1);
}

// 등록용 데이터 (env 또는 기본값)
const SITE_ID = process.env.SITE_ID;
const STORE_ID = process.env.STORE_ID;
const USER_ID = process.env.USER_ID;
const PRODUCT_ITEM_ID = process.env.PRODUCT_ITEM_ID;

const PLATE = process.env.PLATE;
const FROM_AT_MS = Number(process.env.FROM_AT_MS || 0);
const TO_AT_MS = Number(process.env.TO_AT_MS || 0);
const HOLDER_NAME = process.env.HOLDER_NAME || '';
const HOLDER_PHONE = process.env.HOLDER_PHONE || '';

async function login() {
  // form-data based auth (복사된 POST 구조 재현)
  const form = new FormData();
  form.append('username', USER);
  form.append('password', PASS);
  form.append('grant_type', 'password');

  const url = `${BASE}/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      actor: 'mhp.console',
      origin: CONSOLE,
      referer: CONSOLE + '/'
    },
    body: form
  });

  // 쿠키 우선 취득
  const sc = res.headers.raw()['set-cookie'] || [];
  const cookieHeader = sc.map(c => c.split(';')[0]).join('; ');

  let bodyText = await res.text();
  let json = null;
  try { json = JSON.parse(bodyText); } catch {}

  // 반환: { cookieHeader, json }
  return { cookieHeader: cookieHeader || null, json, status: res.status, text: bodyText };
}

function makeAdhocPayload(siteId, storeId, userId, dataObj) {
  return {
    path: "stores.productItems.use.insert",
    siteId,
    storeId,
    userId,
    data: dataObj
  };
}

async function sendRegister(auth) {
  // payload object inferred from 조회 예시
  const dataObj = {
    siteId: SITE_ID,
    productItemId: PRODUCT_ITEM_ID,
    plateNumber: PLATE,
    fromAt: FROM_AT_MS,
    toAt: TO_AT_MS,
    itemType: "TERM",
    itemSubType: "STORE_TERMS",
    itemName: "AUTO_REG",
    useState: "Y",
    user: {
      name: HOLDER_NAME,
      phone: HOLDER_PHONE,
      model: "",
      address: "",
      memo: ""
    }
  };

  // 1) adhoc 방식(대부분 SPA가 이 경로를 사용)
  const ts = Date.now();
  const adhocUrl = `${BASE}/o.mhp.zeroproblem.core.adhoc?ts=${ts}`;
  const body = makeAdhocPayload(SITE_ID, STORE_ID, USER_ID, dataObj);

  const headers = {
    'Content-Type': 'application/json',
    'Origin': CONSOLE,
    'Referer': CONSOLE + '/'
  };
  if (auth.cookieHeader) headers['Cookie'] = auth.cookieHeader;
  if (auth.json && auth.json.access_token) headers['Authorization'] = `Bearer ${auth.json.access_token}`;

  const res = await fetch(adhocUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}

  return { status: res.status, text, json };
}

(async () => {
  console.log('로그인 시도...');
  const auth = await login();
  console.log('login status:', auth.status);
  if (auth.cookieHeader) console.log('쿠키 획득 OK');
  else console.log('쿠키 없음. 응답 본문 확인 필요.');

  // 안전 점검
  if (auth.status >= 400) {
    console.error('로그인 실패. 응답:', auth.text || auth.json);
    process.exit(1);
  }

  // 등록 시도
  console.log('등록 요청 전송...');
  const out = await sendRegister(auth);
  console.log('등록 응답 상태:', out.status);
  console.log(out.text);

  // 성공이면 조회로 확인 권장
  process.exit(0);
})();