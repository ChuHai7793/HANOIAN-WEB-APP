package com.gfmaster.upload;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Đường tắt cho ảnh trình duyệt đã nén sẵn (canvas → WebP): chỉ đọc cấu trúc RIFF, không giải mã. Ảnh
 * dùng được nguyên trạng khi cả file chỉ gồm các chunk ảnh ({@code VP8 }, {@code VP8L}, {@code VP8X},
 * {@code ALPH}) và hồ sơ màu ({@code ICCP}, Chrome luôn gắn sRGB vào ảnh xuất từ canvas; tối đa
 * {@link #MAX_ICC_BYTES}), không có EXIF / XMP (GPS...), không động, không có byte thừa sau RIFF (chặn file
 * "hai mặt"), và cạnh dài không quá {@link ImageProcessor#MAX_EDGE}. Không đạt thì {@link #inspect} rỗng
 * và ảnh đi đường xử lý đầy đủ (giải mã + nén lại).
 */
final class WebpInspector {

  record Size(int width, int height) {}

  private static final Set<String> IMAGE_CHUNKS = Set.of("VP8 ", "VP8L", "VP8X", "ALPH", "ICCP");
  /** Cờ VP8X: EXIF (0x08), XMP (0x04), animation (0x02). ICC (0x20) và alpha (0x10) thì được. */
  private static final int VP8X_FORBIDDEN_FLAGS = 0x08 | 0x04 | 0x02;
  /** Hồ sơ sRGB thường 0,5–3KB; lớn hơn thì xử lý đầy đủ cho chắc */
  static final int MAX_ICC_BYTES = 4096;

  private WebpInspector() {}

  static Optional<Size> inspect(byte[] b) {
    if (b.length < 30 || !fourCc(b, 0).equals("RIFF") || !fourCc(b, 8).equals("WEBP")) return Optional.empty();
    long riffSize = u32(b, 4);
    if (riffSize + 8 != b.length) return Optional.empty();

    Size size = null;
    boolean extended = false;
    int pos = 12;
    while (pos < b.length) {
      if (pos + 8 > b.length) return Optional.empty();
      String type = fourCc(b, pos);
      long len = u32(b, pos + 4);
      int data = pos + 8;
      if (!IMAGE_CHUNKS.contains(type) || data + len > b.length) return Optional.empty();
      if (type.equals("ICCP") && len > MAX_ICC_BYTES) return Optional.empty();

      if (pos == 12) {
        // Chunk đầu tiên quyết định loại WebP và kích thước
        switch (type) {
          case "VP8X" -> {
            if (len < 10 || (b[data] & VP8X_FORBIDDEN_FLAGS) != 0) return Optional.empty();
            extended = true;
            size = new Size(1 + u24(b, data + 4), 1 + u24(b, data + 7));
          }
          case "VP8 " -> size = vp8Size(b, data, len);
          case "VP8L" -> size = vp8lSize(b, data, len);
          default -> {
            return Optional.empty();
          }
        }
        if (size == null) return Optional.empty();
      } else if (!extended || type.equals("VP8X")) {
        // WebP đơn giản chỉ có đúng một chunk; VP8X chỉ được đứng đầu
        return Optional.empty();
      }
      pos = data + (int) len + (int) (len & 1); // chunk lẻ có 1 byte đệm
    }
    if (pos != b.length) return Optional.empty();
    int max = ImageProcessor.MAX_EDGE;
    if (size.width() < 1 || size.height() < 1 || size.width() > max || size.height() > max) return Optional.empty();
    return Optional.of(size);
  }

  /** Khung VP8 lossy: 3 byte frame tag, mã bắt đầu 9d 01 2a, rồi rộng/cao 14 bit. */
  private static Size vp8Size(byte[] b, int data, long len) {
    if (len < 10 || (b[data] & 0x01) != 0) return null; // bit 0 = 0: keyframe
    if ((b[data + 3] & 0xFF) != 0x9D || (b[data + 4] & 0xFF) != 0x01 || (b[data + 5] & 0xFF) != 0x2A) return null;
    return new Size(u16(b, data + 6) & 0x3FFF, u16(b, data + 8) & 0x3FFF);
  }

  /** VP8L lossless: chữ ký 0x2f, rồi (rộng - 1) 14 bit, (cao - 1) 14 bit. */
  private static Size vp8lSize(byte[] b, int data, long len) {
    if (len < 5 || (b[data] & 0xFF) != 0x2F) return null;
    long bits = u32(b, data + 1);
    return new Size((int) (bits & 0x3FFF) + 1, (int) ((bits >> 14) & 0x3FFF) + 1);
  }

  private static String fourCc(byte[] b, int pos) {
    return new String(b, pos, 4, StandardCharsets.US_ASCII);
  }

  private static int u16(byte[] b, int pos) {
    return (b[pos] & 0xFF) | (b[pos + 1] & 0xFF) << 8;
  }

  private static int u24(byte[] b, int pos) {
    return u16(b, pos) | (b[pos + 2] & 0xFF) << 16;
  }

  private static long u32(byte[] b, int pos) {
    return (u24(b, pos) | (long) (b[pos + 3] & 0xFF) << 24);
  }
}
