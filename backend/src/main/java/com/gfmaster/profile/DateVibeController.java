package com.gfmaster.profile;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.vibe.Vibe;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Kết quả quiz "Gu hẹn hò" của người đang đăng nhập; dùng làm kiểu hẹn mặc định (Autoplan…). */
@RestController
@RequestMapping("/api/v1/me/vibe")
public class DateVibeController {

  public record DateVibe(Vibe vibe) {}

  private final NamedParameterJdbcTemplate jdbc;

  public DateVibeController(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping
  public DateVibe get(@CurrentUser UUID me) {
    List<String> v = jdbc.queryForList("SELECT date_vibe FROM users WHERE id = :id", Map.of("id", me), String.class);
    return new DateVibe(v.isEmpty() || v.getFirst() == null ? null : Vibe.valueOf(v.getFirst()));
  }

  /** {@code vibe} null = xoá kết quả */
  @PutMapping
  public ResponseEntity<Void> save(@CurrentUser UUID me, @RequestBody DateVibe body) {
    Map<String, Object> p = new HashMap<>();
    p.put("id", me);
    p.put("vibe", body.vibe() == null ? null : body.vibe().name());
    jdbc.update("UPDATE users SET date_vibe = :vibe WHERE id = :id", p);
    return ResponseEntity.noContent().build();
  }
}
