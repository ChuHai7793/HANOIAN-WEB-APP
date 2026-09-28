# Phase 7: Giải link Google Maps rút gọn, cache Redis

> **Kết quả:**
> - Dán link `https://maps.app.goo.gl/...` vào form quán thì form tự điền toạ độ và hiện bản đồ xem trước.
> - Cùng một link thì lần sau server trả ngay từ cache (7 ngày), không gọi Google nữa.
> - Lưu quán có link Google Maps đầy đủ mà thiếu toạ độ thì server tự đọc toạ độ từ link.
>
> Cùng đợt này, bộ dữ liệu mẫu được thay bằng 16 quán thật ở Hà Nội (§3, Bước 6).
>
> **Commit:** `feat: resolve Google Maps short links with SSRF guard, cache and rate limit (Phase 7)`

---

## 1. Mục tiêu

- Người dùng thường copy link bằng nút *Chia sẻ* của app Google Maps, và nhận được link **rút gọn** không chứa toạ độ. Trước đây phải tự mở link rồi copy toạ độ bằng tay.
- Server đi theo link hộ trình duyệt, nhưng **không được** biến thành công cụ để kẻ xấu bắt server gọi tới địa chỉ nội bộ (SSRF, §2.2).
- Không gọi Google quá nhiều: có cache và rate limit riêng.

---

## 2. Kiến thức cần biết

### 2.1. Vì sao trình duyệt không tự giải được?

`https://maps.app.goo.gl/AbC` trả về **HTTP 302** kèm header `Location: https://www.google.com/maps/place/...@21.03,105.85,17z/...`. Trình duyệt vẫn đi theo redirect, nhưng JavaScript **không đọc được** URL đích. **CORS** chặn việc đọc response từ origin khác nếu server đó không cho phép, và Google không cho phép. Xem [Phase 3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors).

Server không bị CORS ràng buộc (CORS là luật của trình duyệt), nên backend gọi hộ được.

### 2.2. SSRF (Server-Side Request Forgery)

Một endpoint "đưa tôi URL, tôi gọi hộ" là mục tiêu kinh điển của **SSRF**: kẻ tấn công gửi URL trỏ vào **mạng nội bộ** của server, những chỗ bên ngoài không vào được:

```
GET /api/v1/maps/resolve?url=http://169.254.169.254/latest/meta-data/iam/   ← metadata cloud (lộ khoá AWS)
GET /api/v1/maps/resolve?url=http://localhost:15672/api/users               ← RabbitMQ admin
GET /api/v1/maps/resolve?url=https://maps.app.goo.gl/x  →  302 Location: http://10.0.0.5/admin  ← lừa bằng redirect
```

[ShortLinkResolver](../backend/src/main/java/com/gfmaster/maps/ShortLinkResolver.java) chặn theo nhiều lớp, và **áp dụng ở mọi bước redirect**, không chỉ URL đầu:

| Kiểm tra | Chặn được gì |
|---|---|
| Chỉ `https` | `http://`, `file://`, `gopher://`... |
| Cổng mặc định (không có `:port`) | `https://maps.app.goo.gl:6379` |
| Không có `user@` | `https://attacker@maps.app.goo.gl` (dễ đánh lừa người đọc log) |
| Host nằm trong **danh sách cho phép** (khớp tuyệt đối) | `example.com`, `maps.app.goo.gl.evil.com` (so bằng `endsWith`/`contains` là sai) |
| Ngay trước khi gọi, **mọi IP** của host đều công khai | DNS bị trỏ bậy về `127.0.0.1`, `10.x`, `192.168.x`, `169.254.x` |
| Redirect **thủ công**, tối đa 5 bước | Vòng lặp redirect; redirect ra ngoài danh sách |

Vì sao không bật `HttpClient.Redirect.NORMAL` (tự đi theo redirect)? Vì khi đó client tự nhảy tới `Location` mà code không kịp kiểm tra bước trung gian nào.

> **Danh sách cho phép (allowlist) và danh sách cấm (denylist):** liệt kê cái **được phép** thì an toàn hơn liệt kê cái bị cấm, vì luôn có cách viết mới để lách danh sách cấm (`0x7f.1`, `[::1]`, `2130706433` đều là `127.0.0.1`).

