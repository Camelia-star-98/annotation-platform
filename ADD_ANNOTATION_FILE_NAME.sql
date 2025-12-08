-- =========================================
-- 添加标注数据文件名字段
-- 在 Supabase SQL Editor 中执行此脚本
-- =========================================

-- 添加 annotation_file_name 字段到 videos 表
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;

-- 添加注释
COMMENT ON COLUMN videos.annotation_file_name IS '标注数据文件名（上传的Excel文件名）';

-- 查看表结构确认
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos'
ORDER BY ordinal_position;

