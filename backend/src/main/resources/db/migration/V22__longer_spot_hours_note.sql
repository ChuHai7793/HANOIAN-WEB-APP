-- V22: "Ghi chú giờ, giá" của chỗ chơi dài hơn 255 ký tự (vd. giá vé theo từng loại, giờ khác nhau theo mùa)
ALTER TABLE date_spots ALTER COLUMN hours_note TYPE VARCHAR(1000);
