import 'dotenv/config';
import fetch from 'node-fetch';
import FormData from 'form-data';

/* ─────────────── 환경 변수 ─────────────── */
const BASE = process.env.HUMAX_API_BASE;       // https://mhp.humax-parcs.com:8755
const CONSOLE = process.env.HUMAX_CONSOLE_URL; // https://console.humax-parcs.com
const USER = process.env.HUMAX_USER;
const PASS = process.env.HUMAX_PASS;

const SITE_ID = process.env.SITE_ID || '0c677e4df5a84d0a97590ac94894007a';
const PRODUCT_ITEM_ID = process.env.PRODUCT_ITEM_ID || '68b91ff641b9513e17508606';
const PLATE = process.env.PLATE || '107너1040';
const HOLDER_NAME = process.env.HOLDER_NAME || '홍길동';
const HOLDER_PHONE = process.env.HOLDER_PHONE || '01012345678';
const FROM_AT_MS = Number(process.env.FROM_AT_MS || Date.now());
const TO_AT_MS = Number(process.env.TO_AT_MS || (Date.now() + 86400000));

/* ─────────────── 로그인 ─────────────── */
async function login() {
  const form = new FormData();
  form.append('username', USER);
  form.append('password', PASS);
  form.append('grant_type', 'password');

  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: {
      actor: 'mhp.console',
      origin: CONSOLE,
      referer: CONSOLE + '/'
    },
    body: form
  });

  const setCookie = res.headers.raw()['set-cookie'] || [];
  const cookieHeader = setCookie.map(c => c.split(';')[0]).join('; ');
  const text = await res.text();

  let json = null;
  try { json = JSON.parse(text); } catch {}

  return { status: res.status, cookieHeader, json, text };
}

/* ─────────────── 등록 요청 ─────────────── */
async function register(auth) {
  const url = `${BASE}/o.productItems.registration.vehicle.use/${SITE_ID}`;
  console.log('📡 요청 URL:', url);

  const headers = {
    'Actor': 'mhp.console',
    'Origin': CONSOLE,
    'Referer': CONSOLE + '/',
    'Content-Type': 'application/json',
  };
  if (auth.cookieHeader) headers['Cookie'] = auth.cookieHeader;
  if (auth.json?.access_token) headers['Authorization'] = `Bearer ${auth.json.access_token}`;

  const body = JSON.stringify({
    itemType: 'TERM',
    itemSubType: 'STORE_TERMS',
    productItemId: PRODUCT_ITEM_ID,
    plateNumber: PLATE,
    fromAt: FROM_AT_MS,
    toAt: TO_AT_MS,
    itemName: '호텔투숙객무료',
    useState: 'Y',
    user: {
      name: HOLDER_NAME,
      phone: HOLDER_PHONE,
      model: '',
      address: '',
      memo: ''
    }
  });

  const res = await fetch(url, { method: 'PUT', headers, body });
  const text = await res.text();

  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

/* ─────────────── 실행 ─────────────── */
(async () => {
  console.log('🔑 로그인 중...');
  const auth = await login();
  console.log('로그인 상태코드:', auth.status);

  if (auth.status !== 200) {
    console.error('❌ 로그인 실패:', auth.text);
    process.exit(1);
  }

  console.log('✅ 로그인 성공, 세션 확보됨.');
  console.log('🚗 차량 등록 요청 중...');

  const result = await register(auth);
  console.log('응답 코드:', result.status);
  console.log('응답 본문:', result.text);
})();