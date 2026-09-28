# Phase 6: RabbitMQ: thumbnail chạy nền, xoá file, cache `/stats`, dọn ảnh mồ côi

> **Kết quả:**
> - Upload ảnh trả về ngay. Khoảng một giây sau, server có thêm thumbnail 320px do một consumer RabbitMQ sinh ra ở nền.
> - Xoá ảnh thì file được xoá **sau khi** DB commit.
> - Consumer tắt thì việc nằm chờ trong queue; bật lại thì tự làm tiếp. Việc lỗi quá 3 lần thì vào hàng đợi lỗi (DLQ).
> - `/stats` được cache trong Redis và tự làm mới khi quán hoặc người yêu thay đổi.
> - Mỗi đêm có job xoá ảnh không còn ai dùng.
>
> **Commit:** `feat: RabbitMQ thumbnails, async file cleanup, stats cache and orphan upload job (Phase 6)`

---

## 1. Mục tiêu

- Đưa việc **chậm** hoặc **không cần làm ngay** ra khỏi request: người dùng không phải chờ.
- Việc chạy nền phải **không mất**: app khởi động lại, consumer lỗi hay broker tạm ngắt thì việc vẫn còn đó.
- Việc lỗi mãi thì **không làm tắc** hàng đợi, và vẫn giữ lại được để xem nguyên nhân.
- Job định kỳ chỉ chạy **một lần**, kể cả khi có nhiều instance.

---

## 2. Kiến thức cần biết

### 2.1. Vì sao cần message broker?

Làm mọi việc ngay trong request thì request chậm, và một việc phụ bị lỗi (ví dụ sinh thumbnail) cũng làm hỏng việc chính (lưu ảnh). Có thể dùng `@Async` (chạy ở luồng khác trong cùng app) nhưng việc sẽ nằm trong RAM, app tắt là mất.

**Message broker** (RabbitMQ) là "bưu điện" đứng giữa: bên gửi (**producer**) bỏ thư vào, bên nhận (**consumer**) lấy ra xử lý. Thư được lưu trên đĩa của broker (queue `durable`, message `persistent`), nên:

| | `@Async` | RabbitMQ |
|---|---|---|
| App tắt giữa chừng | Mất việc | Việc còn trong queue |
| Consumer lỗi | Tự viết retry | Retry + DLQ có sẵn |
| Nhiều instance | Mỗi instance tự làm việc của mình | Chia việc chung một queue |
| Xem đang chờ bao nhiêu việc | Không | RabbitMQ UI, http://localhost:15672 |

### 2.2. Exchange, queue, binding, routing key

Producer **không** gửi thẳng vào queue mà gửi vào một **exchange** kèm **routing key**. **Binding** là luật quyết định exchange chuyển message sang queue nào.

```
                          gfm.events (topic exchange)
producer ──"image.uploaded"──►│
                              ├─ binding "image.uploaded"  ──► gfm.image.variants   ──► sinh thumbnail
                              ├─ binding "upload.deleted"  ──► gfm.storage.cleanup  ──► xoá file
                              ├─ binding "place.*"         ─┐
                              └─ binding "girlfriend.*"    ─┴► gfm.cache.evict      ──► xoá cache /stats
```

- **Topic exchange**: so routing key theo mẫu. `*` khớp đúng một từ, `#` khớp nhiều từ. `place.*` khớp `place.created`, `place.updated`, `place.deleted`.
- **Direct exchange**: routing key phải khớp y hệt. Dùng cho `gfm.dlx` (§2.5).

Nhờ exchange đứng giữa, service chỉ cần nói "quán vừa được tạo" (`place.created`) mà không cần biết ai quan tâm. Muốn thêm việc mới (ví dụ ghi activity log vào Mongo), chỉ cần thêm một queue và binding, không phải sửa service.

### 2.3. Publish sau commit (AFTER_COMMIT)

Nếu gửi message **trong** transaction:

```
upload.save(...)              ← chưa commit
rabbit.send(image.uploaded)   ← consumer nhận ngay, đọc DB: KHÔNG THẤY upload (chưa commit)
... lỗi → rollback            ← message đã đi, trỏ tới bản ghi không tồn tại
```

