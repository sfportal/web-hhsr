// API đăng ký hội viên và hội phí – Hiệp hội Sầu riêng tỉnh Đắk Lắk
// Bảng dữ liệu: D1 "hhsr-hoivien". Quản trị bằng ADMIN_TOKEN (wrangler secret).

const LOAI = ['ca_nhan', 'htx', 'doanh_nghiep', 'chuyen_gia'];
const NHU_CAU = ['tap_huan', 'ma_vung_trong', 'truy_xuat', 'lien_ket'];
const TT_DK = ['cho_duyet', 'da_duyet', 'tu_choi'];
const TT_HP = ['cho_doi_soat', 'da_nhan', 'khong_khop'];

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

      if (p === '/api/hoi-phi' && req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.website) return json({ ok: true }, 200, h);
        const ma = str(b.ma_ho_so, 20).toUpperCase(), nam = parseInt(b.nam, 10), y = new Date().getUTCFullYear();
        if (!/^(HV-\d{6}|0\d{9})$/.test(ma) || !(nam >= y - 1 && nam <= y + 1)) return json({ ok: false, error: 'invalid' }, 400, h);
        const soTien = Number.isInteger(b.so_tien) && b.so_tien >= 0 && b.so_tien < 1e9 ? b.so_tien : null;
        const dup = await env.DB.prepare("SELECT id FROM hoi_phi WHERE ma_ho_so=? AND nam=? AND tao_luc > datetime('now','-10 minutes') LIMIT 1").bind(ma, nam).first();
        if (!dup) await env.DB.prepare('INSERT INTO hoi_phi (ma_ho_so,nam,muc_phi,so_tien,noi_dung_ck) VALUES (?,?,?,?,?)')
          .bind(ma, nam, str(b.muc_phi, 40) || null, soTien, str(b.noi_dung_ck, 60) || null).run();
        return json({ ok: true }, 201, h);
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
          const { results } = await q.all();
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
      return json({ ok: false, error: 'server' }, 500, h);
    }
  }
};
