package com.gfmaster.messaging;

import com.gfmaster.common.messaging.DomainEvent;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Đẩy DomainEvent lên exchange {@code gfm.events} <b>sau khi transaction commit</b>: rollback thì
 * không gửi gì, consumer không bao giờ thấy dữ liệu chưa tồn tại.
 *
 * <p>Mỗi message có {@code messageId} riêng (để consumer chống xử lý trùng) và header
 * {@code x-user-id}. RabbitMQ không kết nối được thì chỉ log: request của người dùng đã thành công,
 * thiếu thumbnail/cache cũ vẫn tự phục hồi (job dọn dẹp, TTL cache).
 */
@Component
@ConditionalOnProperty(name = "gfm.messaging.enabled", havingValue = "true", matchIfMissing = true)
public class RabbitEventRelay {

  private static final Logger log = LoggerFactory.getLogger(RabbitEventRelay.class);

  private final RabbitTemplate rabbit;

  public RabbitEventRelay(RabbitTemplate rabbit) {
    this.rabbit = rabbit;
  }

  // fallbackExecution: publish ngoài transaction (ví dụ từ job) thì gửi ngay
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  public void relay(DomainEvent event) {
    String messageId = UUID.randomUUID().toString();
    try {
      rabbit.convertAndSend(
          Topology.EVENTS,
          event.routingKey(),
          event,
          message -> {
            message.getMessageProperties().setMessageId(messageId);
            message.getMessageProperties().setHeader(Topology.USER_ID_HEADER, event.userId().toString());
            return message;
          },
          new CorrelationData(messageId));
    } catch (AmqpException e) {
      log.error("Could not publish {} ({}): {}", event.routingKey(), messageId, e.getMessage());
    }
  }
}