Vì vậy service chỉ **phát sự kiện nội bộ** (`ApplicationEventPublisher`). `RabbitEventRelay` nghe bằng `@TransactionalEventListener(phase = AFTER_COMMIT)` và chỉ gửi lên RabbitMQ khi commit thành công. Rollback thì sự kiện bị bỏ.

**Rủi ro còn lại:** app chết đúng khoảng giữa commit và gửi thì mất message. Với dự án này chấp nhận được, vì mọi thứ tự phục hồi: thiếu thumbnail thì vẫn còn ảnh gốc, cache có TTL 10 phút, file mồ côi có job dọn. Nếu cần đảm bảo tuyệt đối thì dùng **Transactional Outbox**: ghi message vào một bảng ngay trong transaction, rồi một job đọc bảng đó và gửi đi.

### 2.4. At-least-once và consumer idempotent

RabbitMQ đảm bảo mỗi message được giao **ít nhất một lần** (at-least-once), không phải **đúng một lần**. Ví dụ consumer xử lý xong nhưng mất kết nối trước khi kịp gửi **ack** (xác nhận). Broker không nhận được ack nên giao lại, và consumer xử lý lần hai.

Vì vậy consumer phải **idempotent**. [ProcessedMessageGuard](../backend/src/main/java/com/gfmaster/common/messaging/ProcessedMessageGuard.java) ghi `msg:done:{messageId}` vào Redis bằng `SET NX` (7 ngày):
- Đã có key thì bỏ qua.
- Xử lý lỗi thì **xoá key**, để lần retry vẫn chạy được.

Mỗi message được `RabbitEventRelay` gắn một `messageId` (UUID) riêng.

Ngoài guard, bản thân logic cũng chịu được việc chạy lại. `ThumbnailService` bỏ qua upload không còn ở trạng thái `THUMB_PENDING`. Xoá file thì dùng `deleteIfExists`. Xoá cache chạy hai lần cũng không sao, nên queue `gfm.cache.evict` không cần guard.

### 2.5. Retry và Dead Letter Queue (DLQ)

```
gfm.image.variants ──► consumer ném exception
                        ├─ lần 1 lỗi → chờ 1s → lần 2 lỗi → chờ 2s → lần 3 lỗi
                        └─ hết lượt: reject (không requeue)
                                 │  queue có x-dead-letter-exchange = gfm.dlx
                                 ▼
                gfm.dlx ──"gfm.image.variants.dlq"──► gfm.image.variants.dlq   (nằm đó chờ người xem)
```

- Retry do Spring AMQP làm ngay trong consumer, cấu hình trong [application.yml](../backend/src/main/resources/application.yml): `spring.rabbitmq.listener.simple.retry` (3 lần, 1s, hệ số 2).
- `default-requeue-rejected: false`: message lỗi **không** được trả về queue gốc. Nếu trả về, nó sẽ lỗi lặp vô tận và chặn các message phía sau (gọi là *poison message*).
- Queue khai báo tham số `x-dead-letter-exchange`, nên message bị reject được RabbitMQ tự chuyển sang DLQ.
- Xem và gửi lại message trong DLQ: RabbitMQ UI → *Queues* → `gfm.image.variants.dlq` → *Get messages* hoặc *Move messages* (plugin shovel).

### 2.6. Ack, prefetch và vì sao message "nằm chờ"

- **Ack**: consumer báo "xong rồi". Chỉ khi đó broker mới xoá message. Spring AMQP tự ack khi listener chạy xong không lỗi (`acknowledge-mode: auto`).
- **Prefetch** (`prefetch: 10`): số message tối đa broker giao trước cho một consumer mà chưa cần ack.
- Consumer tắt thì message ở trạng thái *Ready* trong queue. Bật lại thì consumer nhận tiếp. Test `messagesWaitInQueueWhileConsumerIsStopped` kiểm chứng điều này bằng `RabbitListenerEndpointRegistry.stop()/start()`.

### 2.7. Publisher confirms và returns

Gửi đi không có nghĩa là broker đã nhận. [RabbitConfig](../backend/src/main/java/com/gfmaster/config/RabbitConfig.java) bật hai cơ chế:
- **Confirm** (`publisher-confirm-type: correlated`): broker báo ack hoặc nack cho từng message. Nack thì ghi log lỗi.
- **Return** (`mandatory: true`): message không khớp binding nào (không tới được queue nào) thì bị trả lại và ghi log. Nhờ đó phát hiện được lỗi gõ sai routing key.

