# Tài liệu GF Master (Dating Master)

Bộ tài liệu này kể lại **từng bước** quá trình biến một SPA Angular lưu dữ liệu trong `localStorage` thành một web app có backend thật. Mỗi file ứng với một phase trong [PLAN.md](../PLAN.md). Mỗi file đều giải thích **khái niệm kỹ thuật** và **công cụ** cần biết để hiểu, tự làm lại, hoặc sửa phần đó.

> **Đối tượng đọc:** lập trình viên đã biết lập trình cơ bản (biến, hàm, class, HTTP là gì) nhưng chưa quen hệ sinh thái Spring Boot, Angular, Docker, hoặc các kỹ thuật bảo mật web.

## Đọc theo thứ tự nào?

| # | File | Nội dung | Trạng thái |
|---|---|---|---|
| — | [00-cong-cu-va-moi-truong.md](00-cong-cu-va-moi-truong.md) | Cài đặt và hiểu các công cụ: Git, Docker, JDK, Maven, Node, Angular CLI… | Nên đọc đầu tiên |
| 0 | [01-phase-0-chuan-bi.md](01-phase-0-chuan-bi.md) | Git repo, `.gitignore`, hạ tầng bằng Docker Compose | ✅ Đã làm |
| 1 | [02-phase-1-khung-spring-boot-flyway.md](02-phase-1-khung-spring-boot-flyway.md) | Khung Spring Boot, schema Flyway, entity JPA, test Testcontainers | ✅ Đã làm |
| 2 | [03-phase-2-crud-api.md](03-phase-2-crud-api.md) | REST API CRUD, DTO, PATCH, optimistic locking, chống IDOR, N+1 | ✅ Đã làm |
| 3 | [04-phase-3-frontend-noi-api-upload.md](04-phase-3-frontend-noi-api-upload.md) | Angular gọi API, optimistic UI, upload ảnh | ✅ Đã làm |
| 4 | [05-phase-4-xac-thuc-jwt.md](05-phase-4-xac-thuc-jwt.md) | Đăng nhập JWT, refresh token trong Redis, rate limit | ✅ Đã làm |
| 5 | [06-phase-5-concurrency.md](06-phase-5-concurrency.md) | Idempotency-Key, dialog xung đột version, test chạy song song | ✅ Đã làm |
| 6–11 | [PLAN.md §14](../PLAN.md) | RabbitMQ, Maps, Import, Deploy… | ⏳ Chưa làm, sẽ viết thêm tài liệu khi làm |
| — | [99-thuat-ngu.md](99-thuat-ngu.md) | Bảng tra thuật ngữ A–Z | Tra cứu |

Mỗi file phase có cùng bố cục:

1. **Mục tiêu**: phase này giải quyết vấn đề gì.
2. **Kiến thức cần biết**: các khái niệm, giải thích từ đầu.
3. **Các bước thực hiện**: làm gì, theo thứ tự, file nào.
4. **Kiểm tra kết quả**: lệnh để tự xác nhận phase chạy đúng.
5. **Lỗi đã gặp và bài học**: những chỗ đã vấp khi làm thật.

## Bức tranh tổng thể

```
 Trình duyệt ──HTTPS──► Caddy (reverse proxy, chưa làm - Phase 10)
                          │  /            → file tĩnh Angular
                          │  /api/*       → Spring Boot :8080
                          │  /uploads/*   → Spring Boot :8080
                          ▼
                 Spring Boot (Java 21)
                   │         │          │
                   ▼         ▼          ▼
                MariaDB    Redis     RabbitMQ
               (dữ liệu)  (phiên,   (việc chạy nền,
                          rate limit) từ Phase 6)
```

Khi phát triển trên máy (dev), Caddy chưa có. Vai trò "cùng một địa chỉ" do **proxy của Angular dev server** đảm nhận: `http://localhost:4200/api/*` được chuyển sang `http://localhost:8080`. Xem [Phase 3 §2.4](04-phase-3-frontend-noi-api-upload.md#24-dev-proxy-same-origin-và-cors).

## Chạy nhanh toàn bộ dự án

```powershell
# 1. Hạ tầng (MariaDB, Redis, RabbitMQ, Adminer)
cd D:\GF_Master
docker compose up -d

# 2. Backend: http://localhost:8080  (Swagger: /api/docs)
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"

# 3. Frontend: http://localhost:4200  (terminal khác)
cd ..\frontend
npm install     # lần đầu
npm start

# Đăng nhập demo: demo@gfmaster.local / Demo@12345
```

Chạy test:

```powershell
cd backend;  .\mvnw.cmd verify        # 44 test tích hợp (cần Docker đang chạy)
cd frontend; npx ng test --watch=false # 12 unit test
```
