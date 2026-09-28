# Phase 8: Import bất đồng bộ dữ liệu localStorage cũ

> **Kết quả:**
> - Người từng dùng bản cũ (dữ liệu nằm trong localStorage của trình duyệt) đăng nhập xong sẽ được hỏi *"Tìm thấy dữ liệu cũ… Tải lên tài khoản?"*. Đồng ý thì server nhập quán, người yêu, lần đi cùng **và ảnh** ở nền, rồi báo lại kết quả.
> - Import lần hai trong lúc lần một chưa xong thì nhận **423**.
>
> **Commit:** `feat: asynchronous import of legacy localStorage data (Phase 8)`

---

## 1. Mục tiêu

- Không bắt người dùng cũ nhập lại tay dữ liệu đã có.
- Import có thể nặng (nhiều ảnh base64): **không** làm trong request. Request trả `202 Accepted` ngay, việc chạy ở nền qua RabbitMQ.
- **Được ăn cả, ngã về không:** lỗi giữa chừng thì không để lại nửa dữ liệu.
- Mỗi user chỉ một lần import chạy tại một thời điểm, kể cả khi có nhiều instance.

---

## 2. Kiến thức cần biết

### 2.1. 202 Accepted và polling

```
Trình duyệt                          Server
POST /import/local-storage  ───────► kiểm tra, lấy khoá, lưu job QUEUED, phát import.requested
                            ◄─────── 202 { jobId }   Location: /api/v1/import/jobs/{jobId}
GET /import/jobs/{jobId}    ───────► { status: "RUNNING" }        ← mỗi giây một lần
GET /import/jobs/{jobId}    ───────► { status: "DONE", stats: {...} }
```

**202 Accepted** nghĩa là "đã nhận, sẽ xử lý sau". Khác với 201 Created: lúc trả về, dữ liệu **chưa** được tạo. Client biết kết quả bằng cách **hỏi lại theo chu kỳ** (*polling*). Cách khác là server chủ động báo qua WebSocket hoặc SSE, nhưng import hiếm khi dùng nên polling là đủ.

### 2.2. Khoá phân tán (distributed lock) bằng Redis

Hai import cùng lúc của một user có thể tạo dữ liệu trùng. Khoá phải dùng chung cho **mọi instance**, nên đặt trong Redis:

```
SET lock:import:{userId} <token ngẫu nhiên> NX EX 600   → OK: được chạy / nil: 423 IMPORT_RUNNING
...
-- nhả khoá: chỉ xoá nếu giá trị vẫn là token của mình (Lua, nguyên tử)
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
```

- **Vì sao cần token?** Nếu consumer chạy quá 10 phút, khoá hết hạn, rồi user bắt đầu lần import mới (khoá mới). Lúc đó consumer cũ chạy xong mà xoá thẳng thì sẽ nhả nhầm khoá của lần mới. Có token thì chỉ ai giữ đúng token mới xoá được.
- **Vì sao không dùng Redisson như PLAN?** Khoá được lấy ở request API nhưng nhả ở consumer, tức là một luồng khác, có khi ở instance khác. `RLock` của Redisson gắn với luồng đã lấy nó, nên luồng khác không `unlock()` được. Làm bằng `SET NX` và token thì vừa đúng vừa không phải thêm thư viện.
- **TTL 10 phút** là lưới an toàn khi consumer chết giữa chừng.

### 2.3. Một transaction cho cả lần import

```
tx 1 (REQUIRES_NEW): QUEUED → RUNNING
tx 2 (REQUIRES_NEW): tạo quán, người yêu, link, upload ảnh ... + job DONE, stats, payload = NULL
      ├─ lỗi → rollback toàn bộ tx 2 (kể cả xoá file ảnh đã ghi, §2.5) → tx 3: job FAILED + error
finally: nhả khoá
```

