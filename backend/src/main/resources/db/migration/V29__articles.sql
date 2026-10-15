-- V29: "Cẩm nang" - bài viết SEO (danh sách quán, lịch trình hẹn hò, mẹo...). Nội dung Markdown; chèn thẻ quán /
-- chỗ chơi bằng dòng riêng [[quan:slug]] / [[cho-choi:slug]]. Chỉ bài published mới công khai.
CREATE TABLE articles (
  id           UUID          NOT NULL PRIMARY KEY,
  slug         VARCHAR(90)   NOT NULL,
  title        VARCHAR(160)  NOT NULL,
  excerpt      VARCHAR(300)  NOT NULL DEFAULT '',
  cover_url    VARCHAR(1024) NULL,
  body         TEXT          NOT NULL DEFAULT '',
  status       VARCHAR(10)   NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP(6)  NULL,
  author_id    UUID          NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP(6)  NOT NULL,
  updated_at   TIMESTAMP(6)  NOT NULL,
  CONSTRAINT uk_articles_slug UNIQUE (slug),
  CONSTRAINT ck_articles_status CHECK (status IN ('draft', 'published'))
);
CREATE INDEX ix_articles_published ON articles (status, published_at DESC);
