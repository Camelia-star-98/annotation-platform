-- 🔍 检查标注文件名字段
-- 检查 videos 表中的 annotation_file_name 字段是否存在且有数据

-- ============================================
-- 🎯 检查1: 字段是否存在
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'videos' 
AND column_name = 'annotation_file_name';

-- ============================================
-- 📊 检查2: 数据统计
-- ============================================
SELECT 
    COUNT(*) AS "总视频数",
    COUNT(annotation_file_name) AS "有标注文件名的视频数",
    COUNT(*) - COUNT(annotation_file_name) AS "无标注文件名的视频数",
    ROUND(COUNT(annotation_file_name)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS "覆盖率(%)"
FROM videos;

-- ============================================
-- 🔍 检查3: 查看具体数据（最近20个视频）
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    created_at AS "创建时间",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' THEN '❌ 无'
        ELSE '✅ 有'
    END AS "状态"
FROM videos
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 🎯 检查4: 用户截图中提到的视频
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' THEN '❌ 无'
        ELSE '✅ 有'
    END AS "状态"
FROM videos
WHERE 
    name ILIKE '%1027-英语-1.mp4%' 
    OR name ILIKE '%1104-数学-3.mp4%'
    OR name ILIKE '%1027-物理-1.mp4%'
ORDER BY name;

-- ============================================
-- 💡 如果字段不存在，执行以下SQL创建字段：
-- ============================================
-- ALTER TABLE videos 
-- ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;
-- 
-- COMMENT ON COLUMN videos.annotation_file_name 
-- IS '标注数据文件名（上传的Excel文件名）';

-- ============================================
-- 🔧 如果需要手动填充老数据的标注文件名
-- ============================================
-- 方案1：根据视频名称推测（假设标注文件和视频同名）
-- UPDATE videos 
-- SET annotation_file_name = REPLACE(name, '.mp4', '.xlsx')
-- WHERE annotation_file_name IS NULL OR annotation_file_name = '';

-- 方案2：手动设置默认值
-- UPDATE videos 
-- SET annotation_file_name = '标注数据.xlsx'
-- WHERE annotation_file_name IS NULL OR annotation_file_name = '';


-- ============================================
-- 🎯 检查1: 字段是否存在
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'videos' 
AND column_name = 'annotation_file_name';

-- ============================================
-- 📊 检查2: 数据统计
-- ============================================
SELECT 
    COUNT(*) AS "总视频数",
    COUNT(annotation_file_name) AS "有标注文件名的视频数",
    COUNT(*) - COUNT(annotation_file_name) AS "无标注文件名的视频数",
    ROUND(COUNT(annotation_file_name)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS "覆盖率(%)"
FROM videos;

-- ============================================
-- 🔍 检查3: 查看具体数据（最近20个视频）
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    created_at AS "创建时间",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' THEN '❌ 无'
        ELSE '✅ 有'
    END AS "状态"
FROM videos
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 🎯 检查4: 用户截图中提到的视频
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' THEN '❌ 无'
        ELSE '✅ 有'
    END AS "状态"
FROM videos
WHERE 
    name ILIKE '%1027-英语-1.mp4%' 
    OR name ILIKE '%1104-数学-3.mp4%'
    OR name ILIKE '%1027-物理-1.mp4%'
ORDER BY name;

-- ============================================
-- 💡 如果字段不存在，执行以下SQL创建字段：
-- ============================================
-- ALTER TABLE videos 
-- ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;
-- 
-- COMMENT ON COLUMN videos.annotation_file_name 
-- IS '标注数据文件名（上传的Excel文件名）';

-- ============================================
-- 🔧 如果需要手动填充老数据的标注文件名
-- ============================================
-- 方案1：根据视频名称推测（假设标注文件和视频同名）
-- UPDATE videos 
-- SET annotation_file_name = REPLACE(name, '.mp4', '.xlsx')
-- WHERE annotation_file_name IS NULL OR annotation_file_name = '';

-- 方案2：手动设置默认值
-- UPDATE videos 
-- SET annotation_file_name = '标注数据.xlsx'
-- WHERE annotation_file_name IS NULL OR annotation_file_name = '';
