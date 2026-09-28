package com.gfmaster.config;

import static com.gfmaster.messaging.Topology.CACHE_EVICT;
import static com.gfmaster.messaging.Topology.DLX;
import static com.gfmaster.messaging.Topology.EVENTS;
import static com.gfmaster.messaging.Topology.IMAGE_VARIANTS;
import static com.gfmaster.messaging.Topology.IMPORT;
import static com.gfmaster.messaging.Topology.STORAGE_CLEANUP;
import static com.gfmaster.messaging.Topology.dlq;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarable;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.amqp.autoconfigure.RabbitTemplateCustomizer;
import org.springframework.boot.amqp.autoconfigure.SimpleRabbitListenerContainerFactoryConfigurer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/**
 * Khai báo exchange, queue, DLQ (RabbitAdmin tự tạo khi app kết nối), message JSON, và log khi
 * broker từ chối (nack) hoặc message không tới được queue nào (returned).
 *
 * <p>Retry của consumer cấu hình trong application.yml ({@code spring.rabbitmq.listener.simple.retry}):
 * 3 lần, backoff 1s → 2s; hết lượt thì message bị reject và RabbitMQ chuyển sang DLQ nhờ tham số
 * {@code x-dead-letter-exchange} của queue.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "gfm.messaging.enabled", havingValue = "true", matchIfMissing = true)
public class RabbitConfig {

  private static final Logger log = LoggerFactory.getLogger(RabbitConfig.class);

  @Bean
  MessageConverter jsonMessageConverter(JsonMapper json) {
    return new JacksonJsonMessageConverter(json);
  }

  @Bean
  RabbitTemplateCustomizer publisherCallbacks() {
    return template -> {
      template.setMandatory(true);
      template.setConfirmCallback(
          (correlation, ack, cause) -> {
            if (!ack) {
              log.error("Broker nacked message {}: {}", correlation == null ? "?" : correlation.getId(), cause);
            }
          });
      template.setReturnsCallback(
          returned ->
              log.error(
                  "Message returned (no queue bound): exchange={} routingKey={} reply={}",
                  returned.getExchange(),
                  returned.getRoutingKey(),
                  returned.getReplyText()));
    };
  }

  @Bean
  Declarables topology() {
    TopicExchange events = new TopicExchange(EVENTS, true, false);
    DirectExchange dlx = new DirectExchange(DLX, true, false);

    List<Declarable> all = new ArrayList<>(List.of(events, dlx));
    Queue images = queueWithDlq(IMAGE_VARIANTS, dlx, all);
    Queue cleanup = queueWithDlq(STORAGE_CLEANUP, dlx, all);
    Queue evict = queueWithDlq(CACHE_EVICT, dlx, all);
    Queue imports = queueWithDlq(IMPORT, dlx, all);

    all.add(BindingBuilder.bind(images).to(events).with("image.uploaded"));
    all.add(BindingBuilder.bind(cleanup).to(events).with("upload.deleted"));
    all.add(BindingBuilder.bind(evict).to(events).with("place.*"));
    all.add(BindingBuilder.bind(evict).to(events).with("girlfriend.*"));
    all.add(BindingBuilder.bind(imports).to(events).with("import.requested"));
    return new Declarables(all);
  }

  /**
   * Import nặng (nhiều ảnh): mỗi consumer chỉ nhận 1 message một lúc (prefetch 1), tối đa 2 import
   * chạy song song trên một instance. Các cấu hình khác (retry...) lấy từ application.yml.
   */
  @Bean
  SimpleRabbitListenerContainerFactory importListenerFactory(
      SimpleRabbitListenerContainerFactoryConfigurer configurer, ConnectionFactory connectionFactory) {
    SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
    configurer.configure(factory, connectionFactory);
    factory.setPrefetchCount(1);
    factory.setConcurrentConsumers(1);
    factory.setMaxConcurrentConsumers(2);
    return factory;
  }

  private static Queue queueWithDlq(String name, DirectExchange dlx, List<Declarable> all) {
    Queue queue =
        QueueBuilder.durable(name).deadLetterExchange(DLX).deadLetterRoutingKey(dlq(name)).build();
    Queue deadLetters = QueueBuilder.durable(dlq(name)).build();
    Binding binding = BindingBuilder.bind(deadLetters).to(dlx).with(dlq(name));
    all.add(queue);
    all.add(deadLetters);
    all.add(binding);
    return queue;
  }
}
