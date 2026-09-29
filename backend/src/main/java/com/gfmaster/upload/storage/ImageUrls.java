package com.gfmaster.upload.storage;

import com.gfmaster.config.GfmProperties;
import org.mapstruct.Named;
import org.springframework.stereotype.Component;

/**
 * Ảnh của mình được lưu trong DB ở <b>dạng nội bộ</b> {@code /uploads/<key>}, không phụ thuộc chỗ
 * phục vụ. API trả ra <b>URL công khai</b> {@code <publicBaseUrl>/<key>}: {@code /uploads/...} khi
 * chạy local, {@code https://img.example.com/...} khi dùng CDN. Đổi CDN hay tên miền chỉ cần đổi
 * {@code gfm.storage.public-base-url}, không phải sửa dữ liệu.
 *
 * <p>Link ảnh ngoài (http(s) của trang khác) giữ nguyên ở cả hai chiều.
 *
 * <p>Mọi method đều có {@code @Named}: class này nằm trong {@code uses} của mapper MapStruct, và
 * method String→String không có qualifier sẽ bị MapStruct tự áp cho <b>mọi</b> field String.
 */
@Component
public class ImageUrls {

  public static final String STORED_PREFIX = "/uploads/";

  private final String publicBase;

  public ImageUrls(GfmProperties props) {
    this.publicBase = props.storage().publicBaseUrl().replaceAll("/+$", "") + "/";
  }

  /** Dạng lưu DB của một key trong storage công khai. */
  @Named("storedFromKey")
  public static String stored(String key) {
    return STORED_PREFIX + key;
  }

  /** Dạng lưu → URL trình duyệt tải được. */
  @Named("publicUrl")
  public String toPublic(String stored) {
    if (stored == null || !stored.startsWith(STORED_PREFIX)) return stored;
    return publicBase + stored.substring(STORED_PREFIX.length());
  }

  /** URL client gửi lên (có thể là URL công khai API đã trả) → dạng lưu. */
  @Named("storedUrl")
  public String toStored(String url) {
    if (url == null || !url.startsWith(publicBase)) return url;
    return STORED_PREFIX + url.substring(publicBase.length());
  }
}
