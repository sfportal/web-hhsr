CREATE TABLE IF NOT EXISTS dang_ky_hoi_vien (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ma_ho_so TEXT NOT NULL UNIQUE,
  loai TEXT NOT NULL CHECK (loai IN ('ca_nhan','htx','doanh_nghiep','chuyen_gia')),
  ho_ten TEXT NOT NULL,
  nguoi_dai_dien TEXT,
  dien_thoai TEXT NOT NULL,
  email TEXT,
  xa_phuong TEXT NOT NULL,
  dien_tich_ha REAL,
  nhu_cau TEXT,
  dong_y INTEGER NOT NULL DEFAULT 1,
  trang_thai TEXT NOT NULL DEFAULT 'cho_duyet' CHECK (trang_thai IN ('cho_duyet','da_duyet','tu_choi')),
  ghi_chu TEXT,
  tao_luc TEXT NOT NULL DEFAULT (datetime('now')),
  cap_nhat_luc TEXT
);
CREATE INDEX IF NOT EXISTS idx_dk_phone ON dang_ky_hoi_vien(dien_thoai);
CREATE TABLE IF NOT EXISTS hoi_phi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ma_ho_so TEXT NOT NULL,
  nam INTEGER NOT NULL,
  muc_phi TEXT,
  so_tien INTEGER,
  ma_thanh_toan TEXT UNIQUE,
  da_tra INTEGER NOT NULL DEFAULT 0,
  tra_luc TEXT,
  trang_thai TEXT NOT NULL DEFAULT 'cho_thanh_toan' CHECK (trang_thai IN ('cho_thanh_toan','da_nhan','khong_khop')),
  ghi_chu TEXT,
  tao_luc TEXT NOT NULL DEFAULT (datetime('now')),
  cap_nhat_luc TEXT,
  UNIQUE (ma_ho_so, nam)
);
CREATE INDEX IF NOT EXISTS idx_hp_tt ON hoi_phi(trang_thai);
