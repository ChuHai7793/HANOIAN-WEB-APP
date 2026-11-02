package com.gfmaster.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/** ClientIp: IP dùng cho rate limit không giả được bằng X-Forwarded-For tự ghi. */
class ClientIpTest {

  private static MockHttpServletRequest request(String forwardedFor) {
    MockHttpServletRequest r = new MockHttpServletRequest();
    r.setRemoteAddr("10.0.0.9");
    if (forwardedFor != null) r.addHeader("X-Forwarded-For", forwardedFor);
    return r;
  }

  @Test
  void withSecretTakesTheEntryAppendedByTheProxyNotTheSpoofedOne() {
    assertThat(new ClientIp("s3cret").of(request("1.2.3.4, 203.0.113.7"))).isEqualTo("203.0.113.7");
  }

  @Test
  void withSecretTrustsClientIpHeaderOnlyWithTheRightKey() {
    ClientIp ip = new ClientIp("s3cret");
    MockHttpServletRequest ok = request("198.51.100.1");
    ok.addHeader(ClientIp.CLIENT_IP_HEADER, "203.0.113.7");
    ok.addHeader(ClientIp.PROXY_KEY_HEADER, "s3cret");
    assertThat(ip.of(ok)).isEqualTo("203.0.113.7");

    MockHttpServletRequest forged = request("198.51.100.1");
    forged.addHeader(ClientIp.CLIENT_IP_HEADER, "1.2.3.4");
    forged.addHeader(ClientIp.PROXY_KEY_HEADER, "doan-bua");
    assertThat(ip.of(forged)).isEqualTo("198.51.100.1");
  }

  @Test
  void withoutSecretKeepsTheOldFirstEntry() {
    assertThat(new ClientIp("").of(request("203.0.113.7, 198.51.100.1"))).isEqualTo("203.0.113.7");
  }

  @Test
  void noHeaderFallsBackToTheSocketAddress() {
    assertThat(new ClientIp("s3cret").of(request(null))).isEqualTo("10.0.0.9");
    assertThat(new ClientIp(null).of(request(null))).isEqualTo("10.0.0.9");
  }
}
