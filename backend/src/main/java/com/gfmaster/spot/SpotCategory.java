package com.gfmaster.spot;

/** Nhóm chỗ chơi trong "Tìm chỗ chơi". Tên hằng viết thường để trùng giá trị trong DB và JSON. */
public enum SpotCategory {
  /** Music box, karaoke, rạp phim, bowling, escape room, board game */
  entertainment,
  /** Làm gốm, nến thơm, vẽ tranh, làm bánh */
  workshop,
  /** Bảo tàng, di tích */
  museum,
  /** Hồ, công viên, phố đi bộ */
  outdoor,
  /** Múa rối, nhà hát, nhạc sống */
  show,
  /** Chợ đêm, phố đêm */
  night_market,
  /** Trượt băng, leo núi trong nhà, pickleball */
  sport
}
