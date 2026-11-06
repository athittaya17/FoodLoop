/* =====================================================
   FoodLoop - ตัวช่วยกลาง (ใช้ร่วมทุกหน้า)
   - ฐานข้อมูลเก็บใน Firebase Realtime Database (ทุกเครื่องเห็นข้อมูลชุดเดียวกัน)
   - ล็อกอินด้วย Firebase Authentication, สิทธิ์เข้าถึงข้อมูลกำหนดใน database.rules.json
   - ข้อมูลตั้งต้น (ร้าน/สินค้า/บัญชีตัวอย่าง) สร้างด้วย tools/seed.js
   ===================================================== */

/* ค่าจาก Firebase console > Project settings > Your apps > firebaseConfig (ต้องมี databaseURL) */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCCwoAhxWXjDZvpTIfHrsKPgFhstIZ3bRo',
  authDomain: 'foodloop-cae98.firebaseapp.com',
  databaseURL: 'https://foodloop-cae98-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'foodloop-cae98',
  appId: '1:934221965127:web:8524bc1d879af3daac0e62'
};
firebase.initializeApp(FIREBASE_CONFIG);
const fbAuth = firebase.auth(), fbDb = firebase.database();
const DAY = 86400000;

/* ---------- ตัวช่วยเล็ก ๆ ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = n => Number(n).toLocaleString('th-TH') + ' ฿';
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = t => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/* รูปสินค้า: ถ้ามี p.img ใช้รูป ถ้าไม่มีจะเว้นว่าง */
const pic = p => p.img ? `<img src="${esc(p.img)}" alt="">` : p.name ? `<span class="initial">${esc(initial(p.name))}</span>` : '';
/* รูปร้าน: ถ้ามี s.img ใช้รูป ถ้าไม่มีใช้ตัวอักษรแรกของชื่อร้าน */
const shopPic = s => s.img ? `<img src="${esc(s.img)}" alt="">` : `<span class="initial">${esc(initial(s.name))}</span>`;
/* ช่องอัปโหลดรูป: ใช้ในฟอร์มสินค้า/ตั้งค่าร้าน รูปถูกย่อเหลือกว้าง 800px แล้วเก็บในเบราว์เซอร์ */
const imageField = (label, cur) => `
  <div class="full img-field">
    <span>${label}</span>
    <div class="img-preview" data-preview>${cur ? `<img src="${esc(cur)}" alt="">` : 'ยังไม่มีรูป'}</div>
    <input type="hidden" name="img" value="${esc(cur || '')}">
    <input type="file" accept="image/*" data-imgfile>
    <button type="button" class="link-btn" data-clearimg>ลบรูป</button>
  </div>`;
document.addEventListener('change', e => {
  const inp = e.target;
  if (!inp.hasAttribute || !inp.hasAttribute('data-imgfile') || !inp.files[0]) return;
  const box = inp.closest('.img-field'), reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 800 / im.width), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.8);
      box.querySelector('[name=img]').value = url;
      box.querySelector('[data-preview]').innerHTML = `<img src="${url}" alt="">`;
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(inp.files[0]);
});
document.addEventListener('click', e => {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-clearimg')) return;
  const box = e.target.closest('.img-field');
  box.querySelector('[name=img]').value = '';
  box.querySelector('[data-preview]').textContent = 'ยังไม่มีรูป';
});

const initial = s => String(s || '?').trim().charAt(0).toUpperCase();
const itemCount = o => o.items.reduce((a, i) => a + i.qty, 0);

/* หมวดหมู่สินค้า: แก้ชื่อ/เพิ่มหมวดได้ที่นี่ */
const CATS = { bakery: 'เบเกอรี่', dessert: 'เค้ก', cookie: 'คุกกี้', bread: 'ขนมปัง', other: 'อื่นๆ' };

/* สถานะออเดอร์ */
const STATUS = {
  reserved:  { text: 'รอรับสินค้า', cls: 'wait' },
  picked:    { text: 'รับสินค้าแล้ว', cls: 'ok' },
  cancelled: { text: 'ยกเลิก', cls: 'bad' }
};

