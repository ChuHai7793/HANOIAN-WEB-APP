package com.gfmaster.common.messaging;

import java.util.List;
import java.util.UUID;

/**
 * Sự kiện nghiệp vụ, phát ra sau khi transaction commit. {@link #routingKey()} quyết định queue
 * nào nhận (xem RabbitConfig).
 */
public sealed interface DomainEvent {

  UUID userId();

  String routingKey();

  /** Ảnh vừa upload, cần sinh thumbnail. */
  record ImageUploaded(UUID userId, UUID uploadId) implements DomainEvent {
    @Override
    public String routingKey() {
      return "image.uploaded";
    }
  }

  /** Bản ghi upload đã bị xoá khỏi DB; các file tương ứng cần xoá khỏi storage. */
  record UploadsDeleted(UUID userId, List<String> storageKeys) implements DomainEvent {
    @Override
    public String routingKey() {
      return "upload.deleted";
    }
  }

  /** Quán hoặc người yêu được tạo/sửa/xoá, ví dụ routing key {@code place.created}. */
  record EntityChanged(UUID userId, Entity entity, UUID entityId, Action action) implements DomainEvent {
    public enum Entity {
      place,
      girlfriend
    }

    public enum Action {
      created,
      updated,
      deleted
    }

    @Override
    public String routingKey() {
      return entity + "." + action;
    }
  }
}
