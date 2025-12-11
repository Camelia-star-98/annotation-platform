-- ========================================
-- 🔍 找出"被打回重标"页面显示数据的真正原因
-- ========================================
-- 问题：报告5显示 rejected_annotations 表中没有该视频的记录
--      但前端"被打回重标"页面仍然显示该视频
-- 可能原因：
--   1. 视频名称不匹配
--   2. 前端查询逻辑与我们的诊断SQL不同
--   3. 前端可能查的是 annotations 表而非 rejected_annotations 表
-- ========================================

-- 📊 报告1：查找所有包含"语文-01"的视频
SELECT 
    '📊 报告1：所有包含"语文-01"的视频' as report_title,
    id,
    name,
    subject,
    total_sentences,
    publish_date,
    (SELECT COUNT(*) FROM annotations a WHERE a.video_id = videos.id) as annotation_count,
    (SELECT COUNT(*) FROM rejected_annotations ra WHERE ra.video_id = videos.id) as rejected_count
FROM videos
WHERE name LIKE '%语文-01%'
ORDER BY name;

-- 📊 报告2：查找郭其其的所有被打回记录（不限视频）
SELECT 
    '📊 报告2：郭其其的所有被打回记录' as report_title,
    video_name,
    video_id,
    COUNT(*) as rejected_count,
    SUM(CASE WHEN is_resubmitted = false THEN 1 ELSE 0 END) as still_in_list,
    MIN(rejected_at) as first_rejection,
    MAX(rejected_at) as last_rejection
FROM rejected_annotations
WHERE annotator = '郭其其'
GROUP BY video_name, video_id
ORDER BY last_rejection DESC
LIMIT 20;

-- 📊 报告3：检查前端"被打回重标"页面的实际查询逻辑
-- 前端可能是查询 annotations 表中 is_qualified = false 的记录
SELECT 
    '📊 报告3：annotations 表中被打回的记录（郭其其）' as report_title,
    v.name as video_name,
    v.id as video_id,
    COUNT(*) as rejected_annotation_count,
    MIN(a.updated_at) as first_rejection,
    MAX(a.updated_at) as last_rejection,
    STRING_AGG(DISTINCT a.id, ', ') as annotation_ids
FROM videos v
JOIN annotations a ON a.video_id = v.id
WHERE a.annotator = '郭其其'
    AND a.is_qualified = false  -- 被打回的标记
GROUP BY v.name, v.id
ORDER BY last_rejection DESC
LIMIT 20;

-- 📊 报告4：查找"第七批第一次改写_语文-01"的精确名称
SELECT 
    '📊 报告4：查找语文-01视频的精确名称' as report_title,
    id,
    name,
    LENGTH(name) as name_length,
    subject
FROM videos
WHERE name LIKE '%语文%01%'
    OR name LIKE '%语文-01%'
    OR name LIKE '%第七批%语文%'
ORDER BY name;

-- 📊 报告5：检查该视频在 annotations 表中的详细状态
WITH target_video AS (
    SELECT id, name FROM videos 
    WHERE name LIKE '%第七批%' AND name LIKE '%语文%01%'
    LIMIT 1
)
SELECT 
    '📊 报告5：该视频在 annotations 表中的状态' as report_title,
    tv.name as video_name,
    a.id as annotation_id,
    a.sentence_no,
    a.annotator,
    a.is_qualified,
    a.inspector,
    a.rejection_count,
    a.created_at,
    a.updated_at,
    CASE 
        WHEN a.is_qualified = true THEN '✅ 已通过质检'
        WHEN a.is_qualified = false THEN '❌ 被打回（应该显示在被打回列表）'
        WHEN a.is_qualified IS NULL THEN '⏳ 待质检'
    END as status_display
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id
WHERE a.annotator = '郭其其'
ORDER BY a.sentence_no;