### 2.8. Spring Cache trên Redis

```java
@Cacheable(cacheNames = "stats", key = "#userId")   // có trong cache thì trả luôn, không chạy thân hàm
public StatsResponse stats(UUID userId) { ... 2 câu SQL ... }

@CacheEvict(cacheNames = "stats", key = "#userId")  // xoá key
public void evict(UUID userId) {}
```

- Key trong Redis: `cache:stats::{userId}`, TTL 10 phút.
- **Serializer JSON gắn đúng kiểu** (`JacksonJsonRedisSerializer<StatsResponse>`): Redis chỉ chứa `{"cafes":1,...}`, không có tên class Java. Serializer "generic" lưu kèm `@class` và cho phép dữ liệu trong Redis quyết định class nào được tạo ra. Nếu Redis bị ghi bậy, đó là lỗ hổng *deserialization*.
- **`@CacheEvict(beforeInvocation = true)`**: mặc định Spring gọi `Cache.evict()`, hàm này được phép xoá **trễ** (hợp đồng của interface `Cache`). Với `beforeInvocation = true`, Spring gọi `evictIfPresent()` và xoá ngay. Xem §5.3.
- `@Cacheable` hoạt động qua **proxy**: gọi từ class khác thì có cache, gọi nội bộ `this.stats()` thì **không**. Vì vậy logic được tách ra [StatsService](../backend/src/main/java/com/gfmaster/stats/StatsService.java), controller gọi sang.

**Cache invalidation** (khi nào xoá cache) là phần khó. Ở đây mỗi lần tạo, sửa hay xoá quán hoặc người yêu, service phát `EntityChanged`, consumer của `gfm.cache.evict` xoá cache của đúng user đó. TTL 10 phút là lưới an toàn nếu event bị mất.

### 2.9. Job định kỳ và ShedLock

`@Scheduled(cron = "0 0 3 * * *")` chạy lúc 03:00 hằng ngày. Cron của Spring có 6 trường: *giây phút giờ ngày tháng thứ*.

Chạy 2 instance thì cả 2 cùng chạy job. **ShedLock** giải quyết việc này: trước khi chạy, instance nào đặt được khoá `shedlock:gfm:orphan-upload-cleanup` trong Redis thì instance đó chạy, instance kia bỏ qua.
- `lockAtMostFor = 10m`: instance chết khi đang giữ khoá thì khoá tự nhả sau 10 phút.
- `lockAtLeastFor = 1m`: giữ khoá ít nhất 1 phút, để instance có đồng hồ lệch vài giây không chạy lại ngay sau đó.

### 2.10. Bẫy: `@Transactional` bên trong AFTER_COMMIT

Khi tắt RabbitMQ (`gfm.messaging.enabled=false`), [DirectEventDispatcher](../backend/src/main/java/com/gfmaster/messaging/DirectEventDispatcher.java) gọi thẳng `ThumbnailService.generate()` trong callback AFTER_COMMIT. Lúc này transaction của request **đã commit nhưng vẫn còn gắn với luồng**.

`@Transactional` mặc định (`REQUIRED`) sẽ "nhập" vào transaction đó. Mọi thay đổi coi như ghi vào một transaction đã đóng, và **không bao giờ được lưu**, cũng không báo lỗi. Sửa bằng cách dùng `@Transactional(propagation = REQUIRES_NEW)` để luôn mở transaction mới. Test `DirectEventDispatcherIT` bắt đúng lỗi này: đổi về `REQUIRED` thì test fail với `status = THUMB_PENDING`.

---

## 3. Các bước thực hiện

### Bước 1: Dependency và cấu hình

- [pom.xml](../backend/pom.xml): `shedlock-spring` + `shedlock-provider-redis-spring` 7.10.1; `awaitility` (test).
- [GfmProperties.java](../backend/src/main/java/com/gfmaster/config/GfmProperties.java) và `application.yml`: `gfm.jobs.orphan-uploads.cron` (`0 0 3 * * *`), `older-than` (`7d`).
- Cấu hình RabbitMQ (retry, prefetch, confirms) đã có sẵn từ Phase 1.

