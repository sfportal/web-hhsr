/* Cấu hình đăng ký hội viên và hội phí.
   Điền thông tin thật của Hiệp hội. Mục nào để trống, trang tự hiện thông báo "đang cập nhật". */
window.HHSR_CONFIG = {
  // Địa chỉ API (Cloudflare Worker "hhsr-hoivien"), ví dụ 'https://hhsr-hoivien.<tên-tài-khoản>.workers.dev'
  api: '',

  // Tài khoản nhận hội phí (mã ngân hàng theo VietQR, ví dụ 'VCB', 'BIDV', 'ICB', 'AGRIBANK' hoặc mã BIN 6 số)
  bank: { id: '', name: '', account: '', holder: '' },

  // Các mức hội phí theo năm, đúng theo quy định của Hiệp hội. Ví dụ:
  // { id: 'ca_nhan', label: 'Hội viên cá nhân', amount: 0 }
  fees: [],

  hotline: '094 188 82 39'
};
