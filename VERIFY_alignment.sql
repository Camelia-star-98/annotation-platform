-- ========================================
-- 🎯 验证"被打回重标"和"所有已标注任务"对齐效果
-- ========================================
-- 功能：检查两个页面的标注人显示逻辑是否一致
-- 作者：AI Assistant
-- 创建时间：2025-12-11
-- ========================================

-- 📊 报告1：检查"所有已标注任务"页面的标注人列表
-- 逻辑：只显示有标注人的记录（过滤掉空标注人）
SELECT 
    '📊 所有已标注任务 - 标注人列表' as report_title,
    v.name as video_name,
    v.subject,
    COUNT(DISTINCT a.annotator) as annotator_count,
    STRING_AGG(DISTINCT a.annotator, ', ') as annotators
FROM videos v
JOIN annotations a ON v.id = a.video_id
WHERE a.annotator IS NOT NULL 
    AND a.annotator != ''
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
GROUP BY v.id, v.name, v.subject
ORDER BY v.name
LIMIT 10;

-- 📊 报告2：检查"被打回重标"页面的标注人列表（修复后）
-- 逻辑：只显示有标注人的记录（过滤掉空标注人）
SELECT 
    '📊 被打回重标 - 标注人列表（修复后）' as report_title,
    v.name as video_name,
    v.subject,
    COUNT(DISTINCT ra.annotator) as annotator_count,
    STRING_AGG(DISTINCT ra.annotator, ', ') as annotators,
    COUNT(*) as rejected_count
FROM videos v
JOIN rejected_annotations ra ON v.id = ra.video_id
WHERE ra.is_resubmitted = false
    AND ra.annotator IS NOT NULL
    AND ra.annotator != ''
GROUP BY v.id, v.name, v.subject
ORDER BY v.name
LIMIT 10;

-- 📊 报告3：检查 rejected_annotations 表中是否还有空标注人
-- 应该为 0（修复后不应再插入空标注人）
SELECT 
    '📊 rejected_annotations 表中的空标注人记录（应为0）' as report_title,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 正确：没有空标注人记录'
        ELSE '❌ 错误：还有空标注人记录'
    END as status
FROM rejected_annotations
WHERE is_resubmitted = false
    AND (annotator IS NULL OR annotator = '' OR annotator = '(标注人未知)');

-- 📊 报告4：检查 annotations 表中被打回但标注人为空的记录
-- 这些记录不应该出现在 rejected_annotations 表中
SELECT 
    '📊 annotations 表中被打回但标注人为空的记录' as report_title,
    COUNT(*) as count_in_annotations,
    (SELECT COUNT(*) 
     FROM rejected_annotations ra
     WHERE ra.annotation_id IN (
         SELECT id FROM annotations 
         WHERE is_qualified = false 
             AND inspector IS NOT NULL 
             AND inspector != ''
             AND (annotator IS NULL OR annotator = '')
     )
    ) as count_in_rejected_table,
    CASE 
        WHEN (SELECT COUNT(*) 
              FROM rejected_annotations ra
              WHERE ra.annotation_id IN (
                  SELECT id FROM annotations 
                  WHERE is_qualified = false 
                      AND inspector IS NOT NULL 
                      AND inspector != ''
                      AND (annotator IS NULL OR annotator = '')
              )) = 0 
        THEN '✅ 正确：空标注人未插入 rejected_annotations'
        ELSE '❌ 错误：空标注人仍在 rejected_annotations 中'
    END as status
FROM annotations
WHERE is_qualified = false
    AND inspector IS NOT NULL 
    AND inspector != ''
    AND (annotator IS NULL OR annotator = '');