### Bước 2: Sự kiện và publish sau commit

- [DomainEvent.java](../backend/src/main/java/com/gfmaster/common/messaging/DomainEvent.java): `sealed interface` với 3 record `ImageUploaded`, `UploadsDeleted`, `EntityChanged`. Mỗi record tự trả `routingKey()`.
- [DomainEventPublisher.java](../backend/src/main/java/com/gfmaster/common/messaging/DomainEventPublisher.java): service gọi `publish()` trong transaction.
- [RabbitEventRelay.java](../backend/src/main/java/com/gfmaster/messaging/RabbitEventRelay.java): AFTER_COMMIT → `convertAndSend(gfm.events, routingKey, event)`, gắn `messageId`, header `x-user-id` và `CorrelationData` (dùng cho confirm). RabbitMQ không kết nối được thì chỉ ghi log, request vẫn thành công.
- `PlaceService`, `GirlfriendService` phát `EntityChanged` khi tạo, sửa, xoá.

> **`sealed interface`** (Java 17+): chỉ những class được liệt kê mới được implement. Nhờ vậy `switch (event) { case ImageUploaded e -> ...; case UploadsDeleted e -> ...; case EntityChanged e -> ... }` không cần nhánh `default`. Nếu sau này thêm loại event mới mà quên xử lý, trình biên dịch sẽ báo lỗi.

### Bước 3: Topology và consumer

- [Topology.java](../backend/src/main/java/com/gfmaster/messaging/Topology.java): tên exchange và queue.
- [RabbitConfig.java](../backend/src/main/java/com/gfmaster/config/RabbitConfig.java):
  - Khai báo exchange, queue và DLQ bằng một bean `Declarables`. `RabbitAdmin` tự tạo chúng khi kết nối.
  - `JacksonJsonMessageConverter` dùng chung `JsonMapper` của app.
  - Callback confirm và return (§2.7).
- [EventConsumers.java](../backend/src/main/java/com/gfmaster/messaging/EventConsumers.java): 3 `@RabbitListener`. Kiểu tham số (`ImageUploaded`...) cho converter biết phải đọc JSON thành class nào.
- Toàn bộ phần RabbitMQ có `@ConditionalOnProperty(gfm.messaging.enabled)`. Khi tắt thì dùng `DirectEventDispatcher` (§2.10).

### Bước 4: Thumbnail và xoá file

- [ImageProcessor.java](../backend/src/main/java/com/gfmaster/upload/ImageProcessor.java): thêm `thumbnail()` (cạnh dài ≤ 320px, WebP q78).
- `StorageDriver`: thêm `get(key)` để đọc lại ảnh gốc.
- [UploadService.java](../backend/src/main/java/com/gfmaster/upload/UploadService.java):
  - Upload thì lưu status `THUMB_PENDING` rồi phát `ImageUploaded`.
  - Xoá thì chỉ xoá bản ghi, rồi phát `UploadsDeleted` gồm ảnh gốc và thumbnail. File được xoá sau commit, nên nếu rollback thì không có bản ghi nào trỏ vào file đã mất.
- [ThumbnailService.java](../backend/src/main/java/com/gfmaster/upload/ThumbnailService.java): đọc ảnh gốc, ghi `…-320.webp` cạnh ảnh gốc, cập nhật `thumb_url` và `READY`.

### Bước 5: Cache `/stats`

- [StatsService.java](../backend/src/main/java/com/gfmaster/stats/StatsService.java) (`@Cacheable`, `@CacheEvict`); [StatsController](../backend/src/main/java/com/gfmaster/stats/StatsController.java) chỉ còn gọi sang.
- [CacheConfig.java](../backend/src/main/java/com/gfmaster/config/CacheConfig.java): `@EnableCaching`, tiền tố `cache:`, TTL 10 phút, serializer theo kiểu (§2.8).

### Bước 6: Job dọn ảnh mồ côi

- [SchedulingConfig.java](../backend/src/main/java/com/gfmaster/config/SchedulingConfig.java): `@EnableScheduling`, `@EnableSchedulerLock`, `RedisLockProvider`.
- `UploadRepository.findOrphans()`: native SQL tìm upload cũ hơn mốc mà `url` không còn nằm trong `places.image_url` hay `girlfriends.avatar_url`.
- [OrphanUploadCleanupJob.java](../backend/src/main/java/com/gfmaster/upload/OrphanUploadCleanupJob.java):
  - Xoá theo lô 200 bản, mỗi lô một transaction (`TransactionTemplate`).
  - Mỗi user một event `UploadsDeleted`.

