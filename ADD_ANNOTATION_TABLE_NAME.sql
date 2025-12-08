-- =========================================
-- 添加 annotation_table_name 字段到 videos 表
-- =========================================

-- 添加 annotation_table_name 字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_table_name TEXT;

-- 添加注释
COMMENT ON COLUMN videos.annotation_table_name IS '标注表格数据名称';

-- 验证字段是否添加成功
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos'
AND column_name = 'annotation_table_name';

-- =========================================
-- ✅ 添加完成！
-- =========================================

