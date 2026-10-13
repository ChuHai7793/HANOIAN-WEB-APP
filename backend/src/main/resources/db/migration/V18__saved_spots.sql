-- V18: "Lưu vào My place" cho chỗ chơi. Khác quán (sao chép thành bản riêng trong places), chỗ chơi chỉ lưu
-- liên kết: My place luôn hiện thông tin mới nhất admin nhập; admin xoá chỗ chơi thì mục đã lưu mất theo.

CREATE TABLE saved_spots (
  user_id    UUID         NOT NULL,
  spot_id    UUID         NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (user_id, spot_id),
  CONSTRAINT fk_saved_spot_user FOREIGN KEY (user_id) REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_saved_spot_spot FOREIGN KEY (spot_id) REFERENCES date_spots(id) ON DELETE CASCADE
);
CREATE INDEX ix_saved_spot_spot ON saved_spots (spot_id);
