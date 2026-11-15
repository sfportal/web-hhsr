/* Đăng ký hội viên + đóng hội phí qua VietQR */
(() => {
  const C = window.HHSR_CONFIG || {};
  const card = document.getElementById('hvcard');
  if (!card) return;
  const $ = (s, r = document) => r.querySelector(s);
  const reg = $('#hvReg'), pay = $('#hvPay'), done = $('#hvDone'), bill = $('#hvBill'), paid = $('#hvPaid');
  let payPane = pay;
  const tabs = [...card.querySelectorAll('.hvcard__tabs button')], pill = $('.hvcard__pill', card);
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  const hasGsap = typeof gsap !== 'undefined';

  /* ---------- tabs ---------- */
  function movePill(b) { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft - 6}px)`; }
  function show(t) {
    tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t));
    movePill(tabs.find(b => b.dataset.t === t));
    const regDone = reg.dataset.sent === '1';
    reg.hidden = !(t === 'dk' && !regDone);
    done.hidden = !(t === 'dk' && regDone);
    [pay, bill, paid].forEach(x => x.hidden = !(t === 'phi' && x === payPane));
    const vis = [reg, done, pay, bill, paid].find(e => !e.hidden);
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
    let r;
    try { r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (_) { throw new Error('offline'); }
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
      pay.ma_ho_so.value = code;
      show('dk');
      if (hasGsap) gsap.from('.hvdone__ic', { scale: 0, rotate: -90, duration: .8, ease: 'back.out(2)' });
    } catch (err) {
      msg(reg, err.message === 'offline' ? offlineMsg() : 'Chưa gửi được, vui lòng thử lại sau ít phút.');
    } finally { busy(reg, false); }
  });
  $('#hvToPay').addEventListener('click', () => show('phi'));

  /* ---------- pay (sepay-thuchi) ---------- */
  const yearSel = $('#hvYear'), feeSel = $('#hvFee'), y0 = new Date().getFullYear();
  [y0, y0 + 1].forEach(y => yearSel.add(new Option(y, y)));
  let payReady = false;
  async function loadFees() {
    try {
      const base = (C.api || '').replace(/\/$/, ''); if (!base) throw 0;
      const d = await (await fetch(base + '/api/hoi-phi/muc-phi')).json();
      d.fees.forEach(fe => feeSel.add(new Option(`${fe.label} · ${fmt(fe.amount)}`, fe.id)));
      payReady = d.san_sang;
      if (d.fees.length < 2) $('#hvFeeWrap').style.display = d.fees.length ? 'none' : '';
    } catch (_) { payReady = false; }
    if (!payReady) { $('#hvFeeWrap').style.display = 'none'; msg(pay, `Thu hội phí trực tuyến đang được kích hoạt. Vui lòng liên hệ ${C.hotline || '094 188 82 39'}.`); }
  }
  loadFees();

  const payPanes = [pay, bill, paid];
  function payShow(el) {
    payPanes.forEach(x => x.hidden = x !== el);
    if (hasGsap) gsap.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power3.out' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  let poll, pollEnd = 0, cur = null;
  function setPaid(d) {
    clearInterval(poll);
    $('#hvPaidCode').textContent = d.ma_thanh_toan || '';
    $('#hvPaidTxt').textContent = `Hội phí năm ${d.nam} (${fmt(d.so_tien)}) đã được ghi nhận. Cảm ơn bạn đã đồng hành cùng Hiệp hội.`;
    payPane = paid; payShow(paid);
    if (hasGsap) gsap.from('#hvPaid .hvdone__ic', { scale: 0, rotate: -90, duration: .8, ease: 'back.out(2)' });
  }
  async function check(manual) {
    if (!cur) return;
    try {
      const base = C.api.replace(/\/$/, '');
      const d = await (await fetch(`${base}/api/hoi-phi/trang-thai/${cur}`)).json();
      if (d.da_nhan) return setPaid(d);
      if (manual) $('#hvWait span').textContent = d.da_tra ? `Đã nhận ${fmt(d.da_tra)}, còn thiếu ${fmt(d.so_tien - d.da_tra)}. Vui lòng chuyển phần còn lại với cùng nội dung.` : 'Chưa thấy tiền về. Ngân hàng có thể chậm vài phút, trang vẫn đang tự kiểm tra.';
    } catch (_) {}
    if (Date.now() > pollEnd) { clearInterval(poll); $('#hvWait').classList.add('stop'); $('#hvWait span').textContent = 'Đã ngừng tự kiểm tra. Bấm "Tôi đã chuyển khoản" để kiểm tra lại.'; }
  }
  function startPoll() { clearInterval(poll); pollEnd = Date.now() + 15 * 60e3; $('#hvWait').classList.remove('stop'); poll = setInterval(() => check(false), 5000); }

  pay.addEventListener('submit', async e => {
    e.preventDefault();
    if (pay.website.value) return;
    if (!payReady) { msg(pay, `Thu hội phí trực tuyến đang được kích hoạt. Vui lòng liên hệ ${C.hotline || '094 188 82 39'}.`); return; }
    if (!pay.ma_ho_so.value.trim()) { msg(pay, 'Vui lòng nhập mã hồ sơ hoặc số điện thoại.'); pay.ma_ho_so.focus(); return; }
    busy(pay, true); msg(pay, 'Đang tạo mã thanh toán…', true);
    try {
      const d = await api('/api/hoi-phi', { ma_ho_so: pay.ma_ho_so.value.trim(), nam: Number(yearSel.value), muc_phi: feeSel.value, website: pay.website.value });
      msg(pay, '', true);
      cur = d.ma_thanh_toan;
      if (d.da_nhan) return setPaid(d);
      $('#hvBillWho').textContent = d.ma_ho_so + ' · năm ' + d.nam;
      $('#hvBank').textContent = d.ngan_hang || '…'; $('#hvAcc').textContent = d.so_tai_khoan || '…';
      $('#hvAmt').textContent = d.da_tra ? `${fmt(d.so_tien - d.da_tra)} (còn thiếu)` : fmt(d.so_tien);
      $('#hvMemo').textContent = d.noi_dung_ck || d.ma_thanh_toan;
      $('#hvWait span').textContent = 'Đang chờ tiền về. Trang sẽ tự xác nhận khi Hiệp hội nhận được chuyển khoản.';
      const img = $('#hvQrImg'); img.src = d.qr || '';
      payPane = bill; payShow(bill);
      if (hasGsap) gsap.fromTo(img, { scale: .85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .6, delay: .15, ease: 'back.out(1.6)' });
      startPoll();
    } catch (err) {
      const M = { member_not_found: 'Không tìm thấy hồ sơ. Hãy kiểm tra lại mã hồ sơ hoặc số điện thoại đã đăng ký.', member_rejected: 'Hồ sơ này chưa được kết nạp. Vui lòng liên hệ Hiệp hội.', fee_not_configured: 'Mức hội phí chưa được thiết lập. Vui lòng liên hệ Hiệp hội.', offline: `Thu hội phí trực tuyến đang được kích hoạt. Vui lòng liên hệ ${C.hotline || '094 188 82 39'}.` };
      msg(pay, M[err.message] || 'Chưa tạo được mã thanh toán, vui lòng thử lại sau ít phút.');
    } finally { busy(pay, false); }
  });
  $('#hvCheck').addEventListener('click', () => { if (Date.now() > pollEnd) startPoll(); check(true); });
  $('#hvBack').addEventListener('click', () => { clearInterval(poll); payPane = pay; payShow(pay); });
  $('#hvAgain').addEventListener('click', () => { cur = null; payPane = pay; payShow(pay); });
  $('#hvCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#hvMemo').textContent); $('#hvCopy').textContent = 'Đã chép'; setTimeout(() => $('#hvCopy').textContent = 'Sao chép', 1600); } catch (_) {}
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cur && !bill.hidden) check(false); });
})();
