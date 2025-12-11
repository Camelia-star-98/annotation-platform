-- ============================================
-- 🎯 检查并修复"标注文件名"字段问题
-- ============================================
-- 请在 Supabase Dashboard 的 SQL Editor 中运行此脚本
-- https://supabase.com/dashboard/project/[your-project]/sql

-- ============================================
-- 步骤 1: 检查字段是否存在
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'videos' 
AND column_name = 'annotation_file_name';

-- 如果上面的查询没有返回结果，说明字段不存在，需要添加：
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;

COMMENT ON COLUMN videos.annotation_file_name 
IS '标注数据文件名（上传的Excel文件名）';

-- ============================================
-- 步骤 2: 查看当前数据状态
-- ============================================
SELECT 
    COUNT(*) AS "总视频数",
    COUNT(annotation_file_name) AS "有标注文件名的视频数",
    COUNT(*) FILTER (WHERE annotation_file_name IS NULL OR annotation_file_name = '') AS "空值数量"
FROM videos;

-- ============================================
-- 步骤 3: 查看具体的视频数据（最近10个）
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    created_at AS "创建时间"
FROM videos
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 步骤 4: 为所有没有标注文件名的视频设置默认值
-- ============================================
-- 方案A: 根据视频名称推测标注文件名（推荐）
UPDATE videos 
SET annotation_file_name = REPLACE(name, '.mp4', '_标注.xlsx')
WHERE annotation_file_name IS NULL OR annotation_file_name = '';

-- 方案B: 如果需要统一设置为相同的文件名
-- UPDATE videos 
-- SET annotation_file_name = '标注数据.xlsx'
-- WHERE annotation_file_name IS NULL OR annotation_file_name = '';

-- ============================================
-- 步骤 5: 验证修复结果
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名"
FROM videos
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 完成！现在刷新质检管理页面，应该能看到"标注文件名"列了
-- ============================================

