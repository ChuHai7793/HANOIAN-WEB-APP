# Phase 0: Chuẩn bị repo và hạ tầng

> **Kết quả:** repo Git có mốc ban đầu, một lệnh `docker compose up -d` bật đủ MariaDB, Redis, RabbitMQ, Adminer.
> **Commit:** `chore: baseline Angular frontend...` và phần hạ tầng trong commit Phase 0-1.

---

## 1. Mục tiêu

Trước khi viết dòng backend đầu tiên, cần hai thứ:

1. **Một điểm xuất phát an toàn.** Commit nguyên trạng frontend đang chạy được. Nếu sau này làm hỏng thì luôn quay lại được.
2. **Hạ tầng chạy bằng một lệnh.** Backend cần database, cache, message broker. Mọi người trong nhóm phải bật chúng giống hệt nhau, không cài tay.

---

## 2. Kiến thức cần biết

### 2.1. Monorepo

Dự án đặt **frontend và backend trong cùng một repo** (monorepo):

```
GF_Master/
├─ frontend/          # Angular (đã có từ trước)
├─ backend/           # Spring Boot (tạo ở Phase 1)
├─ docs/              # tài liệu này
├─ docker-compose.yml # hạ tầng dev
├─ .env.example       # mẫu biến môi trường
├─ .gitignore
├─ .gitattributes
└─ PLAN.md
```

**Lợi ích:** một commit có thể sửa cả API lẫn giao diện gọi API đó, nên hai phía không bao giờ lệch phiên bản. Với một nhóm nhỏ, cách này đơn giản hơn nhiều so với tách repo.

### 2.2. `.gitignore`: những gì KHÔNG được đưa vào Git

[.gitignore](../.gitignore) liệt kê các file và thư mục Git bỏ qua:

| Mẫu | Lý do bỏ qua |
|---|---|
| `node_modules/` | Hàng chục nghìn file thư viện, tải lại được bằng `npm install` |
| `dist/`, `target/` | Kết quả build, sinh lại được |
| `.angular/` | Cache của Angular CLI |
| `.env`, `.env.*` (trừ `.env.example`) | **Chứa mật khẩu và secret**, tuyệt đối không commit |
| `uploads/` | Ảnh người dùng upload, là dữ liệu chứ không phải mã nguồn |

> **Nguyên tắc:** Git chỉ chứa **mã nguồn và cấu hình không bí mật**. Thứ gì sinh lại được, hoặc là bí mật, đều không vào Git.

### 2.3. `.gitattributes` và vấn đề xuống dòng (line endings)

Windows kết thúc dòng bằng hai ký tự `\r\n` (**CRLF**), Linux/macOS bằng `\n` (**LF**). Nếu không thống nhất:
- Git báo "cả file thay đổi" dù chỉ sửa một dòng.
- Script shell như `mvnw` có `\r` sẽ **không chạy được** trên Linux (lỗi `/bin/sh^M: bad interpreter`).

[.gitattributes](../.gitattributes) quy định:

```
* text=auto eol=lf     # mọi file text lưu trong repo bằng LF
*.cmd text eol=crlf    # riêng script Windows giữ CRLF
*.jar binary           # file nhị phân: không bao giờ chuyển đổi
```

Vì vậy bạn sẽ thấy cảnh báo `LF will be replaced by CRLF` khi commit trên Windows. Đây là cảnh báo bình thường, không phải lỗi.

### 2.4. Biến môi trường và `.env`

**Biến môi trường (environment variable)** là cặp `TÊN=giá trị` mà hệ điều hành truyền cho chương trình khi chạy. Nhờ đó cùng một mã nguồn chạy được ở nhiều môi trường: dev dùng mật khẩu `gfm`, production dùng mật khẩu mạnh, mà **không sửa code**.

- [.env.example](../.env.example): **mẫu**, có trong Git, liệt kê mọi biến cần có với giá trị dev.
- `.env`: bản thật trên từng máy hoặc server, **không có trong Git**. Tạo bằng cách copy từ `.env.example` rồi sửa.

Docker Compose tự đọc file `.env` cùng thư mục. Trong [docker-compose.yml](../docker-compose.yml), cú pháp `${DB_USER:-gfm}` nghĩa là "dùng biến `DB_USER`, nếu chưa có thì dùng `gfm`".

### 2.5. Ba dịch vụ hạ tầng: dùng để làm gì?

| Dịch vụ | Loại | Vai trò trong dự án | Dùng từ phase |
|---|---|---|---|
| **MariaDB 11.4** | CSDL quan hệ (SQL), bản fork mã nguồn mở của MySQL | Dữ liệu chính: user, quán, người yêu, liên kết, ảnh | 1 |
| **Redis 7** | Kho key-value trong bộ nhớ (RAM), rất nhanh | Refresh token, rate limit, cache, khoá phân tán, idempotency | 4 |
| **RabbitMQ 4** | Message broker, trung gian chuyển tin nhắn giữa các phần | Việc chạy nền: sinh thumbnail, import dữ liệu | 6 |
| **Adminer** | Web UI quản lý database | Xem bảng và dữ liệu khi dev | 0 |
| **MongoDB 8** | CSDL dạng document (JSON) | Nhật ký hoạt động (tuỳ chọn) | 11 |

Giải thích kỹ từng loại nằm ở [99-thuat-ngu.md](99-thuat-ngu.md). Tóm tắt:
- **SQL / quan hệ**: dữ liệu nằm trong bảng có cột cố định, có ràng buộc (khoá ngoại, unique), có transaction ACID. Hợp với dữ liệu nghiệp vụ quan trọng.
- **Key-value in-memory**: đọc/ghi vài chục micro-giây, dữ liệu có thể tự hết hạn (TTL). Hợp với dữ liệu tạm và đếm nhanh.
- **Message broker**: bên gửi đặt việc vào **hàng đợi (queue)**, bên xử lý lấy ra làm dần. Request của người dùng không phải chờ việc nặng.

