package com.gfmaster.realtime;

import com.gfmaster.realtime.RealtimeEvents.Envelope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import tools.jackson.databind.json.JsonMapper;

/** Mỗi máy nghe kênh realtime trên Redis và đẩy sự kiện xuống các kết nối SSE nó đang giữ. */
@Configuration(proxyBeanMethods = false)
public class RealtimeConfig {

  private static final Logger log = LoggerFactory.getLogger(RealtimeConfig.class);

  @Bean
  RedisMessageListenerContainer realtimeListener(RedisConnectionFactory connectionFactory, SseHub hub, JsonMapper json) {
    var container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(
        (message, pattern) -> {
          try {
            Envelope e = json.readValue(message.getBody(), Envelope.class);
            hub.deliver(e.userId(), e.type(), e.data());
          } catch (RuntimeException ex) {
            log.warn("Bỏ qua sự kiện realtime lỗi: {}", ex.getMessage());
          }
        },
        new ChannelTopic(RealtimeEvents.CHANNEL));
    return container;
  }
}
