-- V24: chỗ chơi thuộc thêm nhóm khác ngoài nhóm chính (date_spots.category). Nhóm chính vẫn quyết định nhãn
-- trên thẻ, icon trong plan và kiểu hẹn tự gán; lọc / đếm theo nhóm thì khớp cả nhóm chính lẫn nhóm khác.
CREATE TABLE spot_extra_categories (
  spot_id  UUID        NOT NULL REFERENCES date_spots(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL,
  PRIMARY KEY (spot_id, category),
  CONSTRAINT ck_spot_extra_category CHECK (category IN ('entertainment','workshop','museum','outdoor','show','night_market','sport'))
);
CREATE INDEX ix_spot_extra_categories_category ON spot_extra_categories (category);
