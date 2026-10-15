package com.gfmaster.upload;

/**
 * Ảnh dùng vào việc gì: quyết định thư mục trên storage công khai ({@code places/2026/10/...}). Frontend
 * gửi lúc bắt đầu upload; giá trị lạ hoặc thiếu thì vào {@code misc/}.
 */
public enum ImagePurpose {
  place("places"),
  spot("spots"),
  avatar("avatars"),
  dating("dating"),
  girlfriend("girlfriends"),
  /** Ảnh nền banner (vd. đầu trang Khám phá quán) */
  banner("banners"),
  /** Ảnh bìa bài viết Cẩm nang */
  article("articles"),
  misc("misc");

  final String folder;

  ImagePurpose(String folder) {
    this.folder = folder;
  }

  static ImagePurpose parse(String value) {
    if (value == null) return misc;
    for (ImagePurpose p : values()) {
      if (p.name().equals(value.trim())) return p;
    }
    return misc;
  }
}