**Chưa hoàn hảo:** giữa lúc tra DNS và lúc `HttpClient` tự tra lại có một khe thời gian rất ngắn (*DNS rebinding*). Allowlist chỉ gồm tên miền của Google làm rủi ro này rất nhỏ. Muốn chặn triệt để thì phải kết nối thẳng tới IP đã kiểm tra.

### 2.3. Link có toạ độ ở đâu?

[GmapUrlParser](../backend/src/main/java/com/gfmaster/maps/GmapUrlParser.java) (backend) và [gmap-url.ts](../frontend/src/app/core/utils/gmap-url.ts) (frontend) dùng **cùng** quy tắc, theo thứ tự ưu tiên:

| Dạng | Ví dụ | Ý nghĩa |
|---|---|---|
| Toạ độ thô | `21.0285, 105.8542` | Người dùng dán thẳng |
| `!3d…!4d…` | `.../data=!3d21.0301!4d105.8467` | **Vị trí ghim** của địa điểm, chính xác nhất |
| `@lat,lng` | `/maps/place/X/@21.02,105.80,17z` | **Tâm khung bản đồ** đang xem, có thể lệch khỏi quán |
| `q=`, `ll=`, `query=`... | `?q=21.0285,105.8542` | Tham số tìm kiếm |
| `/maps/search/lat,+lng` | `/maps/search/21.0285,+105.8542` | Link tìm theo toạ độ |

Trước Phase 7, frontend ưu tiên `@` trước `!3d`. Giờ cả hai bên đều ưu tiên `!3d`. URL được **decode** trước khi so (`%2C` → `,`).

Có link hợp lệ nhưng **không chứa toạ độ**, ví dụ link danh sách quán hoặc `?q=Tên+quán`. Khi đó server trả `200 { lat: null, lng: null, resolvedUrl }` chứ không báo lỗi, và form nhắc người dùng tự nhập toạ độ.

### 2.4. Trang xin đồng ý cookie (consent.google.com)

Người dùng ở châu Âu có thể bị redirect sang `consent.google.com/m?continue=<URL thật>`. Resolver không gọi trang này mà lấy thẳng tham số `continue`, rồi kiểm tra nó như một bước redirect bình thường.

### 2.5. Cache và rate limit

