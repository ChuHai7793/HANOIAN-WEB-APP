package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.messaging.Topology;
import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.upload.storage.StorageDriver;
import com.sksamuel.scrimage.ImmutableImage;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.MessageListenerContainer;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

/** Phần bất đồng bộ của upload: RabbitMQ thật (Testcontainers), chờ kết quả bằng Awaitility. */
class UploadMessagingIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(20);

  @Autowired JdbcTemplate jdbc;
  @Autowired StorageDriver storage;
  @Autowired RabbitTemplate rabbit;
  @Autowired AmqpAdmin admin;
  @Autowired RabbitListenerEndpointRegistry listeners;
  @Autowired StringRedisTemplate redis;
  @Autowired OrphanUploadCleanupJob orphanJob;

  @Test
  void thumbnailIsGeneratedInBackground() throws Exception {
    UUID user = newUser();
    JsonNode res = body(upload(user, "wide.png", "image/png", png(2400, 1200)).andExpect(status().isCreated()));
    String id = res.get("id").asString();
    assertThat(res.get("status").asString()).isEqualTo("THUMB_PENDING");

    await().atMost(WAIT).until(() -> "READY".equals(statusOf(id)));

    String thumbUrl = jdbc.queryForObject("select thumb_url from uploads where id = ?::uuid", String.class, id);
    assertThat(thumbUrl).isEqualTo(res.get("url").asString().replace(".webp", "-320.webp"));
    byte[] thumb = mvc.perform(get(thumbUrl)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
    ImmutableImage image = ImmutableImage.loader().fromBytes(thumb);
    assertThat(image.width).isEqualTo(320);
    assertThat(image.height).isEqualTo(160);
  }

  @Test
  void deletingUploadRemovesOriginalAndThumbnail() throws Exception {
    UUID user = newUser();
    JsonNode res = body(upload(user, "a.png", "image/png", png(800, 800)).andExpect(status().isCreated()));
    String id = res.get("id").asString();
    await().atMost(WAIT).until(() -> "READY".equals(statusOf(id)));
    String url = res.get("url").asString();
    String thumbUrl = url.replace(".webp", "-320.webp");
    mvc.perform(get(thumbUrl)).andExpect(status().isOk());

    deleteAs(user, "/api/v1/uploads/" + id).andExpect(status().isNoContent());

    await()
        .atMost(WAIT)
        .untilAsserted(
            () -> {
              mvc.perform(get(url)).andExpect(status().isNotFound());
              mvc.perform(get(thumbUrl)).andExpect(status().isNotFound());
            });
  }

  /** Consumer tắt thì message nằm chờ trong queue; bật lại thì tự xử lý, không mất việc. */
  @Test
  void messagesWaitInQueueWhileConsumerIsStopped() throws Exception {
    MessageListenerContainer consumer = listeners.getListenerContainer(Topology.IMAGE_VARIANTS);
    consumer.stop();
    String id;
    try {
      JsonNode res = body(upload(newUser(), "b.png", "image/png", png(400, 400)).andExpect(status().isCreated()));
      id = res.get("id").asString();
      await().atMost(WAIT).until(() -> queueDepth(Topology.IMAGE_VARIANTS) == 1);
      assertThat(statusOf(id)).isEqualTo("THUMB_PENDING");
    } finally {
      consumer.start();
    }
    await().atMost(WAIT).until(() -> "READY".equals(statusOf(id)));
    assertThat(queueDepth(Topology.IMAGE_VARIANTS)).isZero();
  }

  /** Lỗi xử lý (file gốc đã mất): retry 3 lần rồi message vào DLQ; dấu "đã xử lý" được gỡ. */
  @Test
  void failingMessageEndsUpInDeadLetterQueue() throws Exception {
    UUID user = newUser();
    JsonNode res = body(upload(user, "c.png", "image/png", png(300, 300)).andExpect(status().isCreated()));
    String id = res.get("id").asString();
    await().atMost(WAIT).until(() -> "READY".equals(statusOf(id)));

    // Giả lập: upload lại cần thumbnail nhưng file gốc không còn trên storage
    jdbc.update("update uploads set status = 'THUMB_PENDING', thumb_url = null where id = ?::uuid", id);
    storage.delete(jdbc.queryForObject("select storage_key from uploads where id = ?::uuid", String.class, id));

    String dlq = Topology.dlq(Topology.IMAGE_VARIANTS);
    long before = queueDepth(dlq);
    String messageId = UUID.randomUUID().toString();
    rabbit.convertAndSend(
        Topology.EVENTS,
        "image.uploaded",
        new ImageUploaded(user, UUID.fromString(id)),
        m -> {
          m.getMessageProperties().setMessageId(messageId);
          return m;
        });

    await().atMost(WAIT).until(() -> queueDepth(dlq) == before + 1);
    assertThat(statusOf(id)).isEqualTo("THUMB_PENDING");
    assertThat(redis.hasKey("msg:done:" + messageId)).isFalse();

    // Dọn DLQ để không ảnh hưởng test khác
    admin.purgeQueue(dlq, false);
  }

  @Test
  void orphanJobDeletesOnlyOldUnreferencedUploads() throws Exception {
    UUID user = newUser();
    String orphan = uploadReady(user);
    String used = uploadReady(user);
    String recent = uploadReady(user);
    String usedUrl = urlOf(used);
    postAs(
            user,
            "/api/v1/places",
            """
            {"type": "cafe", "name": "Có ảnh", "priceRange": "cheap", "rating": 3,
             "openTime": "07:00", "closeTime": "21:00", "imageUrl": "%s"}
            """
                .formatted(usedUrl))
        .andExpect(status().isCreated());
    String orphanUrl = urlOf(orphan);
    Instant eightDaysAgo = Instant.now().minus(Duration.ofDays(8));
    jdbc.update(
        "update uploads set created_at = ? where id in (?::uuid, ?::uuid)",
        Timestamp.from(eightDaysAgo), orphan, used);

    int removed = orphanJob.cleanUp(Instant.now().minus(Duration.ofDays(7)));

    assertThat(removed).isEqualTo(1);
    assertThat(statusOf(orphan)).isNull();
    assertThat(statusOf(used)).isNotNull();
    assertThat(statusOf(recent)).isNotNull();
    await().atMost(WAIT).untilAsserted(() -> mvc.perform(get(orphanUrl)).andExpect(status().isNotFound()));
    mvc.perform(get(usedUrl)).andExpect(status().isOk());
  }

  @Test
  void orphanJobKeepsAvatarsUsedByProfiles() throws Exception {
    UUID user = newUser();
    String avatar = uploadReady(user);
    jdbc.update(
        "insert into user_profiles (user_id, avatar_url, created_at, updated_at) values (?::uuid, ?, now(), now())",
        user.toString(), urlOf(avatar));
    jdbc.update(
        "update uploads set created_at = ? where id = ?::uuid",
        Timestamp.from(Instant.now().minus(Duration.ofDays(8))), avatar);

    orphanJob.cleanUp(Instant.now().minus(Duration.ofDays(7)));

    assertThat(statusOf(avatar)).isNotNull();
  }

  // ---- Helpers ----

  private String uploadReady(UUID user) throws Exception {
    String id = body(upload(user, "x.png", "image/png", png(200, 200)).andExpect(status().isCreated())).get("id").asString();
    await().atMost(WAIT).until(() -> "READY".equals(statusOf(id)));
    return id;
  }

  private String statusOf(String id) {
    return jdbc.queryForList("select status from uploads where id = ?::uuid", String.class, id).stream()
        .findFirst()
        .orElse(null);
  }

  private String urlOf(String id) {
    return jdbc.queryForObject("select url from uploads where id = ?::uuid", String.class, id);
  }

  private long queueDepth(String queue) {
    QueueInformation info = admin.getQueueInfo(queue);
    return info == null ? -1 : info.getMessageCount();
  }
}