-- 📊 报告6：检查该视频的 rejected_annotations 记录（使用精确视频ID）
WITH target_video AS (
    SELECT id, name FROM videos 
    WHERE name LIKE '%第七批%' AND name LIKE '%语文%01%'
    LIMIT 1
)
SELECT 
    '📊 报告6：该视频在 rejected_annotations 表中的记录' as report_title,
    tv.name as video_name,
    ra.id as rejected_id,
    ra.annotation_id,
    ra.sentence_no,
    ra.annotator,
    ra.is_resubmitted,
    ra.new_annotation_id,
    ra.rejected_at,
    ra.resubmitted_at
FROM target_video tv
LEFT JOIN rejected_annotations ra ON ra.video_id = tv.id
WHERE ra.annotator = '郭其其' OR ra.id IS NULL
ORDER BY ra.sentence_no;

-- 📊 报告7：前端"被打回重标"页面的真实查询逻辑推测
-- 可能查询的是：rejected_annotations 表中 is_resubmitted = false 的记录
SELECT 
    '📊 报告7：被打回重标页面应该显示的所有数据（郭其其）' as report_title,
    ra.video_name,
    ra.video_id,
    COUNT(*) as sentences_in_list,
    MIN(ra.rejected_at) as first_rejection,
    MAX(ra.rejected_at) as last_rejection,
    ra.is_resubmitted,
    CASE 
        WHEN ra.is_resubmitted = false THEN '🔴 应该显示在列表中'
        ELSE '✅ 应该从列表移除'
    END as should_display
FROM rejected_annotations ra
WHERE ra.annotator = '郭其其'
GROUP BY ra.video_name, ra.video_id, ra.is_resubmitted
ORDER BY last_rejection DESC;

-- 📊 报告8：完整对比 - annotations vs rejected_annotations
WITH target_video AS (
    SELECT id, name FROM videos 
    WHERE name LIKE '%第七批%' AND name LIKE '%语文%01%'
    LIMIT 1
)
SELECT 
    '📊 报告8：完整对比分析' as report_title,
    tv.name as video_name,
    (SELECT COUNT(*) FROM annotations a 
     WHERE a.video_id = tv.id AND a.annotator = '郭其其') as total_annotations,
    (SELECT COUNT(*) FROM annotations a 
     WHERE a.video_id = tv.id AND a.annotator = '郭其其' AND a.is_qualified = false) as annotations_rejected,
    (SELECT COUNT(*) FROM annotations a 
     WHERE a.video_id = tv.id AND a.annotator = '郭其其' AND a.is_qualified = true) as annotations_qualified,
    (SELECT COUNT(*) FROM rejected_annotations ra 
     WHERE ra.video_id = tv.id AND ra.annotator = '郭其其') as rejected_table_total,
    (SELECT COUNT(*) FROM rejected_annotations ra 
     WHERE ra.video_id = tv.id AND ra.annotator = '郭其其' AND ra.is_resubmitted = false) as rejected_table_pending,
    CASE 
        WHEN (SELECT COUNT(*) FROM rejected_annotations ra 
              WHERE ra.video_id = tv.id AND ra.annotator = '郭其其' AND ra.is_resubmitted = false) > 0
        THEN '🔴 应该显示在被打回列表'
        WHEN (SELECT COUNT(*) FROM annotations a 
              WHERE a.video_id = tv.id AND a.annotator = '郭其其' AND a.is_qualified = false) > 0
        THEN '⚠️ annotations表显示被打回，但rejected_annotations表没记录'
        ELSE '✅ 不应该显示在被打回列表'
    END as diagnosis
FROM target_video tv;

-- ========================================
-- 🎯 关键发现和下一步行动
-- ========================================
-- 请运行此SQL并查看：
-- 1. 报告3 - 如果有记录，说明前端可能直接查 annotations 表
-- 2. 报告5 - 查看该视频在 annotations 表中的 is_qualified 状态
-- 3. 报告8 - 完整对比，找出真正的不一致之处
-- 
-- 根据结果判断：
-- - 如果报告5显示 is_qualified = false，说明前端查的是 annotations 表
-- - 如果报告5显示 is_qualified = true，说明前端可能有缓存或查询错误
-- ========================================