/* ---------- ฐานข้อมูล ----------
   โครงสร้างใน Firebase (แยกตามรายการ ไม่ยัดก้อนเดียว):
     users/{uid}  shops/{id}  products/{id}  orders/{id}  reports/{id}
     notifs/{id}  carts/{uid}  audit/{id}  settings  admins/{uid}
   หน้าเว็บยังใช้ตัวแปร db (อาเรย์) เหมือนเดิม แต่ save() จะเขียนเฉพาะรายการ/ฟิลด์ที่เปลี่ยน
   และแต่ละบทบาทโหลดเฉพาะข้อมูลที่ตัวเองมีสิทธิ์อ่าน (ดู database.rules.json) */
const COLS = ['users', 'shops', 'products', 'orders', 'reports', 'notifs', 'audit'];
const SORT = { orders: 'created', notifs: 'time', reports: 'time', audit: 'time' };   // ใหม่สุดขึ้นก่อน
let db = { users: [], shops: [], products: [], orders: [], reports: [], notifs: [], audit: [], carts: {}, settings: {}, updatedAt: Date.now() };
const base = { users: {}, shops: {}, products: {}, orders: {}, reports: {}, notifs: {}, audit: {}, carts: {}, settings: {} };   // สำเนาล่าสุดที่ตรงกับเซิร์ฟเวอร์ ไว้เทียบหาส่วนที่เปลี่ยน
let ready = false;

/* JSON ที่เรียงคีย์และตัดค่าว่างทิ้ง (Firebase ไม่เก็บ array/object ว่าง) ใช้เทียบข้อมูลสองก้อนว่าเหมือนกันไหม */
const sj = v => JSON.stringify(v, (k, x) => {
  if (x && typeof x === 'object') {
    const ks = Object.keys(x);
    if (!ks.length) return undefined;
    return Array.isArray(x) ? x : Object.fromEntries(ks.sort().map(k => [k, x[k]]));
  }
  return x;
});
const clean = v => { const s = sj(v); return s === undefined ? undefined : JSON.parse(s); };
const arr = v => Array.isArray(v) ? v : v ? Object.values(v) : [];

/* รับข้อมูลจาก Firebase เข้า db คืนค่า true ถ้าข้อมูลต่างจากที่มีอยู่ (ข้อมูลที่เราเพิ่งเซฟเองจะเท่ากับ base จึงไม่ถูกโหลดซ้ำ) */
function apply(c, val) {
  if (c === 'carts') {
    const next = Object.fromEntries(Object.entries(val || {}).map(([k, v]) => [k, clean(arr(v))]));
    if (sj(next) === sj(base.carts)) return false;
    base.carts = next; db.carts = Object.fromEntries(Object.entries(next).map(([k, v]) => [k, arr(v)]));
    return true;
  }
  if (c === 'settings') {
    const next = clean(val || {}) || {};
    if (sj(next) === sj(base.settings)) return false;
    base.settings = next; db.settings = JSON.parse(JSON.stringify(next));
    return true;
  }
  const rows = Object.entries(val || {}).map(([id, v]) => ({ ...v, id }));
  if (c === 'orders') rows.forEach(o => o.items = arr(o.items));
  if (SORT[c]) rows.sort((a, b) => (b[SORT[c]] || 0) - (a[SORT[c]] || 0));
  const next = Object.fromEntries(rows.map(r => [r.id, clean(r)]));
  if (sj(next) === sj(base[c])) return false;
  base[c] = next; db[c] = rows;
  return true;
}

/* ฟังข้อมูลหนึ่งชุดแบบเรียลไทม์ resolve เมื่อได้ข้อมูลชุดแรก (หรืออ่านไม่ได้) */
function watch(c, ref, pick) {
  return new Promise(done => ref.on('value',
    snap => {
      const changed = apply(c, pick ? pick(snap.val()) : snap.val());
      done();
      if (changed && ready && window.onDbChange) window.onDbChange();
    },
    err => { console.error('อ่านข้อมูล ' + c + ' ไม่ได้:', err.message); done(); }));
}

