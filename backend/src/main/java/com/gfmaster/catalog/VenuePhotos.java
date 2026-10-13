package com.gfmaster.catalog;

import com.gfmaster.upload.storage.ImageUrls;
import java.util.List;

/**
 * Ảnh của quán (Khám phá quán) và chỗ chơi: tối đa 6, ảnh đầu tiên là ảnh bìa (cột {@code image_url}, dùng ở
 * những chỗ chỉ cần một ảnh: My place, Plan…).
 */
public final class VenuePhotos {

  public static final int MAX = 6;

  private VenuePhotos() {}

  /**
   * Danh sách admin gửi → dạng lưu: bỏ trống, bỏ trùng, tối đa 6. {@code photos} null (client chỉ gửi một
   * ảnh như trước): dùng {@code imageUrl}.
   */
  public static List<String> toStored(List<String> photos, String imageUrl, ImageUrls urls) {
    List<String> source = photos != null ? photos : imageUrl == null ? List.of() : List.of(imageUrl);
    return source.stream()
        .filter(u -> u != null && !u.isBlank())
        .map(u -> urls.toStored(u.strip()))
        .distinct()
        .limit(MAX)
        .toList();
  }

  /** Dạng trả về; dòng cũ chưa có bảng ảnh thì lấy ảnh bìa. */
  public static List<String> toPublic(List<String> stored, String cover, ImageUrls urls) {
    if (stored.isEmpty()) return cover == null || cover.isBlank() ? List.of() : List.of(urls.toPublic(cover));
    return stored.stream().map(urls::toPublic).toList();
  }
}
