# Ảnh cho dữ liệu mẫu (chỉ dùng ở dev)

Khi backend chạy với profile `dev`, [SeedAssetLoader](../src/main/java/com/gfmaster/dev/SeedAssetLoader.java) nạp ảnh trong thư mục này vào storage, đặt tại `uploads/seed/<tên file viết thường>.webp`. Trong lúc nạp, ảnh được thu về cạnh dài tối đa 1200px và chuyển sang WebP. Ảnh đã nạp rồi thì lần khởi động sau bỏ qua.

[R__demo_data.sql](../src/main/resources/db/seed/R__demo_data.sql) trỏ `image_url` tới `/uploads/seed/...`. Thư mục con (`bar/`, `cafe/`, `food/lv2/`) chỉ để dễ tìm; tên file mới là thứ quyết định URL.

Thư mục này nằm ngoài `src/main/resources`, nên không bị đóng gói vào file jar production. Muốn đổi vị trí thì đặt `gfm.seed.assets-dir`.

| File | Quán trong seed |
|---|---|
| `bar/bar-dinh-rooftop.png` | Bar Dinh Rooftop & Lounge |
| `cafe/ca-phe-thu-bao.png` | Tiệm Cà Phê Thư Báo |
| `cafe/chaly-cuccu.png` | Chaly Cuc'cu Coffee |
| `cafe/cuoi-ngo.png` | Cafe Cuối Ngõ |
| `cafe/echoes-cafe.png` | Echoes Café |
| `cafe/loi-nho.png` | LỐI NHỎ Kafe |
| `cafe/mai-haus.png` | Mai Haus Coffee |
| `cafe/nha-cua-mau.png` | Nhà Của Mậu |
| `cafe/nik.png` | **Chưa dùng**: không xác định được quán (ảnh không có biển hiệu) |
| `cafe/tam-xuan.png` | Tầm Xuân Coffee |
| `cafe/timeline-coffee.jpg` | Timeline Coffee |
| `cafe/tiny-post-cafe.png` | Tiny Post Cafe |
| `food/lv2/huy-go-cook.png` | Huy Go Cook |
| `food/lv2/kampong-chicken-house.png` | Kampong Chicken House |
| `food/lv2/mokchang-signature.png` | Mokchang Signature |
| `food/lv2/phat-ky.png` | Phát Ký |
| `food/lv2/vi-quang.png` | Vị Quảng |
