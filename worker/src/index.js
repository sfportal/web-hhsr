// API đăng ký hội viên và hội phí – Hiệp hội Sầu riêng tỉnh Đắk Lắk
// Bảng dữ liệu: D1 "hhsr-hoivien". Quản trị bằng ADMIN_TOKEN (wrangler secret).
// Thu hội phí qua sepay-thuchi (API v1, khóa SEPAY_API_KEY): tạo yêu cầu thu, kiểm tra trạng thái khi tiền về.

const LOAI = ['ca_nhan', 'htx', 'doanh_nghiep', 'chuyen_gia'];
const NHU_CAU = ['tap_huan', 'ma_vung_trong', 'truy_xuat', 'lien_ket'];
const TT_DK = ['cho_duyet', 'da_duyet', 'tu_choi'];
const TT_HP = ['cho_thanh_toan', 'da_nhan', 'khong_khop'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
const json = (data, status, h) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...h } });

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
async function isAdmin(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_TOKEN && t.length > 0 && (await safeEqual(t, env.ADMIN_TOKEN));
}
function newCode() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return 'HV-' + String(a[0] % 1000000).padStart(6, '0');
}
const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };


function fees(env) { try { const f = JSON.parse(env.FEES || '[]'); return Array.isArray(f) ? f.filter(x => x && x.id && Number.isInteger(x.amount) && x.amount > 0) : []; } catch { return []; } }