-- 📊 报告5：对比两个页面的数据一致性
-- 检查是否有被打回的有效记录（有标注人）未进入 rejected_annotations 表
WITH annotations_rejected AS (
    SELECT 
        id,
        video_id,
        annotator,
        rejection_count,
        updated_at
    FROM annotations
    WHERE is_qualified = false
        AND inspector IS NOT NULL 
        AND inspector != ''
        AND annotator IS NOT NULL
        AND annotator != ''
),
rejected_table AS (
    SELECT 
        annotation_id,
        video_id,
        annotator,
        rejection_count,
        rejected_at
    FROM rejected_annotations
    WHERE is_resubmitted = false
)
SELECT 
    '📊 数据一致性检查' as report_title,
    COUNT(ar.id) as total_rejected_with_annotator,
    COUNT(rt.annotation_id) as in_rejected_table,
    COUNT(ar.id) - COUNT(rt.annotation_id) as missing,
    CASE 
        WHEN COUNT(ar.id) = COUNT(rt.annotation_id) THEN '✅ 一致：所有有标注人的记录都已同步'
        ELSE '⚠️ 不一致：有记录缺失'
    END as status
FROM annotations_rejected ar
LEFT JOIN rejected_table rt ON ar.id = rt.annotation_id;

-- 📊 报告6：具体查看某个视频的标注人分布对比
-- 随机选一个有被打回记录的视频
WITH sample_video AS (
    SELECT video_id 
    FROM rejected_annotations 
    WHERE is_resubmitted = false 
    LIMIT 1
)
SELECT 
    '📊 示例视频的标注人分布对比' as report_title,
    '所有已标注任务' as page_name,
    STRING_AGG(DISTINCT a.annotator, ', ') as annotators
FROM sample_video sv
JOIN annotations a ON sv.video_id = a.video_id
WHERE a.annotator IS NOT NULL 
    AND a.annotator != ''
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
UNION ALL
SELECT 
    '📊 示例视频的标注人分布对比' as report_title,
    '被打回重标' as page_name,
    STRING_AGG(DISTINCT ra.annotator, ', ') as annotators
FROM sample_video sv
JOIN rejected_annotations ra ON sv.video_id = ra.video_id
WHERE ra.is_resubmitted = false
    AND ra.annotator IS NOT NULL
    AND ra.annotator != '';

-- 🎯 验证"被打回重标"和"所有已标注任务"对齐效果
-- ========================================
-- 功能：检查两个页面的标注人显示逻辑是否一致
-- 作者：AI Assistant
-- 创建时间：2025-12-11
-- ========================================

-- 📊 报告1：检查"所有已标注任务"页面的标注人列表
-- 逻辑：只显示有标注人的记录（过滤掉空标注人）
SELECT 
    '📊 所有已标注任务 - 标注人列表' as report_title,
    v.name as video_name,
    v.subject,
    COUNT(DISTINCT a.annotator) as annotator_count,
    STRING_AGG(DISTINCT a.annotator, ', ') as annotators
FROM videos v
JOIN annotations a ON v.id = a.video_id
WHERE a.annotator IS NOT NULL 
    AND a.annotator != ''
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
GROUP BY v.id, v.name, v.subject
ORDER BY v.name
LIMIT 10;

-- 📊 报告2：检查"被打回重标"页面的标注人列表（修复后）
-- 逻辑：只显示有标注人的记录（过滤掉空标注人）
SELECT 
    '📊 被打回重标 - 标注人列表（修复后）' as report_title,
    v.name as video_name,
    v.subject,
    COUNT(DISTINCT ra.annotator) as annotator_count,
    STRING_AGG(DISTINCT ra.annotator, ', ') as annotators,
    COUNT(*) as rejected_count
FROM videos v
JOIN rejected_annotations ra ON v.id = ra.video_id
WHERE ra.is_resubmitted = false
    AND ra.annotator IS NOT NULL
    AND ra.annotator != ''
GROUP BY v.id, v.name, v.subject
ORDER BY v.name
LIMIT 10;

-- 📊 报告3：检查 rejected_annotations 表中是否还有空标注人
-- 应该为 0（修复后不应再插入空标注人）
SELECT 
    '📊 rejected_annotations 表中的空标注人记录（应为0）' as report_title,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 正确：没有空标注人记录'
        ELSE '❌ 错误：还有空标注人记录'
    END as status
