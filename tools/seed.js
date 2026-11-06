/* =====================================================
   FoodLoop - สร้างบัญชีทดลอง + ข้อมูลตั้งต้น ใน Firebase
   วิธีใช้ (ทำก่อนเปลี่ยน Rules เป็นแบบปลอดภัย เพราะสคริปต์นี้เขียนแบบไม่ล็อกอิน):
     1) Firebase Console > Authentication > Sign-in method > เปิด "Email/Password"
     2) node tools/seed.js
     3) วาง database.rules.json ลงใน Realtime Database > Rules แล้วกด Publish
   รันซ้ำได้ (บัญชีที่มีแล้วจะถูกใช้ต่อ ข้อมูลตัวอย่างจะถูกเขียนทับด้วยค่าเริ่มต้น)
   ===================================================== */
const API_KEY = 'AIzaSyCCwoAhxWXjDZvpTIfHrsKPgFhstIZ3bRo';
const DB_URL = 'https://foodloop-cae98-default-rtdb.asia-southeast1.firebasedatabase.app';
const DAY = 86400000;

/* รหัสผ่านต้องยาวอย่างน้อย 6 ตัว (ข้อกำหนดของ Firebase Auth) */
const PW = { customer: '123456', shop: '123456', admin: 'admin123' };
const ACCOUNTS = [
  { key: 'u1', role: 'customer', name: 'สมใจ ดีมาก',  email: 'customer@demo.com', phone: '081-234-5678' },
  { key: 'u4', role: 'customer', name: 'มานี รักกิน', email: 'mani@demo.com',     phone: '089-111-2222' },
  { key: 'u2', role: 'shop', name: 'คุณสมชาย',  email: 'shop@demo.com',   shopId: 's1' },
  { key: 'u5', role: 'shop', name: 'คุณสุดา',   email: 'sweet@demo.com',  shopId: 's2' },
  { key: 'u6', role: 'shop', name: 'คุณวิชัย',  email: 'baan@demo.com',   shopId: 's3' },
  { key: 'u7', role: 'shop', name: 'คุณมินตรา', email: 'mellow@demo.com', shopId: 's4' },
  { key: 'u9', role: 'admin', name: 'ผู้ดูแลระบบ', email: 'admin@demo.com' }
];

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json() };
}
async function getUid(a) {
  const body = { email: a.email, password: PW[a.role], returnSecureToken: true };
  let r = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, body);
  if (r.ok) return r.data.localId;
  const msg = r.data.error && r.data.error.message;
  if (msg === 'EMAIL_EXISTS') {
    r = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, body);
    if (r.ok) return r.data.localId;
    throw new Error(`${a.email}: มีบัญชีนี้อยู่แล้วแต่รหัสผ่านไม่ตรงกับที่สคริปต์ตั้งไว้`);
  }
  if (msg === 'OPERATION_NOT_ALLOWED') throw new Error('ยังไม่ได้เปิด Email/Password ใน Firebase Console > Authentication > Sign-in method');
  throw new Error(`${a.email}: ${msg}`);
}

