-- V9: "Tìm đối tượng" (kiểu Tinder): người dùng tự bật hiện hồ sơ, quẹt thích / bỏ qua, hai bên cùng
-- thích thì thành match. Admin có toàn quyền xem (người dùng được báo khi bật).

ALTER TABLE user_profiles
  ADD COLUMN dating_enabled BOOLEAN     NOT NULL DEFAULT false,
  -- Bộ lọc khi quẹt: muốn gặp ai, tuổi bao nhiêu, chỉ cùng thành phố
  ADD COLUMN interested_in  VARCHAR(10) NOT NULL DEFAULT 'all',
  ADD COLUMN age_min        SMALLINT    NOT NULL DEFAULT 18,
  ADD COLUMN age_max        SMALLINT    NOT NULL DEFAULT 99,
  ADD COLUMN same_city_only BOOLEAN     NOT NULL DEFAULT false,
  ADD CONSTRAINT ck_profile_interested CHECK (interested_in IN ('male','female','all')),
  ADD CONSTRAINT ck_profile_age_range CHECK (age_min >= 18 AND age_max <= 99 AND age_min <= age_max);

-- Mỗi người quẹt một người đúng một lần (hoàn tác thì xoá dòng)
CREATE TABLE swipes (
  swiper_id  UUID         NOT NULL,
  target_id  UUID         NOT NULL,
  liked      BOOLEAN      NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (swiper_id, target_id),
  CONSTRAINT fk_swipe_swiper FOREIGN KEY (swiper_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_swipe_target FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_swipe_not_self CHECK (swiper_id <> target_id)
);
CREATE INDEX ix_swipe_target ON swipes (target_id, liked);

-- Một cặp một match: user_a < user_b để (A, B) và (B, A) là cùng một dòng
CREATE TABLE matches (
  id         UUID         NOT NULL PRIMARY KEY,
  user_a     UUID         NOT NULL,
  user_b     UUID         NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT fk_match_a FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_match_b FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_match_order CHECK (user_a < user_b),
  CONSTRAINT uk_match_pair UNIQUE (user_a, user_b)
);
CREATE INDEX ix_match_b ON matches (user_b);