/* โหลดข้อมูลตามบทบาทของผู้ที่ล็อกอินอยู่ */
async function loadFor(fbUser) {
  const uidv = fbUser.uid, u = (await fbDb.ref('users/' + uidv).once('value')).val();
  if (!u) { await fbAuth.signOut(); return; }                  // มีบัญชีล็อกอินแต่ไม่มีโปรไฟล์
  Auth.me = { ...u, id: uidv };
  const R = p => fbDb.ref(p), own = v => v ? { [uidv]: v } : {};
  const jobs = [watch('shops', R('shops')), watch('products', R('products')), watch('settings', R('settings'))];
  if (u.role === 'admin') {
    jobs.push(watch('users', R('users')), watch('orders', R('orders')), watch('reports', R('reports')), watch('audit', R('audit')));
  } else {
    jobs.push(watch('users', R('users/' + uidv), own));
    if (u.role === 'customer') {
      jobs.push(watch('orders', R('orders').orderByChild('userId').equalTo(uidv)),
                watch('notifs', R('notifs').orderByChild('to').equalTo(uidv)),
                watch('carts', R('carts/' + uidv), v => v ? { [uidv]: v } : {}));
    } else if (u.role === 'shop' && u.shopId) {
      jobs.push(watch('orders', R('orders').orderByChild('shopId').equalTo(u.shopId)),
                watch('notifs', R('notifs').orderByChild('to').equalTo(u.shopId)));
    }
  }
  await Promise.all(jobs);
}

const DB = {
  /* รอให้รู้สถานะล็อกอิน + โหลดข้อมูลชุดแรกก่อนเริ่มหน้า (ดู boot) หลังจากนั้นเครื่องอื่นแก้ข้อมูล หน้านี้จะอัปเดตตามเอง */
  ready: new Promise(done => {
    const off = fbAuth.onAuthStateChanged(async user => {
      off();
      try { if (user) await loadFor(user); } catch (e) { console.error(e); }
      ready = true; db.updatedAt = Date.now();
      done();
    });
  }),

  /* เขียนเฉพาะรายการ/ฟิลด์ที่เปลี่ยนไปจากเดิม (multi-path update) ไม่ทับข้อมูลที่เครื่องอื่นเพิ่งแก้ */
  save() {
    const up = {};
    COLS.forEach(c => {
      const cur = Object.fromEntries(db[c].map(r => [r.id, clean(r)])), old = base[c];
      for (const id in cur) {
        if (!old[id]) { up[c + '/' + id] = cur[id]; continue; }
        for (const f of new Set([...Object.keys(cur[id]), ...Object.keys(old[id])]))
          if (sj(cur[id][f]) !== sj(old[id][f])) up[c + '/' + id + '/' + f] = cur[id][f] ?? null;
      }
      for (const id in old) if (!cur[id]) up[c + '/' + id] = null;
      base[c] = cur;
    });
    Object.keys(db.carts).forEach(k => {
      const v = clean(db.carts[k]);
      if (sj(v) !== sj(base.carts[k])) { up['carts/' + k] = v ?? null; base.carts[k] = v; }
    });
    const cs = clean(db.settings) || {}, bs = base.settings;
    for (const f of new Set([...Object.keys(cs), ...Object.keys(bs)]))
      if (sj(cs[f]) !== sj(bs[f])) up['settings/' + f] = cs[f] ?? null;
    base.settings = cs;
    db.updatedAt = Date.now();
    if (!Object.keys(up).length) return Promise.resolve();
    return fbDb.ref().update(up).catch(e => alert('บันทึกข้อมูลไม่สำเร็จ: ' + e.message));
  },

  /* ปรับสต็อกสินค้าแบบ transaction (กันสองคนจองชิ้นสุดท้ายพร้อมกัน) delta ติดลบ = จอง, บวก = คืนสต็อก */
  async adjustStock(pid, delta) {
    const r = await fbDb.ref('products/' + pid + '/qty').transaction(q => (q || 0) + delta < 0 ? undefined : (q || 0) + delta);
    if (!r.committed) throw new Error('out-of-stock');
    const sold = await fbDb.ref('products/' + pid + '/sold').transaction(s => Math.max(0, (s || 0) - delta));
    const p = db.products.find(x => x.id === pid), b = base.products[pid];
    if (p) { p.qty = r.snapshot.val(); p.sold = sold.snapshot.val(); }
    if (b) { b.qty = r.snapshot.val(); b.sold = sold.snapshot.val(); }
    return r.snapshot.val();
  }
};
const save = () => DB.save();

