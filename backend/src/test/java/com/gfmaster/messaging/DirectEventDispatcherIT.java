package com.gfmaster.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.common.messaging.DomainEvent;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Action;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Entity;
import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.common.messaging.DomainEvent.ImportRequested;
import com.gfmaster.importer.ImportLock;
import com.gfmaster.importer.ImportService;
import com.gfmaster.stats.StatsService;
import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.upload.ThumbnailService;
import com.gfmaster.upload.storage.StorageDriver;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

/**
 * Nhánh tắt RabbitMQ ({@code gfm.messaging.enabled=false}): dispatcher được gọi trong callback
 * AFTER_COMMIT của một transaction thật, đúng như khi Spring gọi {@code @TransactionalEventListener}.
 *
 * <p>Không dùng {@code @TestPropertySource(gfm.messaging.enabled=false)}: nó tạo Spring context thứ
 * hai kèm bộ container riêng, và khi test quay lại context đầu thì container bị dừng giữa chừng.
 */
class DirectEventDispatcherIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired TransactionTemplate tx;
  @Autowired ThumbnailService thumbnails;
  @Autowired StorageDriver storage;
  @Autowired StatsService stats;
  @Autowired StringRedisTemplate redis;
  @Autowired RabbitListenerEndpointRegistry listeners;
  @Autowired ImportService imports;

  @Test
  void thumbnailGeneratedAfterCommitIsPersisted() throws Exception {
    // Tạm dừng consumer thật để chắc chắn thumbnail do dispatcher sinh ra, không phải do RabbitMQ
    var consumer = listeners.getListenerContainer(Topology.IMAGE_VARIANTS);
    consumer.stop();
    try {
      JsonNode res = body(upload(newUser(), "d.png", "image/png", png(640, 480)).andExpect(status().isCreated()));
      String id = res.get("id").asString();
      assertThat(statusOf(id)).isEqualTo("THUMB_PENDING");

      dispatchAfterCommit(new ImageUploaded(UUID.randomUUID(), UUID.fromString(id)));

      // REQUIRES_NEW trong ThumbnailService: thay đổi phải được lưu dù chạy trong AFTER_COMMIT
      assertThat(statusOf(id)).isEqualTo("READY");
      assertThat(jdbc.queryForObject("select thumb_url from uploads where id = ?", String.class, id))
          .isEqualTo(res.get("url").asString().replace(".webp", "-320.webp"));
    } finally {
      consumer.start();
    }
  }

  @Test
  void entityChangedEvictsStatsImmediately() throws Exception {
    UUID user = newUser();
    stats.stats(user);
    String key = "cache:stats::" + user;
    // Cache.put() cũng được phép ghi trễ (như evict), nên chờ key xuất hiện
    await().atMost(Duration.ofSeconds(5)).until(() -> Boolean.TRUE.equals(redis.hasKey(key)));

    dispatchAfterCommit(new EntityChanged(user, Entity.place, UUID.randomUUID(), Action.created));

    assertThat(redis.hasKey(key)).isFalse();
  }

  @Test
  void importRunAfterCommitIsPersisted() throws Exception {
    var consumer = listeners.getListenerContainer(Topology.IMPORT);
    consumer.stop();
    try {
      UUID user = newUser();
      UUID jobId = imports.start(user, "{\"girlfriends\": [{\"name\": \"Lan\"}]}");
      String token = redis.opsForValue().get(ImportLock.key(user));

      dispatchAfterCommit(new ImportRequested(user, jobId, token));

      // Dùng REQUIRES_NEW: dữ liệu và trạng thái DONE phải được lưu dù chạy trong AFTER_COMMIT
      assertThat(jdbc.queryForObject("select status from import_jobs where id = ?", String.class, jobId.toString()))
          .isEqualTo("DONE");
      assertThat(jdbc.queryForObject("select count(*) from girlfriends where user_id = ?", Integer.class, user.toString()))
          .isEqualTo(1);
      assertThat(redis.hasKey(ImportLock.key(user))).isFalse();
    } finally {
      consumer.start();
    }
  }

  /** Chạy dispatcher trong afterCommit của một transaction vừa commit, như Spring làm. */
  private void dispatchAfterCommit(DomainEvent event) {
    assertThat(TransactionSynchronizationManager.isActualTransactionActive())
        .as("không được có transaction dở dang trên luồng test")
        .isFalse();
    DirectEventDispatcher dispatcher = new DirectEventDispatcher(thumbnails, storage, stats, imports);
    AtomicBoolean ran = new AtomicBoolean();
    tx.executeWithoutResult(
        status ->
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                  @Override
                  public void afterCommit() {
                    dispatcher.dispatch(event);
                    ran.set(true);
                  }
                }));
    assertThat(ran).as("afterCommit phải chạy xong").isTrue();
  }

  private String statusOf(String id) {
    return jdbc.queryForObject("select status from uploads where id = ?", String.class, id);
  }
}