- `@Cacheable("gmap-resolve")`, key là URL, TTL **7 ngày**. Serializer JSON gắn đúng kiểu `Resolved`, giống cache `/stats` ở [Phase 6 §2.8](07-phase-6-rabbitmq.md#28-spring-cache-trên-redis).
- Lỗi (`MAPS_RESOLVE_FAILED`) là exception nên **không** bị cache, lần sau vẫn thử lại được. Kết quả "không có toạ độ" thì **có** cache, vì gọi lại cũng ra như vậy.
- Rate limit riêng **20 lần/phút/user** (`gfm.rate-limit.maps-per-minute`), tính **thêm** vào giới hạn 100 lần/phút chung. Mỗi lần gọi có thể khiến server gọi ra Google, nên cần chặt hơn. Xem [Phase 4 §2.10](05-phase-4-xac-thuc-jwt.md#210-rate-limiting-thuật-toán-token-bucket).

### 2.6. Frontend: debounce và bỏ kết quả cũ

- **Debounce 400ms:** người dùng gõ tay từng ký tự thì chỉ gọi server khi đã ngừng gõ. Dán thì gọi gần như ngay.
- **Bỏ kết quả cũ:** trong lúc chờ server, người dùng có thể đã sửa link. Khi có response, form so lại với nội dung ô nhập hiện tại; khác thì bỏ qua, để toạ độ của link cũ không đè lên.
- Lỗi được hiện ngay dưới ô nhập (`SILENT_ERRORS`, không có toast chung), vì form vẫn dùng được, người dùng chỉ cần nhập toạ độ bằng tay.

---

## 3. Các bước thực hiện

### Bước 1: Parser

[GmapUrlParser.java](../backend/src/main/java/com/gfmaster/maps/GmapUrlParser.java) theo §2.3; `Optional<LatLng>`, kiểm tra `|lat| ≤ 90`, `|lng| ≤ 180`.

### Bước 2: Resolver

[ShortLinkResolver.java](../backend/src/main/java/com/gfmaster/maps/ShortLinkResolver.java):
- Mỗi bước: parse URL hiện tại (có toạ độ thì dừng, **không** gọi mạng). Gặp `consent.google.com` thì lấy `continue`. Nếu không, kiểm tra DNS rồi `GET`, lấy `Location`, kiểm tra URL mới.
- `HttpClient` với `Redirect.NEVER`, timeout 5s, body bỏ qua (`BodyHandlers.discarding()`).
- Hai "cổng" cho test là `Fetcher` (gọi HTTP) và `HostChecker` (tra DNS), là interface package-private. Unit test thay bằng "web giả", không cần mạng.
- Mã lỗi mới: `MAPS_URL_NOT_ALLOWED` (400), `MAPS_RESOLVE_FAILED` (502).

### Bước 3: API, cache, rate limit

- [MapsService](../backend/src/main/java/com/gfmaster/maps/MapsService.java) (`@Cacheable`) và [MapsController](../backend/src/main/java/com/gfmaster/maps/MapsController.java): `GET /api/v1/maps/resolve?url=` (tối đa 2048 ký tự).
- [CacheConfig](../backend/src/main/java/com/gfmaster/config/CacheConfig.java): cache `gmap-resolve` TTL 7 ngày.
- [RateLimitFilter](../backend/src/main/java/com/gfmaster/common/web/RateLimitFilter.java): bucket `maps:{userId}`.

### Bước 4: Server tự điền toạ độ

`PlaceService.create/update`: có `googleMapsUrl` mà `lat` và `lng` đều trống thì chạy `GmapUrlParser` (chỉ đọc link, không gọi mạng), rồi làm tròn 6 chữ số cho khớp cột `DECIMAL(9,6)`.

### Bước 5: Frontend

- [maps.service.ts](../frontend/src/app/core/services/maps.service.ts): `resolve(url)` với `SILENT_ERRORS`.
- [gmap-url.ts](../frontend/src/app/core/utils/gmap-url.ts): cập nhật quy tắc (§2.3), thêm `isShortMapsLink()`.
- [place-form.component.ts](../frontend/src/app/features/places/place-form.component.ts):
  - `syncFromLink()` đọc toạ độ ngay nếu có. Gặp link rút gọn thì đặt hẹn giờ 400ms rồi gọi `resolveShortLink()`.
  - Trong lúc chờ hiện dòng "⏳ Đang lấy toạ độ…". Xong thì hiện thông báo xanh (có toạ độ) hoặc vàng (không có toạ độ, hoặc lỗi).

### Bước 6: Dữ liệu mẫu Hà Nội

- 17 ảnh từ `frontend/assets/img/` (thư mục mà frontend chưa từng dùng) được chuyển sang [backend/seed-assets/](../backend/seed-assets/README.md). Thư mục này nằm ngoài `src/main/resources`, nên không bị đóng gói vào jar production.
- [SeedAssetLoader](../backend/src/main/java/com/gfmaster/dev/SeedAssetLoader.java) (`@Profile("dev")`): lúc khởi động, nạp ảnh vào `uploads/seed/<tên>.webp` (1200px, WebP). Ảnh đã có thì bỏ qua. `StorageDriver` có thêm `exists()`.
- [R__demo_data.sql](../backend/src/main/resources/db/seed/R__demo_data.sql): **16 quán thật** gồm 10 cafe, 1 bar và 5 nhà hàng.
  - Tên, địa chỉ, giờ mở cửa và toạ độ được tra từ trang của quán và Foody/PasGo/toidicafe/dicaphekhong (09/2026). Không có số liệu nào tự bịa.
  - 2 quán chưa xác minh được toạ độ (Echoes Café, Mai Haus) thì để `lat/lng` trống, `google_maps_url` là link tìm theo tên và địa chỉ.
  - Quán nhiều cơ sở chỉ lấy một cơ sở.
  - Quán nghỉ trưa thì lưu giờ mở sớm nhất đến giờ đóng muộn nhất, giờ nghỉ ghi trong `note`.
  - `rating`, `price_range`, `has_wifi/has_parking` là đánh giá cá nhân mẫu, không phải dữ liệu của quán.
- Ảnh `nik.png` **chưa dùng**, vì không xác định được là quán nào (ảnh không có biển hiệu).

### Bước 7: Test

| File | Nội dung |
|---|---|
| [GmapUrlParserTest](../backend/src/test/java/com/gfmaster/maps/GmapUrlParserTest.java) (16) | Các dạng ở §2.3, ưu tiên `!3d` hơn `@`, URL mã hoá, toạ độ ngoài phạm vi, chuỗi `%` hỏng, link rút gọn |
| [ShortLinkResolverTest](../backend/src/test/java/com/gfmaster/maps/ShortLinkResolverTest.java) (17) | Chuỗi redirect, `Location` tương đối, link đầy đủ không gọi mạng, trang đích không có toạ độ, consent, 7 dạng URL bị chặn, host cho phép nhưng DNS trỏ về IP nội bộ, redirect tới `169.254.169.254`, quá 5 redirect, lỗi mạng thành 502, phân loại IP |
| [MapsControllerIT](../backend/src/test/java/com/gfmaster/maps/MapsControllerIT.java) (5) | Key cache có TTL 7 ngày, không có `@class`. URL bị chặn thì 400. Chưa đăng nhập thì 401. Lần thứ 21 thì 429, nhưng API khác và user khác không bị ảnh hưởng. Lưu quán thì toạ độ được điền từ link |
| [DemoSeedIT](../backend/src/test/java/com/gfmaster/dev/DemoSeedIT.java) (2) | Seed có 16 quán (10/1/5), 2 người yêu, 4 link, toạ độ nằm trong Hà Nội, chạy lại vẫn đúng. Mọi `image_url` đều có ảnh nguồn và được nạp với cạnh dài ≤ 1200px |
| [gmap-url.spec.ts](../frontend/src/app/core/utils/gmap-url.spec.ts), [maps.service.spec.ts](../frontend/src/app/core/services/maps.service.spec.ts) | Parser và `isShortMapsLink` phía frontend; `MapsService` gửi đúng tham số và `SILENT_ERRORS` |

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend;  .\mvnw.cmd clean verify     # 108 test
cd D:\GF_Master\frontend; npx ng test --watch=false   # 30 test
```

Đã chạy thử `ShortLinkResolver` với Google thật (bằng `jshell`): một link `maps.app.goo.gl` dạng **danh sách quán** đi qua các bước redirect tới `https://www.google.com/maps/@/data=...`, và kết quả là `lat = null`, đúng như §2.3.

**Chưa thử** được với link rút gọn của **một địa điểm** (không tìm được link công khai nào). Tự thử:
1. Trên điện thoại, mở một quán trong Google Maps, chọn *Chia sẻ*, rồi copy link.
2. Mở form "Thêm quán" và dán vào ô *Link Google Maps*. Khoảng 1 giây sau, ô *Toạ độ* được điền và bản đồ xem trước hiện ra.
3. Kiểm tra cache: `docker compose exec redis redis-cli --scan --pattern "cache:gmap-resolve::*"`.

---

## 5. Lỗi đã gặp và bài học

### 5.1. Kiểm tra DNS quá sớm làm hỏng link không cần mạng

Bản đầu kiểm tra "host không trỏ về IP nội bộ" ngay khi nhận URL. Máy test không tra DNS được nên cả link đầy đủ (đã có toạ độ, không cần gọi đi đâu) cũng bị 400. Sửa: chỉ tra DNS **ngay trước khi thật sự gọi**. Kiểm tra `https`, cổng và allowlist vẫn áp dụng cho mọi URL.

### 5.2. `get("/path?url=" + encoded)` mã hoá hai lần

`MockMvcRequestBuilders.get(String)` coi chuỗi là **URI template** và tự mã hoá thêm một lần: `%3A` thành `%253A`. Server nhận được chuỗi còn mã hoá nên không phải URL hợp lệ. Sửa: dùng `.param("url", url)`.

### 5.3. IDE và Maven cùng ghi vào `target/`

Extension Java của VS Code tự biên dịch (bằng trình biên dịch Eclipse) vào `backend/target/classes` trong lúc Maven chạy. Kết quả là test báo `Unresolved compilation problems`, hoặc thiếu class sinh sẵn của MapStruct (`GirlfriendMapperImpl`). Cách tránh: chạy `.\mvnw.cmd clean verify` khi thấy lỗi lạ kiểu này.

### 5.4. Hạn chế đã biết

- Khe DNS rebinding rất nhỏ (§2.2).
- Resolver không đọc HTML: nếu Google đổi sang redirect bằng JavaScript thay cho HTTP 302, sẽ phải sửa.
- Chỉ nhận link của Google Maps (không nhận Apple Maps, OpenStreetMap).

---

**Trước:** [Phase 6](07-phase-6-rabbitmq.md) · **Tiếp theo:** [Phase 8](09-phase-8-import.md) · **Tra cứu:** [Thuật ngữ](99-thuat-ngu.md)