/* เริ่มสคริปต์ของหน้าหลังโหลดข้อมูลเสร็จ เพราะสคริปต์ของแต่ละหน้าใช้ db ทันทีที่โหลด */
function boot(src) {
  DB.ready.then(() => { const s = document.createElement('script'); s.src = src; document.body.appendChild(s); });
}
/* true ถ้ากำลังพิมพ์/เปิดหน้าต่างอยู่ (ไม่ควรรีเฟรชหน้าทับ) */
const busy = () => !!$('.modal-bg') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

function notify(to, text) { db.notifs.unshift({ id: uid(), to, text, time: Date.now(), read: false }); }
function genCode() { let c; do { c = 'FL' + Math.floor(1000 + Math.random() * 9000); } while (db.orders.some(o => o.code === c)); return c; }
const shopById = id => db.shops.find(s => s.id === id);
const userById = id => db.users.find(u => u.id === id);

/* ---------- ระบบล็อกอิน (Firebase Authentication) ----------
   รหัสผ่านไม่อยู่ในฐานข้อมูล Firebase ดูแลให้ ข้อมูลโปรไฟล์อยู่ที่ users/{uid}
   หมายเหตุ: ล็อกอินได้ทีละบัญชีต่อเบราว์เซอร์ (สลับบทบาทต้องออกจากระบบก่อน) */
const AUTH_ERR = {
  'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'auth/invalid-login-credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'auth/wrong-password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'auth/user-not-found': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'auth/email-already-in-use': 'อีเมลนี้ถูกใช้แล้ว', 'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง', 'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  'auth/network-request-failed': 'เชื่อมต่ออินเทอร์เน็ตไม่ได้', 'auth/requires-recent-login': 'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ก่อนทำรายการนี้',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยอีเมล/รหัสผ่านใน Firebase Console'
};
const authErr = e => AUTH_ERR[e.code] || ('เกิดข้อผิดพลาด: ' + (e.message || e));

const Auth = {
  me: null,   // โปรไฟล์ของผู้ล็อกอิน (ตั้งค่าตอน DB.ready)
  cur(role) {
    const u = this.me;
    if (!u || u.role !== role) return null;
    const p = userById(u.id) || u;
    if (p.suspended) return null;                                         // บัญชีถูกระงับ = ออกจากระบบทันที
    if (role === 'shop') { const s = shopById(p.shopId); if (!s || s.status !== 'approved') return null; }
    return p;
  },
  async login(role, email, pass) {
    let c;
    try { c = await fbAuth.signInWithEmailAndPassword(email.trim(), pass); } catch (e) { return { err: authErr(e) }; }
    const fail = async err => { await fbAuth.signOut(); return { err }; };
    const u = (await fbDb.ref('users/' + c.user.uid).once('value')).val();
    if (!u || u.role !== role) return fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    if (u.suspended) return fail('บัญชีนี้ถูกระงับการใช้งาน');
    if (role === 'shop') {
      const s = (await fbDb.ref('shops/' + u.shopId).once('value')).val();
      if (!s) return fail('ไม่พบข้อมูลร้านของบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบ');
      if (s.status === 'pending')   return fail('ร้านของคุณรอผู้ดูแลระบบอนุมัติ');
      if (s.status === 'rejected')  return fail('คำขอเปิดร้านถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ');
      if (s.status === 'suspended') return fail('ร้านนี้ถูกระงับการใช้งาน');
    }
    const loginLog = [Date.now(), ...arr(u.loginLog)].slice(0, 5);        // ประวัติเข้าสู่ระบบล่าสุด 5 ครั้ง
    fbDb.ref('users/' + c.user.uid + '/loginLog').set(loginLog).catch(() => {});
    return { user: { ...u, id: c.user.uid, loginLog } };
  },
  /* สมัครบัญชีใหม่แล้วเขียนข้อมูลที่เกี่ยวข้องทีเดียว (build(uid) คืน object แบบ path -> ค่า) ถ้าเขียนไม่สำเร็จจะลบบัญชีที่เพิ่งสร้างทิ้ง */
  async register(email, pass, build) {
    let c;
    try { c = await fbAuth.createUserWithEmailAndPassword(email, pass); } catch (e) { return { err: authErr(e) }; }
    try { await fbDb.ref().update(build(c.user.uid)); }
    catch (e) { await c.user.delete().catch(() => {}); return { err: 'สมัครไม่สำเร็จ: ' + e.message }; }
    return { uid: c.user.uid };
  },
  logout(role) { fbAuth.signOut().finally(() => location.href = 'login-' + role + '.html'); },
  guard(role) { const u = this.cur(role); if (!u) { location.replace('login-' + role + '.html'); return null; } return u; }
};


