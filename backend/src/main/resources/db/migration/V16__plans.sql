-- V16: "Plan": lịch trình buổi hẹn của từng người (điểm 1 → điểm 2 → …), điểm là quán trong Khám phá quán
-- hoặc chỗ chơi. Rủ đi: gửi plan vào tin nhắn của một match, người kia xem được plan đó.

CREATE TABLE plans (
  id          UUID          NOT NULL PRIMARY KEY,
  user_id     UUID          NOT NULL,
  title       VARCHAR(120)  NOT NULL,
  plan_date   DATE          NULL,                  -- NULL = chưa chọn ngày
  start_time  TIME          NOT NULL,              -- giờ bắt đầu điểm đầu tiên
  district    VARCHAR(30)   NULL,                  -- khu vực chính (CatalogDistrict), lọc sẵn khi thêm điểm
  note        TEXT          NOT NULL DEFAULT '',
  status      VARCHAR(12)   NOT NULL DEFAULT 'draft',
  memory      TEXT          NOT NULL DEFAULT '',   -- ghi lại sau buổi hẹn
  -- Tuỳ chọn của Autoplan, cũng dùng khi bấm "Đổi" một điểm
  vibe        VARCHAR(10)   NULL,                  -- chill / active / romantic, NULL = không ưu tiên
  budget      INT           NULL,                  -- VNĐ / người cho mỗi điểm, NULL = không giới hạn
  rainy       BOOLEAN       NOT NULL DEFAULT false, -- chỉ chọn chỗ chơi trong nhà
  created_at  TIMESTAMP(6)  NOT NULL,
  updated_at  TIMESTAMP(6)  NOT NULL,
  version     BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_plan_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_plan_status CHECK (status IN ('draft', 'scheduled', 'done')),
  CONSTRAINT ck_plan_vibe   CHECK (vibe IS NULL OR vibe IN ('chill', 'active', 'romantic')),
  CONSTRAINT ck_plan_budget CHECK (budget IS NULL OR budget >= 0)
);
CREATE INDEX ix_plan_user ON plans (user_id, updated_at DESC);

-- Một điểm dừng: đúng một trong catalog_id / spot_id. Quán / chỗ chơi bị admin xoá thì điểm mất theo.
CREATE TABLE plan_stops (
  id           UUID          NOT NULL PRIMARY KEY,
  plan_id      UUID          NOT NULL,
  position     INT           NOT NULL,             -- 0, 1, 2… theo thứ tự đi
  catalog_id   UUID          NULL,
  spot_id      UUID          NULL,
  duration_min SMALLINT      NOT NULL,             -- ở lại bao lâu
  note         VARCHAR(500)  NOT NULL DEFAULT '',
  rating       SMALLINT      NULL,                 -- chấm sau buổi hẹn
  memory       VARCHAR(2000) NOT NULL DEFAULT '',
  CONSTRAINT fk_stop_plan    FOREIGN KEY (plan_id)    REFERENCES plans(id)         ON DELETE CASCADE,
  CONSTRAINT fk_stop_catalog FOREIGN KEY (catalog_id) REFERENCES place_catalog(id) ON DELETE CASCADE,
  CONSTRAINT fk_stop_spot    FOREIGN KEY (spot_id)    REFERENCES date_spots(id)    ON DELETE CASCADE,
  CONSTRAINT ck_stop_target  CHECK ((catalog_id IS NULL) <> (spot_id IS NULL)),
  CONSTRAINT ck_stop_minutes CHECK (duration_min BETWEEN 15 AND 600),
  CONSTRAINT ck_stop_rating  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);
CREATE INDEX ix_stop_plan ON plan_stops (plan_id, position);

-- Tin nhắn "Rủ đi" kèm một plan; plan bị xoá thì tin vẫn còn, chỉ mất đính kèm
ALTER TABLE messages ADD COLUMN plan_id UUID NULL;
ALTER TABLE messages ADD CONSTRAINT fk_message_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
CREATE INDEX ix_message_plan ON messages (plan_id) WHERE plan_id IS NOT NULL;
