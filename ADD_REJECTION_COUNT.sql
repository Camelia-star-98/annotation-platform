-- 添加被打回次数字段
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 给 annotations 表添加 rejection_count 字段（被打回次数）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN annotations.rejection_count IS '被打回次数：每次质检不通过时+1';

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_annotations_rejection_count 
ON annotations(rejection_count);

-- 3. 查看表结构确认
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'annotations' 
AND column_name = 'rejection_count'
ORDER BY ordinal_position;

