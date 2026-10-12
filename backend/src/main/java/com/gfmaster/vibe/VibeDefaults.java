package com.gfmaster.vibe;

import static com.gfmaster.vibe.Vibe.active;
import static com.gfmaster.vibe.Vibe.chill;
import static com.gfmaster.vibe.Vibe.romantic;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.spot.SpotCategory;
import java.util.EnumSet;
import java.util.Set;

/**
 * Nhãn kiểu hẹn suy ra từ loại quán / nhóm chỗ chơi (lấy kiểu hợp nhất). Giống hệt hai hàm SQL
 * {@code default_place_vibes} / {@code default_spot_vibes} (V15); VibeDefaultsIT kiểm tra hai bản khớp nhau.
 */
public final class VibeDefaults {

  private VibeDefaults() {}

  public static Set<Vibe> forPlace(PlaceType type, PriceRange price) {
    return switch (type) {
      case cafe -> EnumSet.of(chill);
      case bar -> EnumSet.of(romantic);
      case restaurant -> price == PriceRange.high || price == PriceRange.luxury ? EnumSet.of(romantic) : EnumSet.of(chill, romantic);
    };
  }

  public static Set<Vibe> forSpot(SpotCategory category) {
    return switch (category) {
      case entertainment, night_market, sport -> EnumSet.of(active);
      case workshop, show -> EnumSet.of(romantic);
      case museum -> EnumSet.of(chill);
      case outdoor -> EnumSet.of(chill, romantic);
    };
  }

  /**
   * Nhãn sau khi admin lưu form thêm / sửa.
   *
   * @param requested nhãn trong form (null = không gửi)
   * @param resetToDefault admin bấm "để hệ thống tự gán": về nhãn mặc định
   * @param current nhãn và nguồn hiện tại (null khi thêm mới)
   * @param fallback nhãn mặc định theo loại (sau khi đã áp loại mới)
   */
  public static Tagged resolve(Set<Vibe> requested, boolean resetToDefault, Tagged current, Set<Vibe> fallback) {
    if (resetToDefault) return new Tagged(EnumSet.copyOf(withType(fallback)), VibeSource.DEFAULT);
    // Form gửi lại đúng nhãn đang có (hoặc đúng nhãn mặc định khi thêm mới) = admin không đổi gì: giữ nguồn
    Set<Vibe> before = current == null ? fallback : current.vibes();
    if (requested != null && !requested.equals(before)) {
      return new Tagged(requested.isEmpty() ? EnumSet.noneOf(Vibe.class) : EnumSet.copyOf(requested), VibeSource.ADMIN);
    }
    if (current == null || current.source() == VibeSource.DEFAULT) {
      // Đổi loại quán thì nhãn mặc định đổi theo
      return new Tagged(EnumSet.copyOf(withType(fallback)), VibeSource.DEFAULT);
    }
    return current;
  }

  private static Set<Vibe> withType(Set<Vibe> vibes) {
    return vibes.isEmpty() ? EnumSet.noneOf(Vibe.class) : vibes;
  }

  public record Tagged(Set<Vibe> vibes, VibeSource source) {}
}
