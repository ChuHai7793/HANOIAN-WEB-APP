-- V10: hồ sơ có thêm ảnh (tối đa 6, có thứ tự) và sở thích dạng thẻ, hiện trên thẻ "Tìm đối tượng".
-- url lưu dạng /uploads/<key> như avatar_url.

CREATE TABLE profile_photos (
  user_id  UUID          NOT NULL,
  position INT           NOT NULL,
  url      VARCHAR(1024) NOT NULL,
  PRIMARY KEY (user_id, position),
  CONSTRAINT fk_photo_profile FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT ck_photo_position CHECK (position BETWEEN 0 AND 5)
);
CREATE INDEX ix_photo_url ON profile_photos (url);

CREATE TABLE profile_interests (
  user_id  UUID        NOT NULL,
  position INT         NOT NULL,
  interest VARCHAR(30) NOT NULL,
  PRIMARY KEY (user_id, position),
  CONSTRAINT fk_interest_profile FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);
