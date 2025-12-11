-- ========================================
-- 🎯 诊断"已通过质检但仍在被打回列表"问题
-- ========================================
-- 问题：数据在"已标注任务"显示通过质检，但在"被打回重标"仍显示
-- 原因：is_resubmitted 标志可能没有正确更新
-- ========================================

-- 📊 报告1：检查"第七批第一次改写_语文-01.xlsx"视频的状态
WITH video_info AS (
    SELECT 
        id,
        name,
        subject
    FROM videos
    WHERE name LIKE '%第七批第一次改写_语文-01%'
    LIMIT 1
)
SELECT 
    '📊 报告1：该视频的基本信息' as report_title,
    v.id as video_id,
    v.name as video_name,
    v.subject,
    (SELECT COUNT(*) FROM annotations a WHERE a.video_id = v.id) as total_annotations,
    (SELECT COUNT(*) FROM annotations a WHERE a.video_id = v.id AND a.is_qualified = true) as qualified_count,
    (SELECT COUNT(*) FROM annotations a WHERE a.video_id = v.id AND a.is_qualified = false) as rejected_count,
    (SELECT COUNT(*) FROM rejected_annotations ra WHERE ra.video_id = v.id AND ra.is_resubmitted = false) as in_rejected_list
FROM video_info v;

-- 📊 报告2：检查该视频在 annotations 表中的详细状态
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '📊 报告2：annotations 表中的记录状态' as report_title,
    a.id as annotation_id,
    a.sentence_no,
    a.annotator,
    a.inspector,
    a.is_qualified,
    a.rejection_count,
    a.created_at,
    a.updated_at,
    CASE 
        WHEN a.is_qualified = true THEN '✅ 已通过质检'
        WHEN a.is_qualified = false THEN '❌ 被打回'
        ELSE '⚠️ 待质检'
    END as status_desc
FROM video_info v
JOIN annotations a ON a.video_id = v.id
WHERE a.annotator = '郭其其'
ORDER BY a.sentence_no
LIMIT 20;

-- 📊 报告3：检查该视频在 rejected_annotations 表中的状态
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '📊 报告3：rejected_annotations 表中的记录' as report_title,
    ra.id as rejected_record_id,
    ra.annotation_id,
    ra.sentence_no,
    ra.annotator,
    ra.inspector,
    ra.is_resubmitted,
    ra.new_annotation_id,
    ra.rejection_count,
    ra.rejected_at,
    ra.resubmitted_at,
    CASE 
        WHEN ra.is_resubmitted = true THEN '✅ 已重新提交'
        ELSE '❌ 待重新提交'
    END as resubmit_status
FROM video_info v
JOIN rejected_annotations ra ON ra.video_id = v.id
WHERE ra.annotator = '郭其其'
ORDER BY ra.sentence_no
LIMIT 20;

-- 📊 报告4：关键问题诊断 - 找出"通过质检但仍在打回列表"的记录
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
),
problem_records AS (
    SELECT 
        ra.id as rejected_id,
        ra.annotation_id as old_annotation_id,
        ra.new_annotation_id,
        ra.sentence_no,
        ra.annotator,
        ra.is_resubmitted,
        ra.rejected_at,
        a.id as current_annotation_id,
        a.is_qualified as current_qualified_status,
        a.rejection_count as current_rejection_count,
        a.updated_at as annotation_updated_at
    FROM video_info v
    JOIN rejected_annotations ra ON ra.video_id = v.id
    LEFT JOIN annotations a ON a.id = ra.annotation_id
    WHERE ra.annotator = '郭其其'
        AND ra.is_resubmitted = false  -- ⚠️ 仍标记为未重新提交
)
SELECT 
    '📊 报告4：问题记录详情' as report_title,
    pr.old_annotation_id,
    pr.new_annotation_id,
    pr.sentence_no,
    pr.is_resubmitted as rejected_table_flag,
    pr.current_qualified_status as annotations_table_status,
    pr.current_rejection_count,
    CASE 
        WHEN pr.current_qualified_status = true AND pr.is_resubmitted = false 
        THEN '🐛 BUG：已通过质检但 is_resubmitted 未更新'
        WHEN pr.current_qualified_status = false AND pr.is_resubmitted = false 
        THEN '✅ 正常：确实还未通过'
        WHEN pr.new_annotation_id IS NOT NULL AND pr.is_resubmitted = false 
        THEN '🐛 BUG：有新ID但 is_resubmitted 未更新'
        ELSE '⚠️ 其他情况'
    END as diagnosis,
    pr.rejected_at,
    pr.annotation_updated_at
FROM problem_records pr
ORDER BY pr.sentence_no
LIMIT 20;

-- 📊 报告5：统计问题严重程度
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '📊 报告5：问题统计' as report_title,
    COUNT(*) as total_rejected_records,
    SUM(CASE WHEN ra.is_resubmitted = false THEN 1 ELSE 0 END) as still_in_rejected_list,
    SUM(CASE WHEN ra.is_resubmitted = true THEN 1 ELSE 0 END) as marked_as_resubmitted,
    SUM(CASE 
        WHEN ra.is_resubmitted = false 
            AND EXISTS (
                SELECT 1 FROM annotations a 
                WHERE a.id = ra.annotation_id 
                    AND a.is_qualified = true
            ) 
        THEN 1 
        ELSE 0 
    END) as bug_count,
    ROUND(100.0 * SUM(CASE 
        WHEN ra.is_resubmitted = false 
            AND EXISTS (
                SELECT 1 FROM annotations a 
                WHERE a.id = ra.annotation_id 
                    AND a.is_qualified = true
            ) 
        THEN 1 
        ELSE 0 
    END) / NULLIF(COUNT(*), 0), 2) as bug_percentage
FROM video_info v
JOIN rejected_annotations ra ON ra.video_id = v.id
WHERE ra.annotator = '郭其其';

-- 📊 报告6：查找所有新生成的标注记录（重新提交后生成的）
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '📊 报告6：新生成的标注记录' as report_title,
    a.id as new_annotation_id,
    a.sentence_no,
    a.annotator,
    a.is_qualified,
    a.rejection_count,
    a.created_at,
    a.updated_at,
    CASE 
        WHEN a.rejection_count > 0 THEN '🔄 重新提交生成'
        ELSE '📝 首次标注'
    END as record_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM rejected_annotations ra 
            WHERE ra.new_annotation_id = a.id
        ) 
        THEN '✅ 已关联到 rejected_annotations'
        ELSE '❌ 未关联到 rejected_annotations'
    END as link_status
FROM video_info v
JOIN annotations a ON a.video_id = v.id
WHERE a.annotator = '郭其其'
    AND a.rejection_count > 0  -- 重新提交的记录
ORDER BY a.sentence_no
LIMIT 20;

-- ========================================
-- 🔧 修复建议
-- ========================================
-- 如果报告4显示有 BUG，说明 is_resubmitted 标志没有正确更新
-- 可能的原因：
-- 1. 重新提交时没有正确调用更新 rejected_annotations 的逻辑
-- 2. annotation_id 匹配不上（旧ID已被删除或改变）
-- 3. 更新条件（.eq('is_resubmitted', false)）导致已更新的记录无法再次更新
-- 
-- 修复方法见下一个 SQL 文件：FIX_resubmit_status.sql
-- ========================================