### 2.6. Cấu hình đáng chú ý trong `docker-compose.yml`

```yaml
mariadb:
  command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_uca1400_ai_ci"]
```
- **utf8mb4**: bảng mã lưu được mọi ký tự Unicode, kể cả emoji. `utf8` cũ của MySQL chỉ lưu tối đa 3 byte và **mất emoji**.
- **Collation `utf8mb4_uca1400_ai_ci`**: quy tắc so sánh chuỗi. `ai` = *accent-insensitive* (không phân biệt dấu), `ci` = *case-insensitive* (không phân biệt hoa thường). Kết quả: tìm `ca phe` khớp `Cà Phê`, rất hợp tiếng Việt.

```yaml
redis:
  command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "volatile-lru"]
```
- **`appendonly yes` (AOF)**: ghi mọi lệnh ra đĩa, nên Redis khởi động lại không mất phiên đăng nhập.
- **`maxmemory 256mb` + `volatile-lru`**: khi đầy RAM, chỉ xoá các key **có hạn dùng (TTL)**, ưu tiên key lâu không dùng. Key không có TTL được giữ.

```yaml
rabbitmq:
  image: rabbitmq:4-management-alpine   # bản "management" có kèm web UI ở cổng 15672
```

```yaml
mongo:
  profiles: ["mongo"]   # không chạy mặc định; bật bằng: docker compose --profile mongo up -d
```

---

## 3. Các bước thực hiện

### Bước 1: Khởi tạo Git và commit mốc

```powershell
cd D:\GF_Master
git init -b main                # tạo repo, nhánh mặc định tên main
# tạo .gitignore (xem mục 2.2)
git add PLAN.md .gitignore frontend
git commit -m "chore: baseline Angular frontend before backend work"
```

> Commit mốc **chỉ gồm những gì đang chạy được**. Nếu sau này muốn so sánh "frontend trước và sau khi nối backend", chỉ cần `git diff <mốc> -- frontend`.

### Bước 2: Viết `docker-compose.yml`

Xem file hoàn chỉnh: [docker-compose.yml](../docker-compose.yml). Mỗi dịch vụ gồm:
- `image`: dùng image nào, **luôn ghi rõ tag phiên bản**, không dùng `latest`, để năm sau chạy lại vẫn ra kết quả y hệt.
- `ports`: cổng nào mở ra máy thật.
- `volumes`: thư mục nào cần giữ dữ liệu.
- `healthcheck`: cách kiểm tra đã sẵn sàng.
- `environment`: tài khoản/mật khẩu (lấy từ `.env`, có giá trị mặc định cho dev).

Cuối file khai báo các **named volume** (volume có tên, do Docker quản lý):
```yaml
volumes: { mariadb: {}, redis: {}, rabbitmq: {}, mongo: {} }
```

### Bước 3: Viết `.env.example`

Liệt kê mọi biến mà backend và compose dùng: [.env.example](../.env.example). Trong đó quan trọng nhất là `JWT_SECRET`: ở production **phải** là chuỗi ngẫu nhiên dài ít nhất 32 byte (xem [Phase 4](05-phase-4-xac-thuc-jwt.md)).

### Bước 4: Bật hạ tầng

```powershell
# Docker Desktop phải đang chạy
docker compose up -d
docker compose ps
```

Kết quả mong đợi:
```
SERVICE    STATUS
adminer    Up
mariadb    Up (healthy)
rabbitmq   Up (healthy)
redis      Up (healthy)
```

### Bước 5: Đẩy lên GitHub

Làm theo [00-cong-cu-va-moi-truong.md §3](00-cong-cu-va-moi-truong.md#3-git-và-github). Dự án dùng nhánh `dev` cho việc đang làm:

```powershell
git remote add origin https://github.com/ChuHai7793/HANOIAN-WEB-APP.git
git checkout -b dev main
git push -u origin dev
```

---

## 4. Kiểm tra kết quả

| Kiểm tra | Cách làm | Mong đợi |
|---|---|---|
| Container chạy | `docker compose ps` | 3 dịch vụ `healthy`, adminer `Up` |
| Vào được DB | Mở http://localhost:8081, đăng nhập như [§4.7](00-cong-cu-va-moi-truong.md#47-giao-diện-web-đi-kèm) | Thấy database `gfmaster` (chưa có bảng) |
| RabbitMQ UI | http://localhost:15672, `gfm`/`gfm` | Trang Overview |
| Redis | `docker compose exec redis redis-cli ping` | `PONG` |
| Không commit bí mật | `git ls-files \| Select-String "\.env$"` | Không có kết quả |

---

## 5. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop chưa mở | Mở Docker Desktop, chờ trạng thái "running" |
| `Bind for 0.0.0.0:3306 failed: port is already allocated` | Máy đã có MySQL/MariaDB khác chiếm cổng 3306 | Tắt dịch vụ kia, hoặc đổi mapping thành `"3307:3306"` và sửa `DB_URL` |
| Container `mariadb` cứ `unhealthy` | Lần đầu khởi tạo DB mất 20–60 giây | Chờ thêm, xem `docker compose logs mariadb` |
| `LF will be replaced by CRLF` | Cảnh báo line ending | Bình thường, xem §2.3 |
| Muốn làm lại DB từ đầu | Dữ liệu cũ nằm trong volume | `docker compose down -v` rồi `up -d`. **Mất hết dữ liệu dev.** |

---

**Tiếp theo:** [Phase 1: Khung Spring Boot và Flyway](02-phase-1-khung-spring-boot-flyway.md)
