package com.gfmaster.common.web;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * IP thật của người gọi, dùng để giới hạn tần suất theo IP (chống dò mật khẩu).
 *
 * <p>Phần đầu của {@code X-Forwarded-For} do trình duyệt tự ghi được: lấy phần tử đầu thì mỗi lần
 * thử đổi một IP giả là có giới hạn mới. Nên:
 *
 * <ol>
 *   <li>Request đi qua server SSR (proxy /api) mang {@code X-Proxy-Key} đúng {@code PROXY_SECRET}:
 *       tin {@code X-Client-IP} do server SSR ghi (IP nó thấy từ Render).
 *   <li>Còn lại: phần tử <b>cuối</b> của {@code X-Forwarded-For}, do proxy ngay trước backend
 *       (Render, Caddy) nối vào, trình duyệt không sửa được.
 *   <li>Không có header: địa chỉ TCP.
 * </ol>
 *
 * Chưa đặt {@code PROXY_SECRET}: giữ cách cũ (phần tử đầu), vì mọi request qua server SSR cùng
 * chung phần tử cuối (IP của server SSR) và sẽ dùng chung một giới hạn.
 */
public final class ClientIp {

  public static final String CLIENT_IP_HEADER = "X-Client-IP";
  public static final String PROXY_KEY_HEADER = "X-Proxy-Key";

  private final byte[] proxySecret;

  public ClientIp(String proxySecret) {
    this.proxySecret = proxySecret == null ? new byte[0] : proxySecret.trim().getBytes(StandardCharsets.UTF_8);
  }

  public String of(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (proxySecret.length == 0) {
      return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : first(forwarded);
    }
    String key = request.getHeader(PROXY_KEY_HEADER);
    String client = request.getHeader(CLIENT_IP_HEADER);
    if (key != null
        && client != null
        && !client.isBlank()
        && MessageDigest.isEqual(proxySecret, key.getBytes(StandardCharsets.UTF_8))) {
      return client.trim();
    }
    return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : last(forwarded);
  }

  private static String first(String forwarded) {
    return forwarded.split(",")[0].trim();
  }

  private static String last(String forwarded) {
    String[] parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
}
