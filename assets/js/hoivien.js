/* Đăng ký hội viên + đóng hội phí qua VietQR */
(() => {
  const C = window.HHSR_CONFIG || {};
  const card = document.getElementById('hvcard');
  if (!card) return;
  const $ = (s, r = document) => r.querySelector(s);
  const reg = $('#hvReg'), pay = $('#hvPay'), done = $('#hvDone');
  const tabs = [...card.querySelectorAll('.hvcard__tabs button')], pill = $('.hvcard__pill', card);
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  const bankReady = !!(C.bank && C.bank.id && C.bank.account);
  const hasGsap = typeof gsap !== 'undefined';

  /* ---------- tabs ---------- */
  function movePill(b) { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft - 6}px)`; }
  function show(t) {
    tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t));
    movePill(tabs.find(b => b.dataset.t === t));
    const regDone = reg.dataset.sent === '1';
    reg.hidden = !(t === 'dk' && !regDone);
    done.hidden = !(t === 'dk' && regDone);
    pay.hidden = t !== 'phi';
    const vis = [reg, done, pay].find(e => !e.hidden);
    if (hasGsap) gsap.fromTo(vis, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power3.out' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  tabs.forEach(b => b.addEventListener('click', () => show(b.dataset.t)));
  requestAnimationFrame(() => movePill(tabs[0]));
  window.addEventListener('resize', () => movePill(tabs.find(b => b.classList.contains('on'))));

  /* ---------- org fields ---------- */
  const lblTen = $('[data-lbl-ten]', reg), orgOnly = $('.org-only', reg);
  function syncType() {
    const v = reg.loai.value, org = v === 'htx' || v === 'doanh_nghiep';
    lblTen.textContent = org ? 'Tên tổ chức *' : 'Họ và tên *';
    orgOnly.style.display = org ? '' : 'none';
    reg.nguoi_dai_dien.required = org;
  }
  reg.addEventListener('change', e => { if (e.target.name === 'loai') syncType(); });
  syncType();

  /* ---------- backend: Cloudflare Worker + D1 ---------- */
  async function api(path, body) {
    const base = (C.api || '').replace(/\/$/, '');
    if (!base) throw new Error('offline');
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'http ' + r.status);
    return d;
  }
  const offlineMsg = () => `Kênh trực tuyến đang được kích hoạt. Vui lòng gọi Hiệp hội qua số ${C.hotline || '094 188 82 39'} để được hỗ trợ.`;
  function msg(form, text, ok) { const m = $('.hvform__msg', form); m.textContent = text; m.className = 'hvform__msg ' + (ok ? 'ok' : 'err'); }
  function busy(form, on) { const b = $('.hvform__go', form); b.disabled = on; b.classList.toggle('is-busy', on); }

  /* ---------- register ---------- */
  reg.addEventListener('submit', async e => {
    e.preventDefault();
    if (reg.website.value) return; // bot
    reg.classList.add('tried');
    if (!reg.checkValidity()) {
      const bad = reg.querySelector(':invalid');
      msg(reg, bad && bad.name === 'dien_thoai' ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' : bad && bad.name === 'dong_y' ? 'Vui lòng đồng ý để Hiệp hội lưu thông tin đăng ký.' : 'Vui lòng điền đủ các mục có dấu *.');
      bad && bad.focus(); return;
    }
    const f = new FormData(reg);
    const row = {
      loai: f.get('loai'), ho_ten: f.get('ho_ten').trim(), nguoi_dai_dien: (f.get('nguoi_dai_dien') || '').trim() || null,
      dien_thoai: f.get('dien_thoai').trim(), email: (f.get('email') || '').trim() || null,
      xa_phuong: f.get('xa_phuong').trim(), dien_tich_ha: f.get('dien_tich_ha') ? Number(f.get('dien_tich_ha')) : null,
      nhu_cau: f.getAll('nhu_cau'), dong_y: true
    };
    busy(reg, true); msg(reg, 'Đang gửi…', true);
    try {
      const { ma_ho_so: code } = await api('/api/dang-ky', { ...row, website: reg.website.value });
      reg.dataset.sent = '1'; msg(reg, '', true);
      $('#hvCode').textContent = code;
      pay.ma_ho_so.value = code; updateQr();
      show('dk');
      if (hasGsap) gsap.from('.hvdone__ic', { scale: 0, rotate: -90, duration: .8, ease: 'back.out(2)' });
    } catch (err) {
      msg(reg, err.message === 'offline' ? offlineMsg() : 'Chưa gửi được, vui lòng thử lại sau ít phút.');
    } finally { busy(reg, false); }
  });
  $('#hvToPay').addEventListener('click', () => show('phi'));

  /* ---------- pay ---------- */
  const yearSel = $('#hvYear'), feeSel = $('#hvFee'), y0 = new Date().getFullYear();
  [y0, y0 + 1].forEach(y => yearSel.add(new Option(y, y)));
  if (C.fees && C.fees.length) C.fees.forEach(fe => feeSel.add(new Option(`${fe.label} · ${fmt(fe.amount)}`, fe.id)));
  else $('#hvFeeWrap').style.display = 'none';
  $('#hvBank').textContent = bankReady ? (C.bank.name || C.bank.id) : 'Đang cập nhật';
  $('#hvAcc').textContent = bankReady ? C.bank.account : 'Đang cập nhật';
  $('#hvName').textContent = bankReady ? (C.bank.holder || '') : 'Đang cập nhật';

  const fee = () => (C.fees || []).find(x => x.id === feeSel.value);
  const memo = () => { const id = pay.ma_ho_so.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); return id ? `HHSR ${id} ${yearSel.value}` : ''; };
  let qrT;
  function updateQr() {
    const m = memo(), fe = fee();
    $('#hvMemo').textContent = m || '…';
    $('#hvAmt').textContent = fe ? fmt(fe.amount) : 'Theo mức Hiệp hội thông báo';
    const img = $('#hvQrImg'), ph = $('#hvQrPh');
    if (!bankReady) { img.hidden = true; ph.hidden = false; ph.textContent = `Hiệp hội đang cập nhật tài khoản nhận hội phí. Liên hệ ${C.hotline || '094 188 82 39'}.`; return; }
    if (!m) { img.hidden = true; ph.hidden = false; ph.textContent = 'Nhập mã hồ sơ để tạo mã QR'; return; }
    clearTimeout(qrT);
    qrT = setTimeout(() => {
      const q = new URLSearchParams({ addInfo: m, accountName: C.bank.holder || '' });
      if (fe) q.set('amount', fe.amount);
      img.onload = () => { img.hidden = false; ph.hidden = true; if (hasGsap) gsap.fromTo(img, { scale: .85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(1.6)' }); };
      img.src = `https://img.vietqr.io/image/${encodeURIComponent(C.bank.id)}-${encodeURIComponent(C.bank.account)}-compact2.png?${q}`;
    }, 350);
  }
  pay.addEventListener('input', updateQr); pay.addEventListener('change', updateQr); updateQr();
  $('#hvCopy').addEventListener('click', async () => {
    const m = memo(); if (!m) return;
    try { await navigator.clipboard.writeText(m); $('#hvCopy').textContent = 'Đã chép'; setTimeout(() => $('#hvCopy').textContent = 'Sao chép', 1600); } catch (_) {}
  });

  pay.addEventListener('submit', async e => {
    e.preventDefault();
    if (pay.website.value) return;
    if (!pay.ma_ho_so.value.trim()) { msg(pay, 'Vui lòng nhập mã hồ sơ hoặc số điện thoại.'); pay.ma_ho_so.focus(); return; }
    if (!bankReady) { msg(pay, offlineMsg()); return; }
    const fe = fee();
    busy(pay, true); msg(pay, 'Đang ghi nhận…', true);
    try {
      await api('/api/hoi-phi', { ma_ho_so: pay.ma_ho_so.value.trim().toUpperCase(), nam: Number(yearSel.value), muc_phi: fe ? fe.id : null, so_tien: fe ? fe.amount : null, noi_dung_ck: memo() });
      msg(pay, 'Đã ghi nhận. Hiệp hội sẽ đối soát và gửi biên nhận hội phí cho bạn.', true);
    } catch (err) {
      msg(pay, err.message === 'offline' ? offlineMsg() : 'Chưa ghi nhận được, vui lòng thử lại sau ít phút.');
    } finally { busy(pay, false); }
  });
})();
