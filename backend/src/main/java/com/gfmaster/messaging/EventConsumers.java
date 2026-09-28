package com.gfmaster.messaging;

import com.gfmaster.common.messaging.DomainEvent.EntityChanged;
import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.common.messaging.DomainEvent.ImportRequested;
import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.common.messaging.ProcessedMessageGuard;
import com.gfmaster.importer.ImportService;
import com.gfmaster.stats.StatsService;
import com.gfmaster.upload.ThumbnailService;
import com.gfmaster.upload.storage.StorageDriver;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * Consumer RabbitMQ, chạy cùng process với API. Mỗi message chỉ xử lý một lần theo
 * {@code messageId} ({@link ProcessedMessageGuard}); ném exception thì Spring AMQP retry, hết lượt
 * thì message vào DLQ.
 */
@Component
@ConditionalOnProperty(name = "gfm.messaging.enabled", havingValue = "true", matchIfMissing = true)
public class EventConsumers {

  private final ProcessedMessageGuard guard;
  private final ThumbnailService thumbnails;
  private final StorageDriver storage;
  private final StatsService stats;
  private final ImportService imports;

  public EventConsumers(
      ProcessedMessageGuard guard,
      ThumbnailService thumbnails,
      StorageDriver storage,
      StatsService stats,
      ImportService imports) {
    this.guard = guard;
    this.thumbnails = thumbnails;
    this.storage = storage;
    this.stats = stats;
    this.imports = imports;
  }

  @RabbitListener(id = Topology.IMAGE_VARIANTS, queues = Topology.IMAGE_VARIANTS)
  public void onImageUploaded(ImageUploaded event, @Header(name = AmqpHeaders.MESSAGE_ID, required = false) String id) {
    guard.runOnce(id, () -> thumbnails.generate(event.uploadId()));
  }

  @RabbitListener(id = Topology.STORAGE_CLEANUP, queues = Topology.STORAGE_CLEANUP)
  public void onUploadsDeleted(UploadsDeleted event, @Header(name = AmqpHeaders.MESSAGE_ID, required = false) String id) {
    guard.runOnce(id, () -> event.storageKeys().forEach(storage::delete));
  }

  @RabbitListener(id = Topology.IMPORT, queues = Topology.IMPORT, containerFactory = "importListenerFactory")
  public void onImportRequested(ImportRequested event, @Header(name = AmqpHeaders.MESSAGE_ID, required = false) String id) {
    guard.runOnce(id, () -> imports.run(event));
  }

  // Xoá cache là thao tác idempotent, chạy lại cũng không sao: không cần guard
  @RabbitListener(id = Topology.CACHE_EVICT, queues = Topology.CACHE_EVICT)
  public void onEntityChanged(EntityChanged event) {
    stats.evict(event.userId());
  }
}
