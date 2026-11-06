/* =====================================================
   FoodLoop - ล็อกอิน / สมัครสมาชิก (ใช้ร่วม 3 บทบาท)
   บทบาทอ่านจาก <body data-role="customer|shop|admin">
   ===================================================== */
const role = document.body.dataset.role;
const HOME = { customer: 'customer-home.html', shop: 'shop-home.html', admin: 'admin-home.html' };
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // ผู้ใช้ตั้งค่าลดการเคลื่อนไหว

if (Auth.cur(role)) location.replace(HOME[role]);
else intro();

const loginBox = $('#loginBox'), regBox = $('#regBox');
const msg = (el, text, ok) => { el.textContent = text; el.classList.toggle('ok-msg', !!ok); };

/* ---------- ลูกเล่น ---------- */
/* เปิดแอพ: splash ครั้งแรกของ session แล้วการ์ดค่อยเลื่อนเข้า */
function intro() {
  /* เอา class ออกเมื่อเล่นจบ กันแอนิเมชันเล่นซ้ำตอนสลับกล่อง ล็อกอิน/สมัคร */
  const cardIn = () => { document.body.classList.add('intro'); setTimeout(() => document.body.classList.remove('intro'), 1600); };
  let seen = true;
  try { seen = !!sessionStorage.getItem('foodloop_splash'); sessionStorage.setItem('foodloop_splash', '1'); } catch (e) {}
  if (seen || calm) return cardIn();

  const s = document.createElement('div');
  s.className = 'splash';
  s.innerHTML = `
    <div class="splash-logo"><img class="splash-icon" src="images/logo-icon.png" alt=""></div>
    <img class="splash-text" src="images/logo-text.png" alt="FoodLoop">
    <p>"อร่อยได้...ไม่ต้องทิ้ง"</p>
    <div class="splash-bar"><i></i></div>`;
  document.body.appendChild(s);
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    s.classList.add('out');
    cardIn();
    setTimeout(() => s.remove(), 500);
  };
  s.addEventListener('click', end);                       // แตะเพื่อข้าม
  setTimeout(end, 2000);
}

/* เล่นแอนิเมชันซ้ำได้ทุกครั้ง (ลบ class แล้วบังคับ reflow ก่อนใส่ใหม่) */
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
const shake = el => replay(el, 'shake');

function btnLoading(btn, on, text) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; }
  else btn.textContent = btn.dataset.label;
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

/* ล็อกอินสำเร็จ: วงกลมขยายเต็มจอ + เครื่องหมายถูก แล้วค่อยไปหน้าหลัก */
function playSuccess(name, href) {
  if (calm) return location.href = href;
  const o = document.createElement('div');
  o.className = 'login-success';
  o.innerHTML = `
    <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>
    <h3>ยินดีต้อนรับ</h3>
    <p>${esc(name)}</p>`;
  document.body.appendChild(o);
  setTimeout(() => location.href = href, 1500);
}

/* สลับระหว่างเข้าสู่ระบบ <-> สมัครสมาชิก */
document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => {
  const reg = b.dataset.show === 'reg';
  loginBox.hidden = reg;
  if (regBox) regBox.hidden = !reg;
  replay(reg ? regBox : loginBox, 'swap-in');
}));

/* เข้าสู่ระบบ */
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('.btn');
  msg($('#loginErr'), '');
  btnLoading(btn, true, 'กำลังเข้าสู่ระบบ...');
  setTimeout(() => {
    const r = Auth.login(role, f.email.value, f.pass.value);
    if (r.err) { btnLoading(btn, false); shake($('.login-card')); return msg($('#loginErr'), r.err); }
    playSuccess(r.user.name, HOME[role]);
  }, calm ? 0 : 600);
});

/* สมัครสมาชิก */
const regForm = $('#regForm');
if (regForm) regForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, email = f.email.value.trim();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) { shake($('.login-card')); return msg($('#regErr'), 'อีเมลนี้ถูกใช้แล้ว'); }
  if (f.pass.value.length < 4) { shake($('.login-card')); return msg($('#regErr'), 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร'); }

  if (role === 'customer') {
    const u = { id: uid(), role, name: f.name.value.trim(), email, pass: f.pass.value, phone: f.phone.value.trim() };
    db.users.push(u); save();
    Auth.login(role, email, f.pass.value);
    playSuccess(u.name, HOME[role]);
  } else if (role === 'shop') {
    if ((db.settings || {}).allowShopSignup === false) { shake($('.login-card')); return msg($('#regErr'), 'ขณะนี้ปิดรับสมัครร้านค้าใหม่ชั่วคราว'); }
    const s = { id: uid(), name: f.shopName.value.trim(), rating: 0, reviews: 0, dist: 1, status: 'pending', tag: '',
      pickup: '17:00 - 19:00', address: f.address.value.trim(), open: true };
    db.shops.push(s);
    db.users.push({ id: uid(), role, name: f.name.value.trim(), email, pass: f.pass.value, shopId: s.id });
    notify('admin', 'ร้านใหม่ "' + s.name + '" สมัครเข้าร่วม รอการอนุมัติ');
    save();
    f.reset();
    regBox.hidden = true; loginBox.hidden = false;
    replay(loginBox, 'swap-in');
    msg($('#loginErr'), 'สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติร้านค้า', true);
  }
});
