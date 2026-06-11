-- 5C: Brand memory — track caption edits for AI style consistency
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_was_edited boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_final text;