FROM rejected_annotations
WHERE is_resubmitted = false
    AND (annotator IS NULL OR annotator = '' OR annotator = '(标注人未知)');

-- 📊 报告4：检查 annotations 表中被打回但标注人为空的记录
-- 这些记录不应该出现在 rejected_annotations 表中
SELECT 
    '📊 annotations 表中被打回但标注人为空的记录' as report_title,
    COUNT(*) as count_in_annotations,
    (SELECT COUNT(*) 
     FROM rejected_annotations ra
     WHERE ra.annotation_id IN (
         SELECT id FROM annotations 
         WHERE is_qualified = false 
             AND inspector IS NOT NULL 
             AND inspector != ''
             AND (annotator IS NULL OR annotator = '')
     )
    ) as count_in_rejected_table,
    CASE 
        WHEN (SELECT COUNT(*) 
              FROM rejected_annotations ra
              WHERE ra.annotation_id IN (
                  SELECT id FROM annotations 
                  WHERE is_qualified = false 
                      AND inspector IS NOT NULL 
                      AND inspector != ''
                      AND (annotator IS NULL OR annotator = '')
              )) = 0 
        THEN '✅ 正确：空标注人未插入 rejected_annotations'
        ELSE '❌ 错误：空标注人仍在 rejected_annotations 中'
    END as status
FROM annotations
WHERE is_qualified = false
    AND inspector IS NOT NULL 
    AND inspector != ''
    AND (annotator IS NULL OR annotator = '');

-- 📊 报告5：对比两个页面的数据一致性
-- 检查是否有被打回的有效记录（有标注人）未进入 rejected_annotations 表
WITH annotations_rejected AS (
    SELECT 
        id,
        video_id,
        annotator,
        rejection_count,
        updated_at
    FROM annotations
    WHERE is_qualified = false
        AND inspector IS NOT NULL 
        AND inspector != ''
        AND annotator IS NOT NULL
        AND annotator != ''
),
rejected_table AS (
    SELECT 
        annotation_id,
        video_id,
        annotator,
        rejection_count,
        rejected_at
    FROM rejected_annotations
    WHERE is_resubmitted = false
)
SELECT 
    '📊 数据一致性检查' as report_title,
    COUNT(ar.id) as total_rejected_with_annotator,
    COUNT(rt.annotation_id) as in_rejected_table,
    COUNT(ar.id) - COUNT(rt.annotation_id) as missing,
    CASE 
        WHEN COUNT(ar.id) = COUNT(rt.annotation_id) THEN '✅ 一致：所有有标注人的记录都已同步'
        ELSE '⚠️ 不一致：有记录缺失'
    END as status
FROM annotations_rejected ar
LEFT JOIN rejected_table rt ON ar.id = rt.annotation_id;

-- 📊 报告6：具体查看某个视频的标注人分布对比
-- 随机选一个有被打回记录的视频
WITH sample_video AS (
    SELECT video_id 
    FROM rejected_annotations 
    WHERE is_resubmitted = false 
    LIMIT 1
)
SELECT 
    '📊 示例视频的标注人分布对比' as report_title,
    '所有已标注任务' as page_name,
    STRING_AGG(DISTINCT a.annotator, ', ') as annotators
FROM sample_video sv
JOIN annotations a ON sv.video_id = a.video_id
WHERE a.annotator IS NOT NULL 
    AND a.annotator != ''
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
UNION ALL
SELECT 
    '📊 示例视频的标注人分布对比' as report_title,
    '被打回重标' as page_name,
    STRING_AGG(DISTINCT ra.annotator, ', ') as annotators
FROM sample_video sv
JOIN rejected_annotations ra ON sv.video_id = ra.video_id
WHERE ra.is_resubmitted = false
    AND ra.annotator IS NOT NULL
    AND ra.annotator != '';

