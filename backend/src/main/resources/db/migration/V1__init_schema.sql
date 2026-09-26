-- V1__init_schema.sql
-- Không bao giờ sửa file này sau khi đã chạy. Muốn đổi schema thì tạo V2__..., V3__...

CREATE TABLE users (
  id            UUID         NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(80)  NOT NULL,
  created_at    DATETIME(6)  NOT NULL,
  updated_at    DATETIME(6)  NOT NULL,
  version       BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT uk_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE places (
  id              UUID          NOT NULL PRIMARY KEY,
  user_id         UUID          NOT NULL,
  type            VARCHAR(20)   NOT NULL,
  name            VARCHAR(120)  NOT NULL,
  address         VARCHAR(255)  NOT NULL DEFAULT '',
  price_range     VARCHAR(20)   NOT NULL,
  rating          TINYINT       NOT NULL,
  open_time       TIME          NOT NULL,
  close_time      TIME          NOT NULL,
  image_url       VARCHAR(1024) NOT NULL DEFAULT '',
  note            TEXT          NOT NULL DEFAULT '',
  google_maps_url VARCHAR(2048) NOT NULL DEFAULT '',
  lat             DECIMAL(9,6)  NULL,
  lng             DECIMAL(9,6)  NULL,
  has_wifi        BOOLEAN       NULL,
  has_parking     BOOLEAN       NULL,
  cuisine         VARCHAR(50)   NULL,
  created_at      DATETIME(6)   NOT NULL,
  updated_at      DATETIME(6)   NOT NULL,
  version         BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_places_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_places_type   CHECK (type IN ('cafe','restaurant','bar')),
  CONSTRAINT ck_places_price  CHECK (price_range IN ('cheap','medium','high','luxury')),
  CONSTRAINT ck_places_rating CHECK (rating BETWEEN 1 AND 5),
  INDEX ix_places_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE girlfriends (
  id           UUID          NOT NULL PRIMARY KEY,
  user_id      UUID          NOT NULL,
  name         VARCHAR(80)   NOT NULL,
  nickname     VARCHAR(80)   NOT NULL DEFAULT '',
  avatar_url   VARCHAR(1024) NOT NULL DEFAULT '',
  birthday     DATE          NULL,
  phone        VARCHAR(20)   NOT NULL DEFAULT '',
  status       VARCHAR(20)   NOT NULL DEFAULT 'dating',
  started_date DATE          NULL,
  note         TEXT          NOT NULL DEFAULT '',
  created_at   DATETIME(6)   NOT NULL,
  updated_at   DATETIME(6)   NOT NULL,
  version      BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_gf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_gf_status CHECK (status IN ('dating','crush','ex','married')),
  INDEX ix_gf_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE girlfriend_hobbies (
  girlfriend_id UUID        NOT NULL,
  position      INT         NOT NULL,
  hobby         VARCHAR(50) NOT NULL,
  PRIMARY KEY (girlfriend_id, position),
  CONSTRAINT fk_hobby_gf FOREIGN KEY (girlfriend_id) REFERENCES girlfriends(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE place_links (
  id              UUID        NOT NULL PRIMARY KEY,
  girlfriend_id   UUID        NOT NULL,
  place_id        UUID        NOT NULL,
  her_rating      TINYINT     NOT NULL,
  last_visited_at DATE        NULL,
  memory          TEXT        NOT NULL DEFAULT '',
  created_at      DATETIME(6) NOT NULL,
  updated_at      DATETIME(6) NOT NULL,
  version         BIGINT      NOT NULL DEFAULT 0,
  CONSTRAINT fk_link_gf    FOREIGN KEY (girlfriend_id) REFERENCES girlfriends(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_place FOREIGN KEY (place_id)      REFERENCES places(id)      ON DELETE CASCADE,
  CONSTRAINT uk_link_gf_place UNIQUE (girlfriend_id, place_id),
  CONSTRAINT ck_link_rating CHECK (her_rating BETWEEN 1 AND 5),
  INDEX ix_link_place (place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE uploads (
  id           UUID          NOT NULL PRIMARY KEY,
  user_id      UUID          NOT NULL,
  storage_key  VARCHAR(255)  NOT NULL,
  url          VARCHAR(1024) NOT NULL,
  thumb_url    VARCHAR(1024) NULL,
  mime_type    VARCHAR(50)   NOT NULL,
  size_bytes   INT           NOT NULL,
  width        INT           NOT NULL,
  height       INT           NOT NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'READY',  -- READY | THUMB_PENDING | FAILED
  created_at   DATETIME(6)   NOT NULL,
  CONSTRAINT fk_upload_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uk_upload_key UNIQUE (storage_key),
  INDEX ix_upload_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE import_jobs (
  id          UUID         NOT NULL PRIMARY KEY,
  user_id     UUID         NOT NULL,
  status      VARCHAR(20)  NOT NULL,          -- QUEUED | RUNNING | DONE | FAILED
  payload_key VARCHAR(255) NOT NULL,          -- file JSON gốc trong storage
  stats       JSON         NULL,              -- {"places":12,"girlfriends":3,...}
  error       TEXT         NULL,
  created_at  DATETIME(6)  NOT NULL,
  finished_at DATETIME(6)  NULL,
  CONSTRAINT fk_import_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_import_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