Trạng thái **DONE được ghi trong cùng transaction** với dữ liệu nhập. Nhờ vậy khi message bị giao lại (RabbitMQ là at-least-once, [Phase 6 §2.4](07-phase-6-rabbitmq.md#24-at-least-once-và-consumer-idempotent)):
- Job đã DONE thì dữ liệu chắc chắn đã có: bỏ qua.
- Job còn RUNNING thì tx 2 chưa commit, chưa có gì được lưu: chạy lại an toàn.

`REQUIRES_NEW` vì lý do giống [Phase 6 §2.10](07-phase-6-rabbitmq.md#210-bẫy-transactional-bên-trong-after_commit): khi tắt RabbitMQ, import chạy trong callback AFTER_COMMIT của request.

### 2.4. Dữ liệu bẩn: bỏ qua dòng hỏng, không từ chối cả file

Dữ liệu localStorage cũ chưa từng qua kiểm tra nào: có quán thiếu tên, link trỏ tới quán đã xoá... Nếu từ chối cả file thì người dùng không làm gì được. Vì vậy [LegacyImporter](../backend/src/main/java/com/gfmaster/importer/LegacyImporter.java) xử lý từng dòng:
1. Chuyển sang đúng DTO của API (`PlaceRequest`, `GirlfriendRequest`, `PlaceLinkRequest`) và chạy **Bean Validation** giống như request thật.
2. Hỏng thì **bỏ qua** và ghi lý do vào `stats.skippedReasons` (tối đa 20 dòng).
3. Hợp lệ thì gọi **đúng service** như API (`PlaceService.create`...). Nhờ đó được chuẩn hoá y như khi tạo tay: bỏ `cuisine` của cafe, tự điền toạ độ từ link Maps (Phase 7), phát event để xoá cache.

Id cũ dạng chuỗi (`place_cafe_1`) được **ánh xạ** sang UUID mới, rồi link dùng bảng ánh xạ đó. Cặp (người, quán) trùng thì bỏ qua **trước khi** gửi xuống DB. Nếu để DB báo lỗi vi phạm unique, cả transaction sẽ bị đánh dấu rollback.

### 2.5. Ảnh base64 và file ghi ngoài transaction

Frontend cũ lưu ảnh thẳng dạng `data:image/png;base64,...`. Importer decode, rồi đưa qua `UploadService.storeImage(bytes)`, tức là cùng đường với upload thường: kiểm tra magic bytes, thu về 1200px, WebP, ghi bảng `uploads`, sinh thumbnail ở nền.

**Vấn đề:** ghi file **không** nằm trong transaction DB. Nếu tx 2 rollback thì file đã ghi không còn bản ghi nào trỏ tới, và job dọn ảnh mồ côi (chỉ quét bảng `uploads`) cũng không thấy. **Sửa:** `UploadService` đăng ký một `TransactionSynchronization`; `afterCompletion(STATUS_ROLLED_BACK)` thì xoá file vừa ghi. Việc này áp dụng cho cả endpoint upload thường.

Ảnh chỉ được xử lý **sau** khi dòng đã qua validation, nên dòng bị bỏ qua không để lại ảnh thừa.

### 2.6. Payload nằm ở đâu?

PLAN ban đầu định lưu JSON gốc vào storage. Nhưng storage local được phục vụ **công khai** qua `/uploads/**`, nên file chứa tên và số điện thoại sẽ tải về được nếu ai đó đoán ra đường dẫn. Migration **V2** thêm cột `import_jobs.payload` (LONGTEXT):
- Xong thì payload bị xoá (`NULL`).
- Job lỗi giữ payload 3 ngày để xem nguyên nhân, sau đó [ImportJobCleanup](../backend/src/main/java/com/gfmaster/importer/ImportJobCleanup.java) (mỗi giờ, ShedLock) xoá.
- Job kẹt ở QUEUED/RUNNING quá 1 giờ (message bị mất) thì chuyển sang FAILED, để người dùng thử lại.

Giới hạn **10MB** (`gfm.importer.max-size`): localStorage của trình duyệt chỉ khoảng 5–10MB, và mức này nhỏ hơn `max_allowed_packet` 16MB của MariaDB. Controller **đếm byte khi đọc** chứ không tin header `Content-Length`, vì header này có thể thiếu hoặc bị gửi sai.

### 2.7. Frontend: khi nào hỏi?

[readLegacyData](../frontend/src/app/core/services/legacy-import.service.ts) đọc `gfm.places`, `gfm.girlfriends`, `gfm.placeLinks`. Nếu đó là **bộ dữ liệu mẫu còn nguyên** (đúng 10/2/4 bản ghi, mọi `createdAt/updatedAt` đều là `2026-01-01T00:00:00.000Z`) thì coi như không có, để không hỏi người chỉ mở thử bản cũ.

| Người dùng chọn | Kết quả |
|---|---|
| **Tải lên** | POST, rồi hỏi trạng thái mỗi giây (tối đa 5 phút). DONE thì đổi tên key thành `gfm.*.imported` (không xoá hẳn) và tải lại dữ liệu |
| **Để sau** | Lần mở app tới hỏi lại |
| **Không nhập** | Đổi tên key thành `gfm.*.skipped`: không hỏi nữa nhưng dữ liệu vẫn còn |
| Lỗi (423, mạng, FAILED) | Dialog báo lỗi, có nút *Thử lại*; dữ liệu cũ còn nguyên |

POST import tự có `Idempotency-Key` ([Phase 5](06-phase-5-concurrency.md)), nên bấm hai lần hoặc mạng chập chờn không tạo hai job.

---

## 3. Các bước thực hiện

### Bước 1: Schema và cấu hình

- [V2__import_payload.sql](../backend/src/main/resources/db/migration/V2__import_payload.sql): thêm `payload LONGTEXT NULL`, cho `payload_key` được NULL. `ImportJob` thêm field `payload`.
- `gfm.importer.max-size: 10MB`, `lock-ttl: 10m`. Mã lỗi mới: `IMPORT_TOO_LARGE` (413).

### Bước 2: API

- [ImportController](../backend/src/main/java/com/gfmaster/importer/ImportController.java):
  - `POST /api/v1/import/local-storage` trả `202 {jobId}` kèm `Location`.
  - `GET /api/v1/import/jobs/{id}` trả `{id, status, stats, error, createdAt, finishedAt}`. Job của user khác thì 404.
- [ImportService.start](../backend/src/main/java/com/gfmaster/importer/ImportService.java) chạy theo thứ tự: parse JSON (hỏng thì 400) → không có dữ liệu thì 400 → lấy khoá (không được thì 423) → lưu job và phát `ImportRequested(userId, jobId, lockToken)`. Lỗi ở bước lưu thì nhả khoá ngay.

### Bước 3: Consumer

- Queue `gfm.import` (routing key `import.requested`) có DLQ.
- Container factory riêng `importListenerFactory`: **prefetch 1**, 1–2 consumer, vì import nặng. Các cấu hình khác (retry...) lấy từ `application.yml` qua `SimpleRabbitListenerContainerFactoryConfigurer`.
- `EventConsumers.onImportRequested` và `DirectEventDispatcher` (khi tắt RabbitMQ) cùng gọi `ImportService.run()` (§2.3).

### Bước 4: Frontend

- [legacy-import.service.ts](../frontend/src/app/core/services/legacy-import.service.ts): trạng thái `none | offer | running | done | failed`, polling, đổi tên key.
- [legacy-import-dialog.component.ts](../frontend/src/app/shared/ui/legacy-import-dialog.component.ts): gắn trong `ShellComponent`, nên chỉ hiện khi đã đăng nhập. Dialog "đang chạy" không cho đóng.

### Bước 5: Test

| File | Nội dung |
|---|---|
| [ImportIT](../backend/src/test/java/com/gfmaster/importer/ImportIT.java) (4) | Payload giống hệt localStorage cũ (id chuỗi, ảnh data: URL 1600px, field thừa, 4 dòng hỏng): DONE với 2 quán, 1 người, 1 link, 1 ảnh, 4 dòng bỏ qua; ảnh được thu về và phục vụ được; toạ độ điền từ link; hobby rỗng bị bỏ; khoá được nhả; payload bị xoá. Lần hai khi lần một chưa xong thì 423, user khác không bị ảnh hưởng, xong rồi thì import tiếp được. JSON hỏng/rỗng thì 400, quá 10MB thì 413, không để lại khoá hay job. Job của người khác thì 404 |
| [ConcurrencyIT](../backend/src/test/java/com/gfmaster/ConcurrencyIT.java) (+1) | Ca **(4)** còn nợ từ Phase 5: 2 import song song thì đúng một bên 202, một bên 423, DB chỉ có 1 job |
| [DirectEventDispatcherIT](../backend/src/test/java/com/gfmaster/messaging/DirectEventDispatcherIT.java) (+1) | Import chạy trong `afterCommit` vẫn lưu được dữ liệu và DONE (bắt lỗi `REQUIRED`) |
| [legacy-import.service.spec.ts](../frontend/src/app/core/services/legacy-import.service.spec.ts) (7) | Nhận ra bộ mẫu còn nguyên, bản ghi đã sửa, JSON hỏng. Luồng POST, polling RUNNING rồi DONE, đổi tên key, tải lại. 423 thì báo lỗi và giữ dữ liệu. "Không nhập" thì đổi tên sang `.skipped` |

Để test 423 ổn định, consumer `gfm.import` được **tạm dừng** (`RabbitListenerEndpointRegistry.stop()`). Nếu không, lần một có thể xong và nhả khoá trước khi lần hai tới.

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend;  .\mvnw.cmd clean verify     # 114 test
cd D:\GF_Master\frontend; npx ng test --watch=false   # 37 test
```

Thử trên trình duyệt (backend profile dev, `npm start`):
1. Mở DevTools → Console, giả lập dữ liệu bản cũ:
   ```js
   localStorage.setItem('gfm.girlfriends', JSON.stringify([{ id: 'gf_x', name: 'Lan', hobbies: ['Trà'], status: 'crush' }]));
   ```
2. Tải lại trang (đã đăng nhập): dialog *Tìm thấy dữ liệu cũ* hiện ra. Chọn *Tải lên*, vài giây sau thấy "Đã thêm … 1 người", danh sách người yêu có Lan.
3. Trong localStorage, key cũ đã thành `gfm.girlfriends.imported`.

---

## 5. Lỗi đã gặp và bài học

### 5.1. `Cache.put()` cũng được phép ghi trễ

Một test cũ kiểm tra key cache có ngay sau `@Cacheable`. Test này đỏ ngẫu nhiên khi chạy cả bộ. Javadoc của `Cache.put()` cũng ghi "may be performed in an asynchronous or deferred fashion", giống `evict()` ([Phase 6 §5.3](07-phase-6-rabbitmq.md#53-cache-không-bị-xoá-ngay-sau-cacheevict)). Test đổi sang chờ bằng Awaitility.

### 5.2. Lặp lại bẫy `REQUIRED` trong AFTER_COMMIT

`ImportService` ban đầu dùng `TransactionTemplate` mặc định (`REQUIRED`), đúng cái bẫy ở Phase 6. Phát hiện khi viết code nhờ bài học cũ, và `DirectEventDispatcherIT` có test chặn lại. Bài học: bẫy đã gặp một lần thì nên có test canh sẵn cho mọi chỗ tương tự.

### 5.3. Hạn chế đã biết

- **Message import bị mất** (RabbitMQ không nhận được) thì job nằm QUEUED tới khi job dọn dẹp chuyển sang FAILED (tối đa khoảng 1 giờ), còn khoá tự nhả sau 10 phút.
- **Chưa có test cho nhánh rollback do lỗi DB giữa chừng.** Mọi dữ liệu hỏng đều bị validation bắt trước khi xuống DB, nên khó tạo lỗi DB thật trong test. Logic rollback dựa vào transaction của Spring cùng `TransactionSynchronization` xoá file.
- **Chưa thử trên trình duyệt thật**, mới có unit test cho service. Dialog cần được thử tay theo §4.

---

**Trước:** [Phase 7](08-phase-7-google-maps.md) · **Tiếp theo:** Phase 9 (Hoàn thiện và bảo mật, xem [PLAN.md](../PLAN.md)) · **Tra cứu:** [Thuật ngữ](99-thuat-ngu.md)