function sampleData(uidOf) {
  const now = Date.now();
  const shops = [
    { id: 's1', name: 'The Hill Bakery',   img: 'images/shop-hill.jpg',  rating: 4.8, reviews: 120, dist: 1.2, status: 'approved', tag: 'ยอดนิยม', pickup: '17:00 - 19:00', address: '123 ถ.สุขุมวิท กรุงเทพฯ', open: true },
    { id: 's2', name: 'Sweet Home Bakery', img: 'images/shop-sweet.jpg', rating: 4.7, reviews: 98,  dist: 2.5, status: 'approved', tag: 'แนะนำ',   pickup: '18:00 - 20:00', address: '45 ถ.ลาดพร้าว กรุงเทพฯ', open: true },
    { id: 's3', name: 'Baan Khanom Pang',  img: 'images/shop-baan.jpg',  rating: 4.6, reviews: 75,  dist: 3.1, status: 'approved', tag: '',        pickup: '16:30 - 18:30', address: '9 ถ.พหลโยธิน กรุงเทพฯ', open: true },
    { id: 's4', name: 'Cafe Mellow', rating: 0, reviews: 0, dist: 4.0, status: 'pending', tag: '', pickup: '17:00 - 19:00', address: '77 ถ.รัชดา กรุงเทพฯ', open: true }
  ];
  const products = [
    { id: 'p1', shopId: 's1', name: 'ครัวซองต์เนยสด',   img: 'images/croissant.jpg',      cat: 'bakery',  price: 45,  orig: 90,  qty: 18 },
    { id: 'p2', shopId: 's1', name: 'เค้กช็อกโกแลต',    img: 'images/chocolate-cake.jpg', cat: 'dessert', price: 120, orig: 240, qty: 6 },
    { id: 'p7', shopId: 's1', name: 'คุกกี้ช็อกชิป',     img: 'images/cookie.jpg',         cat: 'cookie',  price: 25,  orig: 45,  qty: 20 },
    { id: 'p3', shopId: 's2', name: 'คัพเค้กวานิลลา',   img: 'images/cupcake.jpg',        cat: 'dessert', price: 55,  orig: 85,  qty: 12 },
    { id: 'p4', shopId: 's2', name: 'บราวนี่ช็อกโกแลต', img: 'images/brownie.jpg',        cat: 'dessert', price: 40,  orig: 65,  qty: 15 },
    { id: 'p8', shopId: 's2', name: 'โดนัทน้ำตาล',      img: 'images/donut.jpg',          cat: 'other',   price: 25,  orig: 40,  qty: 14 },
    { id: 'p5', shopId: 's3', name: 'ขนมปังไส้ครีม',    img: 'images/cream-bun.jpg',      cat: 'bread',   price: 35,  orig: 55,  qty: 20 },
    { id: 'p6', shopId: 's3', name: 'ขนมปังโฮลวีท',     img: 'images/wholewheat.jpg',     cat: 'bread',   price: 30,  orig: 50,  qty: 10 }
  ];
  const names = { u1: 'สมใจ ดีมาก', u4: 'มานี รักกิน' };
  const orders = []; let n = 0;
  for (let d = 1; d <= 6; d++) for (let k = 0; k < (d % 3) + 2; k++) {
    const sid = ['s1', 's2', 's3'][(d + k) % 3];
    const ps = products.filter(p => p.shopId === sid);
    const p = ps[(d + k) % ps.length], q = (k % 3) + 1, ukey = k % 2 ? 'u4' : 'u1';
    p.sold = (p.sold || 0) + q;
    orders.push({ id: 'o' + (++n), code: 'FL' + (1000 + n), userId: uidOf[ukey], userName: names[ukey], shopId: sid,
      items: [{ pid: p.id, name: p.name, cat: p.cat, price: p.price, qty: q }],
      total: p.price * q, pay: 'ชำระที่ร้าน', status: 'picked', created: now - d * DAY - k * 3600000, pickedAt: now - d * DAY });
  }
  const reports = [{ id: 'r1', orderId: orders[2].id, userId: orders[2].userId, shopId: orders[2].shopId, text: 'ขนมที่ได้รับไม่ตรงกับที่จอง', status: 'open', time: now - 3600000 }];
  return { shops, products, orders, reports };
}

(async () => {
  const uidOf = {};
  for (const a of ACCOUNTS) { uidOf[a.key] = await getUid(a); console.log('บัญชี', a.email, '->', uidOf[a.key]); }

  const { shops, products, orders, reports } = sampleData(uidOf);
  const up = {};                                       // multi-path update: ไม่แตะข้อมูลอื่นที่มีอยู่ (เช่นลูกค้าที่สมัครเอง)
  for (const a of ACCOUNTS) {
    const { key, ...profile } = a;
    up['users/' + uidOf[key]] = { id: uidOf[key], ...profile };
  }
  up['admins/' + uidOf.u9] = true;
  for (const [col, rows] of Object.entries({ shops, products, orders, reports })) rows.forEach(r => up[col + '/' + r.id] = r);
  up['settings/allowShopSignup'] = true;

  const r = await fetch(DB_URL + '/.json', { method: 'PATCH', body: JSON.stringify(up) });
  if (!r.ok) throw new Error('เขียนฐานข้อมูลไม่สำเร็จ (' + r.status + '): ' + await r.text() + '\nRules ต้องยังเปิดเขียนได้ระหว่างรัน seed');
  console.log('\nเสร็จแล้ว บัญชีทดลอง:');
  ACCOUNTS.forEach(a => console.log(' ', a.role.padEnd(8), a.email.padEnd(20), PW[a.role]));
  console.log('\nต่อไป: วาง database.rules.json ใน Realtime Database > Rules แล้ว Publish');
})().catch(e => { console.error('ผิดพลาด:', e.message); process.exit(1); });
