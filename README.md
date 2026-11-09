# Website Hiệp hội Sầu riêng tỉnh Đắk Lắk

Website tĩnh một trang, nhiều hiệu ứng chuyển động (GSAP + ScrollTrigger, Lenis smooth scroll, canvas hạt vàng, cuộn ngang, đếm số, 3D tilt).

## Nội dung & nguồn
- Hình ảnh, video: fanpage [Hiệp hội Sầu riêng Đắk Lắk](https://www.facebook.com/hiephoisauriengdaklak).
- Số liệu: các bài báo được dẫn link ngay trên trang (Tạp chí Công Thương, Báo Đại biểu Nhân dân, Báo Tiền Phong, Luật sư Việt Nam, Báo Nhân Dân).

## Cấu trúc
```
index.html
assets/css/style.css
assets/js/main.js
assets/vendor/   (gsap, ScrollTrigger, lenis – đặt sẵn, không cần CDN)
assets/img/      (ảnh đã nén)
assets/video/    (hero.mp4 nền, recap-guinness.mp4)
```

## Chạy thử
```
python3 -m http.server 8000
```
rồi mở http://localhost:8000

## Xuất bản bằng GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → Branch `main`, thư mục `/ (root)`.
