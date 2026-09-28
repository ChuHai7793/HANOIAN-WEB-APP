package com.gfmaster.common.messaging;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Service gọi {@link #publish} ngay trong transaction. Event chỉ thật sự được gửi đi sau khi
 * commit (RabbitEventRelay hoặc DirectEventDispatcher); transaction rollback thì event bị bỏ.
 */
@Component
public class DomainEventPublisher {

  private final ApplicationEventPublisher events;

  public DomainEventPublisher(ApplicationEventPublisher events) {
    this.events = events;
  }

  public void publish(DomainEvent event) {
    events.publishEvent(event);
  }
}
