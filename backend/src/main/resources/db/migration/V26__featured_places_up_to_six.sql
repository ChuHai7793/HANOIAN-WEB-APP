-- V26: điểm hẹn nổi bật thành một hàng ngang trượt được, tối đa 6 quán (trước là 3)
ALTER TABLE featured_places DROP CONSTRAINT ck_featured_position;
ALTER TABLE featured_places ADD CONSTRAINT ck_featured_position CHECK (position BETWEEN 1 AND 6);
