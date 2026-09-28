# Phase 5: Xử lý đồng thời (Concurrency)

> **Kết quả:** hai tab (hoặc hai thiết bị) cùng sửa một mục thì tab lưu sau thấy dialog "Dữ liệu đã thay đổi" và tự chọn **Tải bản mới** hoặc **Ghi đè**. Bấm "Lưu" nhiều lần hay mạng chập chờn khiến trình duyệt gửi lại cũng không tạo bản ghi trùng.
> **Commit:** `feat: idempotency keys, version conflict dialog and concurrency tests (Phase 5)`

---

## 1. Mục tiêu

- **Không mất dữ liệu âm thầm** khi hai nơi cùng sửa một bản ghi (lost update).
- **Không tạo bản trùng** khi cùng một yêu cầu tạo mới được gửi nhiều lần.
- Có **test chạy song song thật** chứng minh hai điều trên, không chỉ test tuần tự.

Phần kiểm tra `version` và mã 409 `VERSION_CONFLICT` đã làm từ [Phase 2 §2.4](03-phase-2-crud-api.md#24-optimistic-locking-và-version). Phase này bổ sung phần còn thiếu: Idempotency-Key, dialog xung đột ở frontend và bộ test đồng thời.

---

## 2. Kiến thức cần biết

### 2.1. Race condition và lost update

**Race condition** là khi kết quả phụ thuộc vào thứ tự ngẫu nhiên của các thao tác chạy song song. Ví dụ kinh điển là **lost update**:

```
Tab A: đọc quán (version 0) ── sửa tên "A" ─────────── lưu ──► tên = "A"
Tab B: đọc quán (version 0) ──────── sửa giờ mở cửa ───────── lưu ──► tên bị trả về tên cũ, "A" biến mất
```

Không ai báo lỗi, nhưng thay đổi của tab A bị ghi đè mà không ai biết.

### 2.2. Optimistic locking nhắc lại

Mỗi bản ghi có cột `version`. Client gửi kèm version mình đang giữ, server chỉ ghi nếu version còn khớp:

```sql
UPDATE places SET name = ?, version = 1 WHERE id = ? AND version = 0
```

Có **hai lớp** chặn, cho hai tình huống khác nhau:

| Tình huống | Ai chặn | Response |
|---|---|---|
| Client gửi version cũ (tab B mở từ lâu) | Service so sánh `patch.version()` với DB | 409 kèm `current` (bản mới nhất) |
| Hai request cùng đọc version 0, cùng qua bước so sánh | Câu `UPDATE ... WHERE version = 0` của Hibernate: bản sau cập nhật 0 dòng, ném `ObjectOptimisticLockingFailureException` | 409 **không** kèm `current` (lúc đó transaction đã hỏng, không đọc thêm được) |

Frontend xử lý cả hai: không có `current` thì tự `GET` lại bản mới nhất.

> **Optimistic và pessimistic:** *optimistic* (lạc quan) cho mọi người sửa thoải mái, chỉ kiểm tra lúc ghi. *Pessimistic* (bi quan) khoá bản ghi ngay lúc đọc (`SELECT ... FOR UPDATE`), người khác phải chờ. Web app ít xung đột nên chọn optimistic: không giữ khoá trong lúc người dùng đang gõ.

### 2.3. Idempotency và Idempotency-Key

Một thao tác **idempotent** (luỹ đẳng) là làm một lần hay nhiều lần thì kết quả cuối vẫn như nhau. Theo chuẩn HTTP:

| Method | Idempotent? | Vì sao |
|---|---|---|
| `GET`, `PUT`, `DELETE` | Có | Đọc lại, ghi đè cùng giá trị, xoá cái đã xoá: kết quả không đổi |
| `PATCH` ở dự án này | Gần như có | Gửi lại với version cũ thì nhận 409, không ghi hai lần |
| `POST` (tạo mới) | **Không** | Mỗi lần gửi tạo **thêm** một bản ghi |

Vấn đề thực tế: người dùng bấm "Lưu", server **đã tạo** xong nhưng response bị mất trên đường về (Wi-Fi rớt). Trình duyệt báo lỗi, người dùng bấm "Lưu" lần nữa, và thế là có hai quán giống hệt nhau.

**Idempotency-Key** biến POST thành idempotent. Client gắn một mã ngẫu nhiên (UUID) cho **mỗi ý định tạo mới**, gửi lại thì dùng đúng mã cũ. Server nhớ "mã này đã xử lý, kết quả là X" và trả lại X thay vì tạo lần hai. Stripe, PayPal và nhiều API thanh toán dùng cách này.

### 2.4. Luồng IdempotencyFilter trên Redis

```
POST /api/v1/places   Idempotency-Key: 7f3a...
        │
        ▼
SET idem:{userId}:7f3a {"path":..., "status":0} NX EX 300      (NX = chỉ set nếu chưa có)
        │
   ┌────┴─────────────────────────────┐
 set được (lần đầu)               không set được (đã có key)
   │                                  │
   ▼                                  ▼
 xử lý bình thường               đọc giá trị trong Redis
   │                               ├─ path khác       → 422 IDEMPOTENCY_KEY_REUSED
   ├─ 2xx/4xx → lưu {status,        ├─ status = 0      → 409 IDEMPOTENCY_IN_PROGRESS
   │   body, Location} EX 24h       └─ đã xong         → trả lại status + body cũ
   └─ 5xx/401/403/429 → xoá key                          + header Idempotent-Replayed: true
```

Vài điểm thiết kế:

- **`SET NX` là thao tác nguyên tử** trong Redis. 10 request đến cùng lúc thì đúng **một** request set được, 9 request còn lại thấy key đã có. Đây là chỗ chặn race condition.
- **Key gắn với userId**: user A và user B vô tình dùng cùng một mã cũng không đụng nhau.
- **Hai TTL**: trạng thái "đang xử lý" chỉ giữ 5 phút (`in-progress-ttl`), để nếu app chết giữa chừng thì key tự nhả. Kết quả đã xong giữ 24 giờ (`ttl`).
- **Lỗi 5xx không lưu**: lỗi server có thể là tạm thời, nên client được thử lại với cùng key. Lỗi 4xx (dữ liệu sai) thì lưu, vì gửi lại y hệt vẫn sai.
- **Không áp dụng cho `/auth/**`**: nếu áp dụng, response đăng nhập (chứa access token) sẽ bị lưu vào Redis.

> **`ContentCachingResponseWrapper`**: response của servlet được ghi thẳng ra mạng, đọc lại không được. Wrapper này giữ một bản sao body trong bộ nhớ để filter lưu vào Redis, rồi `copyBodyToResponse()` mới thật sự gửi đi.

### 2.5. Frontend: khi nào dùng lại key?

Sinh key mới cho **mỗi request** thì vô dụng: lần bấm "Lưu" thứ hai là một request mới, có key mới. Key phải gắn với **ý định** tạo mới.

`CrudStore.create()` dùng một `Map<body, key>`:

- Gửi lần đầu: sinh key, ghi vào map.
- Lỗi (mất mạng, 5xx...) rồi bấm "Lưu" lại với **đúng dữ liệu đó**: lấy lại key cũ.
- Thành công: xoá khỏi map. Lần tạo sau, dù trùng dữ liệu, là một bản ghi mới thật sự, nên có key mới.
- Người dùng sửa dữ liệu rồi gửi lại: body khác nên key khác. Đúng, vì đó là một yêu cầu khác.

Thứ tự interceptor: `errorInterceptor → idempotencyInterceptor → authInterceptor`. `idempotencyInterceptor` đứng **trước** `authInterceptor`, nên khi access token hết hạn và `authInterceptor` gửi lại request sau khi refresh, header `Idempotency-Key` vẫn giữ nguyên.

### 2.6. Dialog xung đột

Trước Phase 5, gặp 409 thì store lặng lẽ thay bằng bản của server và hiện toast. Người dùng mất phần mình vừa gõ mà không được hỏi. Giờ store **hỏi**:

```
PATCH → 409 VERSION_CONFLICT
   │  (errorInterceptor không hiện toast: request có SILENT_CODES = ['VERSION_CONFLICT'])
   ▼
nạp bản mới nhất vào state (từ `current`, hoặc GET lại nếu không có)
   ▼
await conflicts.ask({ name })   ──► ConflictDialogComponent hiện dialog
   ├─ "Tải bản mới" (hoặc đóng dialog) → trả về bản server, form đóng
   └─ "Ghi đè"                          → PATCH lại thay đổi của mình với version mới
```

`ConflictService` giữ một `signal` câu hỏi đang chờ và một hàm `resolve` của Promise. Component chỉ việc đọc signal và gọi `choose()`. Nhờ vậy store (không phải component) vẫn `await` được câu trả lời của người dùng. Dialog gắn một lần ở [app.ts](../frontend/src/app/app.ts), dùng chung cho quán, người yêu và liên kết.

Đóng dialog (✕, bấm ra ngoài) được coi là **Tải bản mới**, vì đó là lựa chọn không làm mất dữ liệu của nơi khác.

### 2.7. Test đồng thời: `ExecutorService` và `CountDownLatch`

Chạy 2 request **tuần tự** thì không bao giờ có race. Muốn thử thật phải cho chúng xuất phát cùng lúc:

```java
CountDownLatch start = new CountDownLatch(1);          // "cổng" đang đóng
ExecutorService pool = Executors.newFixedThreadPool(10);
for (...) pool.submit(() -> { start.await(); return mvc.perform(request); });  // 10 luồng chờ ở cổng
start.countDown();                                      // mở cổng: cả 10 luồng chạy cùng lúc
```

- **`ExecutorService`**: nhóm luồng (thread pool) chạy các tác vụ song song.
- **`CountDownLatch`**: bộ đếm lùi. Luồng gọi `await()` sẽ đứng chờ tới khi bộ đếm về 0.
- **`Future.get(timeout)`**: lấy kết quả của từng luồng, có giới hạn thời gian để test không treo mãi.

Request được dựng sẵn **trước** khi mở cổng (tạo JWT tốn thời gian), để các luồng xuất phát sát nhau nhất có thể.

---

## 3. Các bước thực hiện

### Bước 1: Cấu hình

- [GfmProperties.java](../backend/src/main/java/com/gfmaster/config/GfmProperties.java): thêm `Idempotency(ttl, inProgressTtl)`.
- [application.yml](../backend/src/main/resources/application.yml): `gfm.idempotency.ttl: 24h`, `in-progress-ttl: 5m`.
- [ErrorCode.java](../backend/src/main/java/com/gfmaster/common/error/ErrorCode.java): thêm `IDEMPOTENCY_KEY_REUSED` (422). `IDEMPOTENCY_IN_PROGRESS` (409) đã khai báo từ trước.

### Bước 2: IdempotencyFilter

[IdempotencyFilter.java](../backend/src/main/java/com/gfmaster/common/web/IdempotencyFilter.java) làm theo §2.4:
- Chỉ áp dụng cho `POST /api/**` có header `Idempotency-Key`, bỏ qua `/api/v1/auth/**`.
- Key phải gồm 8–100 ký tự `[A-Za-z0-9_-]`, sai thì trả 400 `MALFORMED_REQUEST`.
- Giá trị trong Redis là JSON `{path, status, contentType, location, body}`. `status = 0` nghĩa là đang xử lý.

Gắn vào [SecurityConfig.java](../backend/src/main/java/com/gfmaster/config/SecurityConfig.java) **sau** `RateLimitFilter`. Thứ tự này có hai lý do:
- Cần `userId` từ JWT.
- Request bị rate limit (429) không chiếm key.

Giống `RateLimitFilter`, filter này **không** đánh dấu `@Component` (xem [Phase 4 Bước 4](05-phase-4-xac-thuc-jwt.md#bước-4-security)). CORS mở thêm header `Idempotent-Replayed` cho client đọc được.

### Bước 3: Test backend

[ConcurrencyIT.java](../backend/src/test/java/com/gfmaster/ConcurrencyIT.java) có 3 test chạy song song trên MariaDB và Redis thật:

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| 1 | 2 luồng PATCH cùng quán, cùng `version: 0` | Đúng 1 bản 200 và 1 bản 409 `VERSION_CONFLICT`. Version trong DB = 1, tên là của bên thắng |
| 2 | 10 luồng POST cùng `Idempotency-Key` | Chỉ có 201 (cùng một `id`) hoặc 409 `IDEMPOTENCY_IN_PROGRESS`. DB có **đúng 1** quán |
| 3 | 2 luồng gắn cùng quán cho cùng người yêu | 1 bản 201 và 1 bản 409 `LINK_ALREADY_EXISTS` (unique constraint `uk_link_gf_place`). DB có 1 link |

Test thứ 4 trong [PLAN.md §12](../PLAN.md) (2 lần import song song, 202 + 423) cần tính năng import, nên sẽ viết ở **Phase 8**.

[IdempotencyIT.java](../backend/src/test/java/com/gfmaster/common/web/IdempotencyIT.java) có 8 test tuần tự:
- Gửi lại thì nhận nguyên response cũ: cùng `id`, cùng `Location`, có header `Idempotent-Replayed`, TTL còn hơn 1 giờ.
- Hai key khác nhau thì tạo hai bản. Không gửi header thì không chống trùng.
- Key tách riêng theo user.
- Dùng cùng key cho endpoint khác thì nhận 422.
- Lỗi 400 cũng được trả lại y như lần đầu.
- Key sai định dạng thì nhận 400 và không tạo gì.
- Request chưa đăng nhập không để lại key trong Redis.

### Bước 4: Frontend

1. [http-context.ts](../frontend/src/app/core/api/http-context.ts): thêm `IDEMPOTENCY_KEY` (key do nơi gọi chọn) và `SILENT_CODES` (các mã lỗi nơi gọi tự xử lý).
2. [idempotency.interceptor.ts](../frontend/src/app/core/api/idempotency.interceptor.ts): gắn header cho `POST /api` (trừ `/auth`). Lấy key từ context, không có thì sinh `crypto.randomUUID()`.
3. [error.interceptor.ts](../frontend/src/app/core/api/error.interceptor.ts): không hiện toast cho mã nằm trong `SILENT_CODES`.
4. [app.config.ts](../frontend/src/app/app.config.ts): `withInterceptors([errorInterceptor, idempotencyInterceptor, authInterceptor])`.
5. [conflict.service.ts](../frontend/src/app/core/services/conflict.service.ts) và [conflict-dialog.component.ts](../frontend/src/app/shared/ui/conflict-dialog.component.ts), gắn vào [app.ts](../frontend/src/app/app.ts).
6. [crud-store.ts](../frontend/src/app/core/services/crud-store.ts):
   - `create()`: dùng lại key cho cùng body (§2.5).
   - `update()`: gặp `VERSION_CONFLICT` thì gọi `resolveConflict()` (§2.6). Nếu `GET` lại cũng lỗi thì hoàn tác (hoặc bỏ khỏi state nếu 404) rồi ném lỗi.

**Component không cần sửa.** "Tải bản mới" và "Ghi đè" đều làm `update()` trả về bình thường, nên form tự đóng như khi lưu thành công. Các lỗi khác vẫn được ném ra như trước, nên form giữ nguyên.

### Bước 5: Test frontend

- [crud-store.spec.ts](../frontend/src/app/core/services/crud-store.spec.ts):
  - Gửi lại sau khi mất mạng thì dùng lại key cũ; sau khi thành công thì dùng key mới.
  - Xung đột, chọn "Tải bản mới" thì giữ bản của server.
  - Xung đột, chọn "Ghi đè" thì PATCH lại với version của server.
  - Response không có `current` thì tự `GET` lại.
- [idempotency.interceptor.spec.ts](../frontend/src/app/core/api/idempotency.interceptor.spec.ts):
  - Header lấy từ context, không có thì tự sinh.
  - Không gắn header cho `/auth` và `PATCH`.

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend;  .\mvnw.cmd verify           # 55 test (44 cũ + 3 ConcurrencyIT + 8 IdempotencyIT)
cd D:\GF_Master\frontend; npx ng test --watch=false    # 17 test
```

Thử bằng curl (cần access token, lấy như [Phase 4 §4](05-phase-4-xac-thuc-jwt.md#4-kiểm-tra-kết-quả)):

```powershell
$k = [guid]::NewGuid()
# Gửi 2 lần cùng key: lần 2 có header Idempotent-Replayed: true và cùng "id"
curl.exe -i -H "Authorization: Bearer $t" -H "Content-Type: application/json" -H "Idempotency-Key: $k" `
  -d '{\"type\":\"cafe\",\"name\":\"Thu\",\"priceRange\":\"cheap\",\"rating\":3,\"openTime\":\"07:00\",\"closeTime\":\"21:00\"}' `
  http://localhost:4200/api/v1/places

# Xem key trong Redis
docker compose exec redis redis-cli --scan --pattern "idem:*"
```

Thử trên trình duyệt:
1. Mở cùng một quán ở hai tab.
2. Tab 1 sửa tên rồi lưu.
3. Tab 2 (chưa tải lại) sửa rồi lưu. Dialog **"Dữ liệu đã thay đổi"** hiện ra.
4. Chọn *Tải bản mới* thì thấy tên của tab 1. Làm lại và chọn *Ghi đè* thì thay đổi của tab 2 được lưu.

---

## 5. Lỗi đã gặp và bài học

### 5.1. Test fixture sai giá trị enum

`IdempotencyIT` ban đầu gửi `"priceRange": "low"` và nhận 400 `MALFORMED_REQUEST`, trong khi enum chỉ có `cheap | medium | high | luxury`. Enum sai làm Jackson không đọc được body, nên lỗi là `MALFORMED_REQUEST` chứ không phải `VALIDATION_FAILED`.

Bài học: khi test kiểm tra một lớp "bọc ngoài" như filter, trước hết phải chắc request **tự nó** hợp lệ. Nếu không, bạn đang test nhầm lỗi của lớp khác.

### 5.2. Tham số mặc định của JavaScript nuốt mất `undefined`

Hàm test `conflict(current = other)` được gọi bằng `conflict(undefined)` để giả lập "server không kèm `current`". Nhưng trong JavaScript, truyền `undefined` **kích hoạt giá trị mặc định**, nên response vẫn có `current` và nhánh `GET` lại không bao giờ chạy. Sửa bằng cách truyền `null` rồi đổi `null` thành `undefined` khi flush.

### 5.3. Chờ một nhịp sau khi người dùng chọn

Sau `conflicts.choose('overwrite')`, store chỉ gửi PATCH mới khi Promise của `ask()` được resolve, tức là ở microtask kế tiếp. Test phải `await tick()` rồi mới `expectOne(...)`. Cùng nguyên nhân với [Phase 4 §5.3](05-phase-4-xac-thuc-jwt.md#53-unit-test-angular-chờ-không-đủ-microtask).

### 5.4. Hạn chế đã biết

- **Không so sánh body**: cùng key, cùng đường dẫn nhưng body khác vẫn nhận lại response cũ. Frontend luôn sinh key theo body nên không gặp. Nếu mở API cho bên thứ ba, cần lưu thêm hash của body và trả 422 khi lệch.
- **Ghi đè là ghi đè toàn bộ các field đã sửa**: không gộp từng field (merge) như Google Docs. Đủ dùng cho dữ liệu cá nhân, ít người sửa cùng lúc.
- **Chưa thử dialog bằng trình duyệt tự động**: luồng dialog đã có unit test, còn E2E hai tab bằng Playwright để ở Phase 9.

---

**Trước:** [Phase 4](05-phase-4-xac-thuc-jwt.md) · **Tiếp theo:** Phase 6 (RabbitMQ, xem [PLAN.md](../PLAN.md)) · **Tra cứu:** [Thuật ngữ](99-thuat-ngu.md)
