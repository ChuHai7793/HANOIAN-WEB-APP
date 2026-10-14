package com.gfmaster.upload;

import com.gfmaster.upload.LegacyImageRenamer.Report;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Việc bảo trì ảnh cho admin (SecurityConfig chặn {@code /api/v1/admin/**} cho người khác). */
@RestController
@RequestMapping("/api/v1/admin/uploads")
public class UploadAdminController {

  private final LegacyImageRenamer renamer;

  public UploadAdminController(LegacyImageRenamer renamer) {
    this.renamer = renamer;
  }

  /**
   * Đổi tên ảnh cũ sang dạng dễ đọc. Mặc định chỉ chạy thử ({@code dryRun=true}): xem danh sách trước, rồi gọi
   * lại với {@code dryRun=false}. Mỗi lần tối đa {@code limit} ảnh; chạy lại tới khi {@code renamed} = 0.
   */
  @PostMapping("/rename-legacy")
  public Report renameLegacy(
      @RequestParam(defaultValue = "true") boolean dryRun, @RequestParam(defaultValue = "200") int limit) {
    return renamer.run(dryRun, limit);
  }
}
