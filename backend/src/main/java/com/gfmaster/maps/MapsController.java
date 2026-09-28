package com.gfmaster.maps;

import com.gfmaster.maps.ShortLinkResolver.Resolved;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Giải link Google Maps rút gọn thành toạ độ (trình duyệt không tự làm được vì CORS). */
@RestController
@RequestMapping("/api/v1/maps")
@Validated
public class MapsController {

  private final MapsService service;

  public MapsController(MapsService service) {
    this.service = service;
  }

  /** {@code lat}/{@code lng} là null nếu link hợp lệ nhưng không chứa toạ độ. */
  @GetMapping("/resolve")
  public Resolved resolve(@RequestParam @NotBlank @Size(max = 2048) String url) {
    return service.resolve(url);
  }
}
