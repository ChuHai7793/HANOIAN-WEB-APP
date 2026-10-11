-- V11: an toàn cho "Tìm đối tượng": chặn, báo cáo, admin khoá người dùng khỏi mục này.

-- Chặn: hai người không còn thấy nhau, match giữa hai người bị xoá
CREATE TABLE blocks (
  blocker_id UUID         NOT NULL,
  blocked_id UUID         NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_block_not_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX ix_block_blocked ON blocks (blocked_id);

-- Báo cáo gửi về admin
CREATE TABLE reports (
  id          UUID         NOT NULL PRIMARY KEY,
  reporter_id UUID         NOT NULL,
  reported_id UUID         NOT NULL,
  reason      VARCHAR(30)  NOT NULL,
  note        TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(10)  NOT NULL DEFAULT 'OPEN',
  created_at  TIMESTAMP(6) NOT NULL,
  resolved_at TIMESTAMP(6) NULL,
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reported FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_report_reason CHECK (reason IN ('fake_profile','inappropriate','harassment','spam','underage','other')),
  CONSTRAINT ck_report_status CHECK (status IN ('OPEN','RESOLVED'))
);
CREATE INDEX ix_report_status ON reports (status, created_at);

-- Admin khoá: không hiện trên thẻ của ai, không quẹt được
ALTER TABLE user_profiles ADD COLUMN dating_banned BOOLEAN NOT NULL DEFAULT false;