async function sepay(env, method, path, body) {
  if (!env.SEPAY_API_KEY) throw new Error('sepay_not_configured');
  const init = { method, headers: { Authorization: `Bearer ${env.SEPAY_API_KEY}`, 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  const url = 'https://sepay-thuchi/api/v1' + path;
  const r = env.SEPAY ? await env.SEPAY.fetch(url, init) : await fetch((env.SEPAY_URL || '').replace(/\/$/, '') + '/api/v1' + path, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404) return null;
  if (!r.ok || d.status !== 'success') throw new Error('sepay_' + r.status + (d.error ? '_' + (d.error.code || d.error) : ''));
  return d.data;
}

// Trả về dòng hoi_phi mới nhất; nếu sepay báo đã thu đủ thì cập nhật "da_nhan"
async function syncPayment(env, row) {
  if (!row || !row.ma_thanh_toan || row.trang_thai === 'da_nhan') return row;
  const pr = await sepay(env, 'GET', '/payment-requests/' + row.ma_thanh_toan);
  if (pr && (pr.paid_amount || 0) !== row.da_tra || (pr && pr.status === 'paid')) {
    const paid = pr.status === 'paid';
    await env.DB.prepare(`UPDATE hoi_phi SET da_tra=?, tra_luc=COALESCE(?,tra_luc), trang_thai=CASE WHEN ? THEN 'da_nhan' ELSE trang_thai END, cap_nhat_luc=datetime('now') WHERE id=?`)
      .bind(pr.paid_amount || 0, paid ? pr.paid_at || null : null, paid ? 1 : 0, row.id).run();
    return env.DB.prepare('SELECT * FROM hoi_phi WHERE id=?').bind(row.id).first();
  }
  return row;
}
const payView = (row, pr) => ({
  ma_thanh_toan: row.ma_thanh_toan, so_tien: row.so_tien, da_tra: row.da_tra, nam: row.nam,
  trang_thai: row.trang_thai, da_nhan: row.trang_thai === 'da_nhan',
  ...(pr ? { qr: pr.qr_image_url, ngan_hang: pr.bank, so_tai_khoan: pr.account_number, noi_dung_ck: pr.transfer_content } : {})
});

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url), p = url.pathname.replace(/\/$/, '');
    try {
      /* ---------- công khai ---------- */
      if (p === '/api/dang-ky' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.website) return json({ ok: true, ma_ho_so: newCode() }, 200, h); // bẫy bot
        const row = {
          loai: LOAI.includes(b.loai) ? b.loai : null,
          ho_ten: str(b.ho_ten, 120), nguoi_dai_dien: str(b.nguoi_dai_dien, 120) || null,
          dien_thoai: str(b.dien_thoai, 10), email: str(b.email, 120) || null,
          xa_phuong: str(b.xa_phuong, 120),
          dien_tich_ha: Number.isFinite(+b.dien_tich_ha) && b.dien_tich_ha !== null && b.dien_tich_ha !== '' ? Math.max(0, Math.min(100000, +b.dien_tich_ha)) : null,
          nhu_cau: Array.isArray(b.nhu_cau) ? b.nhu_cau.filter(x => NHU_CAU.includes(x)).join(',') : ''
        };
        if (!row.loai || !row.ho_ten || !row.xa_phuong || !/^0\d{9}$/.test(row.dien_thoai) || b.dong_y !== true)
          return json({ ok: false, error: 'invalid' }, 400, h);
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return json({ ok: false, error: 'invalid_email' }, 400, h);
        // chặn gửi lặp: cùng số điện thoại trong 10 phút
        const recent = await env.DB.prepare("SELECT ma_ho_so FROM dang_ky_hoi_vien WHERE dien_thoai=? AND tao_luc > datetime('now','-10 minutes') LIMIT 1").bind(row.dien_thoai).first();
        if (recent) return json({ ok: true, ma_ho_so: recent.ma_ho_so, lap_lai: true }, 200, h);
        for (let i = 0; i < 5; i++) {
          const code = newCode();
          try {
            await env.DB.prepare('INSERT INTO dang_ky_hoi_vien (ma_ho_so,loai,ho_ten,nguoi_dai_dien,dien_thoai,email,xa_phuong,dien_tich_ha,nhu_cau,dong_y) VALUES (?,?,?,?,?,?,?,?,?,1)')
              .bind(code, row.loai, row.ho_ten, row.nguoi_dai_dien, row.dien_thoai, row.email, row.xa_phuong, row.dien_tich_ha, row.nhu_cau).run();
            return json({ ok: true, ma_ho_so: code }, 201, h);
          } catch (e) { if (!String(e).includes('UNIQUE')) throw e; }
        }
        return json({ ok: false, error: 'busy' }, 503, h);
      }

      if (p === '/api/hoi-phi/muc-phi' && req.method === 'GET') {
        return json({ ok: true, fees: fees(env).map(({ id, label, amount }) => ({ id, label, amount })), san_sang: !!env.SEPAY_API_KEY && fees(env).length > 0 }, 200, h);
      }

      // Tạo (hoặc lấy lại) yêu cầu thu hội phí cho một hội viên trong một năm
      if (p === '/api/hoi-phi' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.website) return json({ ok: false, error: 'invalid' }, 400, h);
        const y = new Date().getUTCFullYear(), nam = parseInt(b.nam, 10);
        if (!(nam >= y - 1 && nam <= y + 1)) return json({ ok: false, error: 'invalid' }, 400, h);
        const fee = fees(env).find(f => f.id === b.muc_phi);
        if (!fee) return json({ ok: false, error: 'fee_not_configured' }, 400, h);
        const id = str(b.ma_ho_so, 20).toUpperCase().replace(/\s/g, '');
        let hv = null;
        if (/^HV-?\d{6}$/.test(id)) hv = await env.DB.prepare('SELECT ma_ho_so, ho_ten, trang_thai FROM dang_ky_hoi_vien WHERE ma_ho_so=?').bind(id.replace(/^HV-?/, 'HV-')).first();
        else if (/^0\d{9}$/.test(id)) hv = await env.DB.prepare('SELECT ma_ho_so, ho_ten, trang_thai FROM dang_ky_hoi_vien WHERE dien_thoai=? ORDER BY id DESC LIMIT 1').bind(id).first();
        else return json({ ok: false, error: 'invalid' }, 400, h);
        if (!hv) return json({ ok: false, error: 'member_not_found' }, 404, h);
        if (hv.trang_thai === 'tu_choi') return json({ ok: false, error: 'member_rejected' }, 403, h);

        const code = `HHSR${hv.ma_ho_so.slice(3)}N${String(nam).slice(2)}`; // VD: HHSR858506N26
        let row = await env.DB.prepare('SELECT * FROM hoi_phi WHERE ma_ho_so=? AND nam=?').bind(hv.ma_ho_so, nam).first();
        if (row && row.trang_thai === 'da_nhan') return json({ ok: true, ma_ho_so: hv.ma_ho_so, ...payView(row) }, 200, h);
        let pr = await sepay(env, 'GET', '/payment-requests/' + code);
        if (!pr) pr = await sepay(env, 'POST', '/payment-requests', { code, amount: fee.amount, customer: `${hv.ma_ho_so} ${hv.ho_ten}`.slice(0, 120), description: `Hội phí ${nam} – Hiệp hội Sầu riêng Đắk Lắk` });
        if (!row) {
          await env.DB.prepare('INSERT INTO hoi_phi (ma_ho_so,nam,muc_phi,so_tien,ma_thanh_toan) VALUES (?,?,?,?,?)').bind(hv.ma_ho_so, nam, fee.id, pr.amount, pr.code).run();
          row = await env.DB.prepare('SELECT * FROM hoi_phi WHERE ma_ho_so=? AND nam=?').bind(hv.ma_ho_so, nam).first();
        }
        row = await syncPayment(env, row);
        return json({ ok: true, ma_ho_so: hv.ma_ho_so, ...payView(row, pr) }, 200, h);
      }

      // Kiểm tra trạng thái thanh toán (trang web hỏi định kỳ)
      let ms;
      if ((ms = p.match(/^\/api\/hoi-phi\/trang-thai\/(HHSR\d{6}N\d{2})$/)) && req.method === 'GET') {
        let row = await env.DB.prepare('SELECT * FROM hoi_phi WHERE ma_thanh_toan=?').bind(ms[1]).first();
        if (!row) return json({ ok: false, error: 'not_found' }, 404, h);
        row = await syncPayment(env, row);
        return json({ ok: true, ...payView(row) }, 200, h);
      }

      /* ---------- quản trị ---------- */
      if (p.startsWith('/api/admin')) {
        if (!(await isAdmin(req, env))) return json({ ok: false, error: 'unauthorized' }, 401, h);
        const m = p.match(/^\/api\/admin\/(dang-ky|hoi-phi)(?:\/(\d+))?(\.csv)?$/);
        if (p === '/api/admin/ping') return json({ ok: true }, 200, h);
        if (!m) return json({ ok: false, error: 'not_found' }, 404, h);
        const table = m[1] === 'dang-ky' ? 'dang_ky_hoi_vien' : 'hoi_phi';
        const states = m[1] === 'dang-ky' ? TT_DK : TT_HP;
        if (req.method === 'GET' && !m[2]) {
          const tt = url.searchParams.get('trang_thai');
          const q = states.includes(tt)
            ? env.DB.prepare(`SELECT * FROM ${table} WHERE trang_thai=? ORDER BY id DESC LIMIT 2000`).bind(tt)
            : env.DB.prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 2000`);
          let { results } = await q.all();
          if (table === 'hoi_phi' && url.searchParams.get('dong_bo') === '1' && env.SEPAY_API_KEY)
            for (const r of results.filter(r => r.trang_thai === 'cho_thanh_toan').slice(0, 40)) { try { Object.assign(r, await syncPayment(env, r)); } catch (_) {} }
          if (m[3]) {
            const cols = results.length ? Object.keys(results[0]) : [];
            const csv = '﻿' + [cols.join(','), ...results.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n');
            return new Response(csv, { headers: { ...h, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${table}.csv"` } });
          }
          return json({ ok: true, rows: results }, 200, h);
        }
        if (req.method === 'PATCH' && m[2]) {
          const b = await req.json().catch(() => ({}));
          if (!states.includes(b.trang_thai)) return json({ ok: false, error: 'invalid' }, 400, h);
          await env.DB.prepare(`UPDATE ${table} SET trang_thai=?, ghi_chu=COALESCE(?,ghi_chu), cap_nhat_luc=datetime('now') WHERE id=?`)
            .bind(b.trang_thai, typeof b.ghi_chu === 'string' ? b.ghi_chu.slice(0, 500) : null, +m[2]).run();
          return json({ ok: true }, 200, h);
        }
        return json({ ok: false, error: 'method' }, 405, h);
      }

      if (p === '' || p === '/api') return json({ ok: true, service: 'hhsr-hoivien' }, 200, h);
      return json({ ok: false, error: 'not_found' }, 404, h);
    } catch (e) {
      console.error(e);
      const em = String(e && e.message || e);
      return json({ ok: false, error: em.startsWith('sepay') ? 'payment_unavailable' : 'server' }, em.startsWith('sepay') ? 502 : 500, h);
    }
  }
};