Ảnh mồ côi sinh ra khi người dùng chọn ảnh (đã upload ngay lúc chọn) rồi huỷ form, hoặc đổi sang ảnh khác. Mốc 7 ngày chừa thời gian cho form đang mở dở.

### Bước 7: Test

| File | Nội dung |
|---|---|
| [UploadMessagingIT](../backend/src/test/java/com/gfmaster/upload/UploadMessagingIT.java) (5) | Thumbnail 2400×1200 → 320×160 được sinh ở nền. Xoá upload thì cả 2 file mất. Tắt consumer thì queue có 1 message; bật lại thì xử lý xong. File gốc mất thì sau 3 lần retry message vào DLQ, dấu `msg:done` được gỡ. Job chỉ xoá upload cũ và không ai dùng |
| [StatsCacheIT](../backend/src/test/java/com/gfmaster/stats/StatsCacheIT.java) (3) | Key `cache:stats::{user}` có TTL, JSON không có `@class`. Sửa thẳng DB thì vẫn thấy số cũ; sửa qua API thì cache bị xoá. Người yêu cũng xoá cache. Cache tách theo user |
| [ProcessedMessageGuardIT](../backend/src/test/java/com/gfmaster/common/messaging/ProcessedMessageGuardIT.java) (3) | Cùng `messageId` chỉ chạy 1 lần. Lỗi thì retry được. Không có id thì luôn chạy |
| [DirectEventDispatcherIT](../backend/src/test/java/com/gfmaster/messaging/DirectEventDispatcherIT.java) (2) | Nhánh tắt RabbitMQ: gọi dispatcher trong `afterCommit` của một transaction thật; thumbnail được lưu (bắt lỗi `REQUIRED` ở §2.10), cache bị xoá ngay |

- [UploadControllerIT](../backend/src/test/java/com/gfmaster/upload/UploadControllerIT.java) đổi theo hành vi mới: status trả về là `THUMB_PENDING`, và file bị xoá **sau một lúc** (chờ bằng Awaitility).
- Helper `upload()`/`png()` chuyển lên [ApiTestSupport](../backend/src/test/java/com/gfmaster/support/ApiTestSupport.java) để các test dùng chung.

> **Awaitility**: `await().atMost(20s).until(() -> điều kiện)` thử lại điều kiện nhiều lần cho tới khi đúng hoặc hết giờ. Dùng cách này thay cho `Thread.sleep(5000)`: test không phải chờ thừa khi việc xong sớm, và không fail ngẫu nhiên khi máy chậm.

---

## 4. Kiểm tra kết quả

```powershell
cd D:\GF_Master\backend; .\mvnw.cmd verify    # 68 test (55 cũ + 13 mới)
```

Chạy app thật (`docker compose up -d`, rồi chạy backend) và thử:

1. Mở http://localhost:15672 (`gfm`/`gfm`), tab *Queues*. Thấy 3 queue và 3 DLQ tương ứng.
2. Chọn ảnh trong form quán. Trong thư mục `uploads/<userId>/<năm>/<tháng>/` có `xxx.webp`, và khoảng một giây sau có thêm `xxx-320.webp`.
3. Xem cache: `docker compose exec redis redis-cli --scan --pattern "cache:*"`. Thêm một quán rồi chạy lại lệnh thì key của user biến mất.
4. Xem message nằm chờ: trong RabbitMQ UI, vào queue `gfm.image.variants` → *Publish message*, thêm property `content_type = application/json` (thiếu thì converter không đọc được và message rơi vào DLQ), payload `{"userId":"<uuid bất kỳ>","uploadId":"<uuid bất kỳ>"}`, gửi trong lúc **backend đang tắt**. Queue báo *Ready: 1*. Bật backend thì consumer nhận message (bỏ qua vì upload không tồn tại) và *Ready* về 0. Test `messagesWaitInQueueWhileConsumerIsStopped` kiểm chứng tự động cùng hành vi này với một upload thật.

---

