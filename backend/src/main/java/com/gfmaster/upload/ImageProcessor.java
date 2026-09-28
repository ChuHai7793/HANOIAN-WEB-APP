package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.sksamuel.scrimage.ImmutableImage;
import com.sksamuel.scrimage.webp.WebpWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.stereotype.Component;

/**
 * Chuẩn hoá ảnh upload: chỉ nhận JPEG/PNG/WebP (kiểm tra magic bytes, không tin Content-Type),
 * xoay theo EXIF, thu về cạnh dài tối đa 1200px, xuất WebP. Mã hoá lại nên metadata (GPS...) bị bỏ.
 */
@Component
public class ImageProcessor {

  static final int MAX_EDGE = 1200;
  static final int THUMB_EDGE = 320;
  private static final WebpWriter WRITER = WebpWriter.DEFAULT.withQ(78);

  public record ProcessedImage(byte[] bytes, int width, int height) {}

  public ProcessedImage process(byte[] input) {
    if (!isSupported(input)) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE);
    }
    try {
      ImmutableImage image = ImmutableImage.loader().detectOrientation(true).fromBytes(input);
      if (image.width > MAX_EDGE || image.height > MAX_EDGE) {
        image = image.bound(MAX_EDGE, MAX_EDGE);
      }
      return new ProcessedImage(image.bytes(WRITER), image.width, image.height);
    } catch (IOException e) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Không đọc được file ảnh này.");
    }
  }

  /** Thumbnail cạnh dài tối đa 320px từ ảnh đã chuẩn hoá (WebP do {@link #process} sinh ra). */
  public ProcessedImage thumbnail(byte[] processed) {
    try {
      ImmutableImage image = ImmutableImage.loader().fromBytes(processed);
      if (image.width > THUMB_EDGE || image.height > THUMB_EDGE) {
        image = image.bound(THUMB_EDGE, THUMB_EDGE);
      }
      return new ProcessedImage(image.bytes(WRITER), image.width, image.height);
    } catch (IOException e) {
      throw new UncheckedIOException("Không đọc được ảnh để tạo thumbnail", e);
    }
  }

  static boolean isSupported(byte[] b) {
    return isJpeg(b) || isPng(b) || isWebp(b);
  }

  private static boolean isJpeg(byte[] b) {
    return b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
  }

  private static boolean isPng(byte[] b) {
    byte[] sig = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    return b.length > sig.length && Arrays.equals(b, 0, sig.length, sig, 0, sig.length);
  }

  private static boolean isWebp(byte[] b) {
    return b.length > 12
        && "RIFF".equals(new String(b, 0, 4, StandardCharsets.US_ASCII))
        && "WEBP".equals(new String(b, 8, 4, StandardCharsets.US_ASCII));
  }
}
