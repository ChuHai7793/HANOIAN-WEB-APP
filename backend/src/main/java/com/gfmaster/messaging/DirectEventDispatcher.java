package com.gfmaster.messaging;

import com.gfmaster.common.messaging.DomainEvent;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged;
import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.stats.StatsService;
import com.gfmaster.upload.ThumbnailService;
import com.gfmaster.upload.storage.StorageDriver;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Khi tắt RabbitMQ ({@code gfm.messaging.enabled=false}): xử lý event ngay trong cùng request,
 * sau commit. Chậm hơn (request chờ sinh thumbnail) nhưng không cần broker.
 */
@Component
@ConditionalOnProperty(name = "gfm.messaging.enabled", havingValue = "false")
public class DirectEventDispatcher {

  private final ThumbnailService thumbnails;
  private final StorageDriver storage;
  private final StatsService stats;

  public DirectEventDispatcher(ThumbnailService thumbnails, StorageDriver storage, StatsService stats) {
    this.thumbnails = thumbnails;
    this.storage = storage;
    this.stats = stats;
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  public void dispatch(DomainEvent event) {
    switch (event) {
      case ImageUploaded e -> thumbnails.generate(e.uploadId());
      case UploadsDeleted e -> e.storageKeys().forEach(storage::delete);
      case EntityChanged e -> stats.evict(e.userId());
    }
  }
}