## 5. Lỗi đã gặp và bài học

### 5.1. `@Transactional` trong AFTER_COMMIT lặng lẽ không lưu gì

Xem §2.10. Bài học: với mỗi test mới cho một lỗi tinh vi, hãy **cố ý gây lại lỗi** và xem test có đỏ không. Nếu vẫn xanh thì test đó chưa kiểm tra được gì.

### 5.2. `MessageListenerContainer` có ở hai package

`RabbitListenerEndpointRegistry.getListenerContainer()` trả về `org.springframework.amqp.core.MessageListenerContainer` (Spring AMQP 4), không phải bản cùng tên trong `...rabbit.listener`. IDE dễ gợi ý nhầm import.

### 5.3. Cache không bị xoá ngay sau `@CacheEvict`

**Triệu chứng:** test kiểm tra "evict xong thì key mất khỏi Redis" xanh khi chạy riêng, nhưng **đỏ khi chạy cả bộ**. Thêm log thì thấy ngay sau evict key vẫn còn, một khoảnh khắc sau mới mất.
**Nguyên nhân:** `@CacheEvict` mặc định gọi `Cache.evict()`, và Javadoc của hàm này cho phép xoá bất đồng bộ hoặc trễ. Máy càng bận thì độ trễ càng dễ lộ ra.
**Sửa:** `@CacheEvict(beforeInvocation = true)`. Spring gọi `evictIfPresent()`, hàm này bắt buộc xoá ngay. Đã kiểm tra trong `AbstractCacheInvoker.doEvict` của Spring 7.0.9.

Bài học: test **chỉ fail khi chạy chung** thường là do thời điểm, không phải do test khác. Tìm lỗi bằng cách đo trạng thái (in giá trị, TTL) thay vì đoán.

### 5.4. Test tạo Spring context thứ hai làm hỏng container

Bản đầu của `DirectEventDispatcherIT` dùng `@TestPropertySource(properties = "gfm.messaging.enabled=false")`. Thuộc tính khác nhau nghĩa là **cấu hình khác nhau**, nên Spring tạo thêm context thứ hai, và `TestcontainersConfiguration` bật thêm **một bộ container mới**. Khi các lớp test sau quay lại context đầu, container bị dừng giữa chừng, và 28 test lỗi `RedisException: Connection is closed`.

**Sửa:** giữ một context duy nhất. Test tự dựng `DirectEventDispatcher` và gọi nó trong `afterCommit` của một transaction thật (`TransactionSynchronizationManager.registerSynchronization`). Cách này tái hiện đúng tình huống cần kiểm tra, lại nhanh hơn (không phải khởi động context và container thêm lần nữa).

> **Context cache của Spring Test:** các lớp test có **cùng cấu hình** (annotation, profile, property, bean mock) dùng chung một ApplicationContext. Mỗi khác biệt nhỏ, như `@TestPropertySource` hay `@MockitoBean`, sinh ra context mới. Điều đó nghĩa là khởi động lại app, và ở đây là cả container.

### 5.5. Hạn chế đã biết

- **Frontend chưa dùng thumbnail**: danh sách vẫn tải ảnh 1200px. Muốn dùng thì cần trả `thumbUrl` kèm quán/người yêu (hoặc suy ra từ URL) và có ảnh dự phòng khi thumbnail chưa có.
- **Upload vào DLQ vẫn ở `THUMB_PENDING`**: ảnh gốc vẫn hiển thị bình thường. Có thể thêm consumer cho DLQ để đánh dấu `FAILED`.
- **Có thể mất event nếu app chết đúng lúc giữa commit và publish** (§2.3). Nâng cấp lên Outbox khi cần.
- **Chưa chuyển ảnh `frontend/assets/img` sang `seed-assets`** như PLAN ghi. Đó là 17 ảnh quán ở Hà Nội (18MB) mà dữ liệu mẫu hiện tại (quán ở Sài Gòn, ảnh Unsplash) không dùng. Cần quyết định có thay bộ dữ liệu mẫu hay không.

---

**Trước:** [Phase 5](06-phase-5-concurrency.md) · **Tiếp theo:** Phase 7 (Google Maps resolve, xem [PLAN.md](../PLAN.md)) · **Tra cứu:** [Thuật ngữ](99-thuat-ngu.md)
