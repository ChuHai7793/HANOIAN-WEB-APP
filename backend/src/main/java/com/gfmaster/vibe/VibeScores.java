package com.gfmaster.vibe;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.spot.SpotCategory;

/**
 * Mức hợp (0–3) của một loại quán / nhóm chỗ chơi với một kiểu hẹn, dùng để chấm điểm trong Autoplan
 * (nhãn trong {@code vibes} cộng thêm điểm). Nhãn mặc định ({@link VibeDefaults}) là các kiểu có điểm cao
 * nhất ở bảng này.
 */
public final class VibeScores {

  private VibeScores() {}

  public static int forPlace(PlaceType type, PriceRange price, Vibe vibe) {
    return switch (type) {
      case cafe -> pick(vibe, 3, 1, 2);
      case bar -> pick(vibe, 1, 2, 3);
      case restaurant -> pick(vibe, 2, 1, price == PriceRange.high || price == PriceRange.luxury ? 3 : 2);
    };
  }

  public static int forSpot(SpotCategory category, Vibe vibe) {
    return switch (category) {
      case entertainment -> pick(vibe, 1, 3, 2);
      case workshop -> pick(vibe, 2, 2, 3);
      case museum -> pick(vibe, 3, 1, 2);
      case outdoor -> pick(vibe, 3, 2, 2);
      case show -> pick(vibe, 2, 1, 3);
      case night_market -> pick(vibe, 1, 3, 2);
      case sport -> pick(vibe, 1, 3, 1);
    };
  }

  private static int pick(Vibe vibe, int chill, int active, int romantic) {
    return switch (vibe) {
      case chill -> chill;
      case active -> active;
      case romantic -> romantic;
    };
  }
}