/* ---------- UI: หน้าต่างป๊อปอัป / ข้อความแจ้ง ---------- */
function modal(html) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal">' + html + '</div>';
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(bg);
  return bg.firstChild;
}
/* เมนูข้างแบบขีดสามขีด (จอเล็ก) */
document.addEventListener('click', e => {
  const d = $('.dash');
  if (!d) return;
  if (e.target.closest('#menuBtn')) d.classList.toggle('menu-open');
  else if (e.target.closest('.side-bg') || e.target.closest('.sidebar [data-act]')) d.classList.remove('menu-open');
});

/* แถบบนของลูกค้า (จอเล็ก): ปุ่มขีดสามขีดเปิด/ปิดเมนูไอคอน */
document.addEventListener('click', e => {
  const bar = $('.topbar');
  if (!bar) return;
  if (e.target.closest('#navBtn')) bar.classList.toggle('nav-open');
  else if (!e.target.closest('.nav-icons') || (e.target.closest('[data-act]') && !e.target.closest('[data-act=menu]'))) bar.classList.remove('nav-open');
});

/* ถามยืนยันก่อนออกจากระบบ (กันกดพลาด) */
function confirmLogout(role) {
  const m = modal(`
    <div class="center">
      <h3>ออกจากระบบ?</h3>
      <p style="margin:6px 0 16px">คุณต้องการออกจากระบบใช่หรือไม่</p>
      <button class="btn btn-light" data-close>ยกเลิก</button>
      <button class="btn" id="logoutOk">ออกจากระบบ</button>
    </div>`);
  m.querySelector('#logoutOk').onclick = () => Auth.logout(role);
}
function closeModal() { const m = $('.modal-bg'); if (m) m.remove(); }
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function drawQR(el, text) {
  if (window.QRCode) new QRCode(el, { text, width: 180, height: 180, colorDark: '#5a3220', colorLight: '#ffffff' });
  else el.innerHTML = '<b style="font-size:28px">' + esc(text) + '</b>';
}

/* ผูกปุ่ม data-act="ชื่อ" กับฟังก์ชัน และฟอร์ม data-form="ชื่อ" */
function bind(actions, forms = {}) {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const f = actions[el.dataset.act];
    if (f) f(el.dataset, el);
  });
  document.addEventListener('submit', e => {
    const n = e.target.dataset.form;
    if (!n) return;
    e.preventDefault();
    if (forms[n]) forms[n](e.target);
  });
}

/* ---------- กราฟแท่ง (ใช้ CSS ล้วน) ---------- */
function daily(list, valFn) {
  const today = startOfDay(Date.now()), nm = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return Array.from({ length: 7 }, (_, k) => {
    const s = today - (6 - k) * DAY;
    return { label: nm[new Date(s).getDay()], value: valFn(list.filter(o => { const t = o.pickedAt || o.created; return t >= s && t < s + DAY; })) };
  });
}
function barChart(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return '<div class="chart">' + items.map(i =>
    `<div class="bar-col"><span class="bar-val">${i.value}</span><div class="bar" style="height:${i.value / max * 100}%"></div><span class="bar-lbl">${esc(i.label)}</span></div>`).join('') + '</div>';
}
function hBars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => `<div class="hbar"><span class="hbar-lbl">${esc(i.label)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${i.value / max * 100}%"></div></div><span class="hbar-val">${esc(i.text ?? i.value)}</span></div>`).join('');
}






