-- V12: nhắn tin giữa hai người đã match. Bỏ match / chặn (xoá match) thì cuộc trò chuyện bị xoá theo.
-- Admin có toàn quyền xem (người dùng được báo khi bật "Tìm đối tượng").

CREATE TABLE messages (
  id         UUID         NOT NULL PRIMARY KEY,
  match_id   UUID         NOT NULL,
  sender_id  UUID         NOT NULL,
  body       TEXT         NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  read_at    TIMESTAMP(6) NULL,                 -- người nhận đã xem
  CONSTRAINT fk_message_match  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT ck_message_body CHECK (char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX ix_message_match_time ON messages (match_id, created_at);
