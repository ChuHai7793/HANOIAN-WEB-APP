# Dating Master (GF Master)

Sổ tay hẹn hò: lưu quán cafe, bar, quán ăn đã đi; lưu người yêu và những lần đi cùng; gợi ý lịch hẹn.

- **Frontend:** Angular (http://localhost:4200)
- **Backend:** Spring Boot (http://localhost:8080)
- **Hạ tầng:** MariaDB, Redis và RabbitMQ, chạy bằng Docker

Kế hoạch tổng thể nằm ở [PLAN.md](PLAN.md). Tài liệu từng bước nằm trong [docs/](docs/README.md).

---

## Hiện đã có những gì

| Phase | Nội dung | Tài liệu |
|---|---|---|
| 0–1 | Git, Docker Compose, khung Spring Boot, Flyway, Swagger, Testcontainers | [01](docs/01-phase-0-chuan-bi.md), [02](docs/02-phase-1-khung-spring-boot-flyway.md) |
| 2 | API CRUD cho quán, người yêu, liên kết và thống kê; chống sửa đè (`version`); chống xem dữ liệu người khác (IDOR) | [03](docs/03-phase-2-crud-api.md) |
| 3 | Frontend gọi API thật; upload ảnh (resize 1200px, WebP) | [04](docs/04-phase-3-frontend-noi-api-upload.md) |
| 4 | Đăng nhập JWT; refresh token trong Redis; giới hạn đăng nhập sai (5 lần/phút) | [05](docs/05-phase-4-xac-thuc-jwt.md) |
| 5 | Bấm "Lưu" nhiều lần không tạo bản trùng (Idempotency-Key); hai tab cùng sửa thì hiện dialog xung đột | [06](docs/06-phase-5-concurrency.md) |
| 6 | RabbitMQ: thumbnail 320px sinh ở nền, xoá file sau commit, DLQ, cache `/stats`, dọn ảnh mồ côi lúc 03:00 | [07](docs/07-phase-6-rabbitmq.md) |
| 7 | Dán link `maps.app.goo.gl` thì tự điền toạ độ (chống SSRF, cache 7 ngày); dữ liệu mẫu là 16 quán thật ở Hà Nội | [08](docs/08-phase-7-google-maps.md) |
| 8 | Import dữ liệu localStorage của bản cũ ở nền (202 + polling); khoá chống import trùng (423) | [09](docs/09-phase-8-import.md) |
| + | Phân quyền admin/guest: guest chỉ xem, backend chặn mọi request ghi (403); đăng nhập bằng tên hoặc email | [10](docs/10-phan-quyen.md) |
| + | Ảnh lưu trên object storage (Cloudflare R2 / S3 / MinIO), trình duyệt upload thẳng bằng presigned URL, ảnh công khai qua CDN; dev vẫn lưu local | [11](docs/11-luu-anh-object-storage.md) |

**Còn lại:** Phase 9 (hoàn thiện, bảo mật, test E2E bằng Playwright), Phase 10 (deploy), Phase 11 (mở rộng). Xem [PLAN.md §14](PLAN.md).

---

## Cách chạy

### 1. Cần cài

| Công cụ | Kiểm tra |
|---|---|
| **Docker Desktop**, mở sẵn và đợi báo *Engine running* | `docker version` |
| **JDK 21** | `java -version` |
| **Node.js** bản LTS | `node -v` |

Không cần cài Maven: dự án dùng Maven Wrapper (`mvnw.cmd`). Hướng dẫn cài đặt chi tiết có ở [docs/00-cong-cu-va-moi-truong.md](docs/00-cong-cu-va-moi-truong.md).

### 2. Bật hạ tầng

```powershell
cd D:\GF_Master
docker compose up -d
docker compose ps        # chờ tới khi mariadb, redis, rabbitmq, adminer đều báo "healthy"
```

### 3. Chạy backend (terminal 1)

```powershell
cd D:\GF_Master\backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

- Thấy dòng `Started GfMasterApplication` là backend đã sẵn sàng. Lần đầu mất vài phút để tải dependency.
- Phải chạy từ thư mục `backend`. Profile `dev` nạp dữ liệu mẫu, và ảnh mẫu được đọc từ `backend/seed-assets/` theo đường dẫn tương đối.

### 4. Chạy frontend (terminal 2)

```powershell
cd D:\GF_Master\frontend
npm install              # chỉ cần lần đầu
npm start
```

### 5. Mở ứng dụng

Mở http://localhost:4200 và đăng nhập bằng tên đăng nhập (hoặc email):

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| `admin` (admin@gfmaster.local) | `admin@12345` | Chủ dữ liệu: thấy và dùng được nút **Thêm, Sửa, Xoá** |
| `guest` (guest@gfmaster.local) | `guest@12345` | **Chỉ xem** dữ liệu của admin, không thấy nút ghi nào |

Tài khoản tự đăng ký ở `/register` là **guest**. Xem [docs/10-phan-quyen.md](docs/10-phan-quyen.md).

| Địa chỉ | Dùng để |
|---|---|
| http://localhost:4200 | Ứng dụng |
| http://localhost:8080/api/docs | Swagger: xem và gọi thử API |
| http://localhost:8081 | Adminer: xem DB. System *MySQL*, Server `mariadb`, User `gfm`, Pass `gfm`, DB `gfmaster` |
| http://localhost:15672 | RabbitMQ UI (`gfm` / `gfm`): xem queue và DLQ |

### 6. Tắt

Bấm `Ctrl+C` ở hai terminal, rồi chạy:

```powershell
docker compose stop      # tạm dừng, dữ liệu vẫn còn
docker compose down -v   # CHỈ khi muốn xoá sạch dữ liệu để làm lại từ đầu
```

---

## Chạy test

Docker phải đang chạy, vì test tích hợp tự bật MariaDB, Redis và RabbitMQ riêng bằng Testcontainers.

```powershell
cd D:\GF_Master\backend;  .\mvnw.cmd clean verify      # 132 test
cd D:\GF_Master\frontend; npx ng test --watch=false    # 42 test
```

---

## Nên thử tay

Các phần dưới đây mới có test tự động, chưa được thử trên trình duyệt thật:

1. **Thumbnail:** thêm một quán có ảnh. Khoảng một giây sau, thư mục `backend/uploads/<userId>/<năm>/<tháng>/` có thêm file `…-320.webp`.
2. **Xung đột khi sửa:** mở cùng một quán ở hai tab. Lưu ở tab 1 trước, rồi lưu ở tab 2: tab 2 hiện dialog *Dữ liệu đã thay đổi* (Tải bản mới / Ghi đè).
3. **Link Google Maps rút gọn:** trong app Google Maps, mở một quán, chọn *Chia sẻ*, copy link rồi dán vào ô *Link Google Maps* của form "Thêm quán". Khoảng một giây sau, ô toạ độ được điền và bản đồ xem trước hiện ra.
4. **Phân quyền:** đăng nhập `guest` thì không thấy nút *Thêm, ✏️, 🗑️, Gắn quán*; đăng nhập `admin` thì thấy đủ.
5. **Import dữ liệu bản cũ** (đăng nhập `admin`): mở DevTools → Console, chạy lệnh dưới rồi tải lại trang. Dialog *Tìm thấy dữ liệu cũ* hiện ra; chọn *Tải lên*.
   ```js
   localStorage.setItem('gfm.girlfriends', JSON.stringify([{ id: 'gf_x', name: 'Lan', status: 'crush' }]));
   ```

---

## Gặp lỗi

| Triệu chứng | Cách xử lý |
|---|---|
| Backend báo không kết nối được DB, Redis hoặc RabbitMQ | Mở Docker Desktop, chạy `docker compose up -d`, rồi chờ các dịch vụ báo `healthy` |
| `Port ... already in use` (3306, 6379, 5672, 8080, 4200) | Tắt ứng dụng khác đang dùng cổng đó, hoặc đổi cổng trong `docker-compose.yml` |
| Test báo `Unresolved compilation problems` hoặc thiếu `...MapperImpl` | Extension Java của VS Code vừa ghi đè `backend/target/`. Chạy lại bằng `.\mvnw.cmd clean verify` |
| Lần đầu `npm start` rất chậm | Windows Defender đang quét `node_modules`. Thêm `D:\GF_Master\frontend` vào *Windows Security → Exclusions* |
| Quán mẫu không có ảnh | Backend không được chạy từ thư mục `backend`, nên không tìm thấy `seed-assets/`. Xem log có dòng `Seed assets dir ... not found` |
| Đổi mật khẩu trong `.env` nhưng DB không nhận | Biến `MARIADB_*` chỉ có tác dụng khi volume còn trống. Xem [docs/00 §4.5](docs/00-cong-cu-va-moi-truong.md#45-đọc-hiểu-một-service-trong-docker-composeyml) |
