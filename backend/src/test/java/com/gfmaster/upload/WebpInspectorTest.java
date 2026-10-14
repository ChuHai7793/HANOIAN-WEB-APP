package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.upload.WebpInspector.Size;
import com.sksamuel.scrimage.ImmutableImage;
import com.sksamuel.scrimage.nio.PngWriter;
import com.sksamuel.scrimage.webp.WebpWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class WebpInspectorTest {

  private static byte[] webp(int w, int h, WebpWriter writer) throws Exception {
    return ImmutableImage.filled(w, h, Color.ORANGE).bytes(writer);
  }

  @Test
  void acceptsCleanLossyAndLosslessWebp() throws Exception {
    assertThat(WebpInspector.inspect(webp(800, 600, WebpWriter.DEFAULT))).contains(new Size(800, 600));
    assertThat(WebpInspector.inspect(webp(300, 1200, WebpWriter.DEFAULT.withLossless()))).contains(new Size(300, 1200));
  }

  @Test
  void rejectsOtherFormatsAndOversizedImages() throws Exception {
    assertThat(WebpInspector.inspect(ImmutableImage.filled(50, 50, Color.RED).bytes(PngWriter.NoCompression))).isEmpty();
    assertThat(WebpInspector.inspect(webp(1201, 400, WebpWriter.DEFAULT))).isEmpty();
    assertThat(WebpInspector.inspect(new byte[0])).isEmpty();
    assertThat(WebpInspector.inspect("RIFF\0\0\0\0WEBP<script>alert(1)</script>....".getBytes())).isEmpty();
  }

  @Test
  void rejectsTrailingBytesAndTruncatedFiles() throws Exception {
    byte[] clean = webp(100, 100, WebpWriter.DEFAULT);
    byte[] trailing = Arrays.copyOf(clean, clean.length + 20); // RIFF size không đổi: có byte thừa phía sau
    assertThat(WebpInspector.inspect(trailing)).isEmpty();
    assertThat(WebpInspector.inspect(Arrays.copyOf(clean, clean.length - 10))).isEmpty();
  }

  @Test
  void extendedWebpOnlyWithoutMetadata() throws Exception {
    byte[] simple = webp(640, 480, WebpWriter.DEFAULT);
    byte[] image = Arrays.copyOfRange(simple, 12, simple.length); // chunk VP8 của ảnh đơn giản

    // Alpha (0x10) thì được; EXIF (0x08), XMP (0x04), động (0x02) thì phải xử lý đầy đủ
    assertThat(WebpInspector.inspect(extended(0x10, image))).contains(new Size(640, 480));
    for (int flag : new int[] {0x08, 0x04, 0x02}) {
      assertThat(WebpInspector.inspect(extended(flag, image))).as("flag %x", flag).isEmpty();
    }
    // Cờ sạch nhưng có chunk EXIF thật ở cuối
    byte[] exif = chunk("EXIF", "GPS 21.0,105.8".getBytes());
    assertThat(WebpInspector.inspect(extended(0, concat(image, exif)))).isEmpty();
  }

  @Test
  void chromeCanvasWebpWithSrgbProfileIsAccepted() throws Exception {
    byte[] simple = webp(640, 480, WebpWriter.DEFAULT);
    byte[] image = Arrays.copyOfRange(simple, 12, simple.length);
    // File thật Chrome xuất từ canvas.toBlob('image/webp')
    try (var in = getClass().getResourceAsStream("/chrome-canvas.webp")) {
      assertThat(WebpInspector.inspect(in.readAllBytes())).isPresent();
    }
    // Như Chrome: VP8X (cờ ICC) + ICCP 456 byte + VP8
    assertThat(WebpInspector.inspect(extended(0x20, concat(chunk("ICCP", new byte[456]), image)))).contains(new Size(640, 480));
    // Hồ sơ màu quá lớn: xử lý đầy đủ
    byte[] bigIcc = chunk("ICCP", new byte[WebpInspector.MAX_ICC_BYTES + 2]);
    assertThat(WebpInspector.inspect(extended(0x20, concat(bigIcc, image)))).isEmpty();
  }

  /** RIFF/WEBP với chunk VP8X (cờ {@code flags}, 640x480) theo sau là {@code chunks}. */
  private static byte[] extended(int flags, byte[] chunks) {
    ByteBuffer vp8x = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN);
    vp8x.put((byte) flags).put(new byte[3]);
    vp8x.put(u24(639)).put(u24(479));
    byte[] body = concat("WEBP".getBytes(), chunk("VP8X", vp8x.array()), chunks);
    ByteBuffer riff = ByteBuffer.allocate(8 + body.length).order(ByteOrder.LITTLE_ENDIAN);
    riff.put("RIFF".getBytes()).putInt(body.length).put(body);
    return riff.array();
  }

  private static byte[] chunk(String type, byte[] data) {
    ByteBuffer b = ByteBuffer.allocate(8 + data.length + (data.length & 1)).order(ByteOrder.LITTLE_ENDIAN);
    b.put(type.getBytes()).putInt(data.length).put(data);
    return b.array();
  }

  private static byte[] u24(int v) {
    return new byte[] {(byte) v, (byte) (v >> 8), (byte) (v >> 16)};
  }

  private static byte[] concat(byte[]... parts) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    for (byte[] p : parts) out.writeBytes(p);
    return out.toByteArray();
  }
}
