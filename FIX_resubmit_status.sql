-- ========================================
-- 🔧 修复"已通过质检但仍在被打回列表"问题
-- ========================================
-- 问题：数据已通过质检，但 rejected_annotations 表中的
--      is_resubmitted 标志未更新为 true
-- ========================================

-- 📋 步骤1：先运行诊断，确认问题范围
-- 请先运行 DIAGNOSE_resubmit_status.sql，查看报告4和报告5

-- ========================================
-- 🎯 修复方案A：根据 annotations 表的状态自动修复
-- ========================================
-- 逻辑：如果 annotations 表中对应的记录已通过质检（is_qualified = true），
--      则将 rejected_annotations 表中的 is_resubmitted 更新为 true
-- ========================================

-- 🔍 预览：将要修复的记录（不执行更新，只查看）
WITH to_fix AS (
    SELECT 
        ra.id as rejected_id,
        ra.annotation_id,
        ra.sentence_no,
        ra.annotator,
        ra.video_name,
        ra.is_resubmitted as current_flag,
        a.is_qualified as annotation_status,
        a.id as annotation_exists
    FROM rejected_annotations ra
    JOIN annotations a ON a.id = ra.annotation_id
    WHERE ra.is_resubmitted = false
        AND a.is_qualified = true  -- annotations 表中已通过质检
)
SELECT 
    '🔍 预览：将要修复的记录' as action,
    COUNT(*) as total_records,
    COUNT(DISTINCT video_name) as affected_videos,
    COUNT(DISTINCT annotator) as affected_annotators,
    STRING_AGG(DISTINCT video_name, ', ') as video_list
FROM to_fix;

-- 🔧 执行修复：更新 is_resubmitted 标志
-- ⚠️ 取消下面的注释来执行修复
/*
UPDATE rejected_annotations ra
SET 
    is_resubmitted = true,
    resubmitted_at = COALESCE(resubmitted_at, NOW())  -- 如果没有重新提交时间，用当前时间
FROM annotations a
WHERE ra.annotation_id = a.id
    AND ra.is_resubmitted = false
    AND a.is_qualified = true;
*/

-- ========================================
-- 🎯 修复方案B：根据 new_annotation_id 字段修复
-- ========================================
-- 逻辑：如果 rejected_annotations 表中已经有 new_annotation_id，
--      说明已经重新提交过，应该将 is_resubmitted 更新为 true
-- ========================================

-- 🔍 预览：有新ID但标志未更新的记录
SELECT 
    '🔍 预览：有新ID但未标记的记录' as action,
    COUNT(*) as total_records,
    COUNT(DISTINCT video_name) as affected_videos,
    COUNT(DISTINCT annotator) as affected_annotators
FROM rejected_annotations
WHERE is_resubmitted = false
    AND new_annotation_id IS NOT NULL
    AND new_annotation_id != '';

-- 🔧 执行修复：根据 new_annotation_id 更新
-- ⚠️ 取消下面的注释来执行修复
/*
UPDATE rejected_annotations
SET 
    is_resubmitted = true,
    resubmitted_at = COALESCE(resubmitted_at, NOW())
WHERE is_resubmitted = false
    AND new_annotation_id IS NOT NULL
    AND new_annotation_id != '';
*/

-- ========================================
-- 🎯 修复方案C：根据时间和打回次数智能判断
-- ========================================
-- 逻辑：如果同一个 annotation_id 有多条打回记录（rejection_count不同），
--      只保留最新的一条，其他的标记为 is_resubmitted = true
-- ========================================

-- 🔍 预览：同一 annotation_id 的多条打回记录
WITH duplicate_rejections AS (
    SELECT 
        annotation_id,
        COUNT(*) as rejection_times,
        MAX(rejection_count) as max_count,
        MAX(rejected_at) as latest_rejection
    FROM rejected_annotations
    WHERE is_resubmitted = false
    GROUP BY annotation_id
    HAVING COUNT(*) > 1
)
SELECT 
    '🔍 预览：有多次打回记录的 annotation' as action,
    COUNT(*) as affected_annotations,
    SUM(rejection_times) as total_records,
    SUM(rejection_times - 1) as records_to_mark_old
FROM duplicate_rejections;

-- 🔧 执行修复：标记旧的打回记录为已重新提交
-- ⚠️ 取消下面的注释来执行修复
/*
WITH latest_rejections AS (
    SELECT 
        annotation_id,
        MAX(rejected_at) as latest_rejection
    FROM rejected_annotations
    WHERE is_resubmitted = false
    GROUP BY annotation_id
)
UPDATE rejected_annotations ra
SET 
    is_resubmitted = true,
    resubmitted_at = COALESCE(resubmitted_at, NOW())
FROM latest_rejections lr
WHERE ra.annotation_id = lr.annotation_id
    AND ra.rejected_at < lr.latest_rejection
    AND ra.is_resubmitted = false;
*/

-- ========================================
-- 🎯 修复方案D：针对"第七批第一次改写_语文-01.xlsx"的快速修复
-- ========================================
-- 专门针对用户提到的这个视频
-- ========================================

-- 🔍 预览：该视频的问题记录
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '🔍 预览：该视频的问题记录' as action,
    ra.annotation_id,
    ra.sentence_no,
    ra.annotator,
    ra.is_resubmitted as current_flag,
    a.is_qualified as annotation_status,
    CASE 
        WHEN a.is_qualified = true THEN '🔧 需要修复'
        ELSE '✅ 无需修复'
    END as fix_needed
FROM video_info v
JOIN rejected_annotations ra ON ra.video_id = v.id
LEFT JOIN annotations a ON a.id = ra.annotation_id
WHERE ra.is_resubmitted = false
    AND ra.annotator = '郭其其'
ORDER BY ra.sentence_no;

-- 🔧 执行修复：只修复该视频的问题记录
-- ⚠️ 取消下面的注释来执行修复
/*
WITH video_info AS (
    SELECT id FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
UPDATE rejected_annotations ra
SET 
    is_resubmitted = true,
    resubmitted_at = COALESCE(ra.resubmitted_at, NOW())
FROM video_info v, annotations a
WHERE ra.video_id = v.id
    AND ra.annotation_id = a.id
    AND ra.is_resubmitted = false
    AND ra.annotator = '郭其其'
    AND a.is_qualified = true;
*/

-- ========================================
-- ✅ 验证修复结果
-- ========================================

-- 验证1：检查修复后的数量
SELECT 
    '✅ 验证1：修复后的统计' as check_name,
    COUNT(*) as total_rejected_records,
    SUM(CASE WHEN is_resubmitted = true THEN 1 ELSE 0 END) as marked_resubmitted,
    SUM(CASE WHEN is_resubmitted = false THEN 1 ELSE 0 END) as still_pending,
    ROUND(100.0 * SUM(CASE WHEN is_resubmitted = true THEN 1 ELSE 0 END) / COUNT(*), 2) as resubmitted_percentage
FROM rejected_annotations;

-- 验证2：检查是否还有"已通过但未标记"的记录
SELECT 
    '✅ 验证2：检查残留问题' as check_name,
    COUNT(*) as problem_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 所有问题已解决'
        ELSE '⚠️ 还有问题记录'
    END as status
FROM rejected_annotations ra
JOIN annotations a ON a.id = ra.annotation_id
WHERE ra.is_resubmitted = false
    AND a.is_qualified = true;

-- 验证3：检查具体视频的状态
WITH video_info AS (
    SELECT id, name FROM videos WHERE name LIKE '%第七批第一次改写_语文-01%' LIMIT 1
)
SELECT 
    '✅ 验证3：该视频的修复结果' as check_name,
    v.name as video_name,
    COUNT(*) as total_in_rejected_table,
    SUM(CASE WHEN ra.is_resubmitted = false THEN 1 ELSE 0 END) as still_showing_count,
    CASE 
        WHEN SUM(CASE WHEN ra.is_resubmitted = false THEN 1 ELSE 0 END) = 0 
        THEN '✅ 该视频已从被打回列表移除'
        ELSE '⚠️ 该视频仍在被打回列表中'
    END as status
FROM video_info v
JOIN rejected_annotations ra ON ra.video_id = v.id
WHERE ra.annotator = '郭其其'
GROUP BY v.name;

-- ========================================
-- 📊 推荐的修复顺序
-- ========================================
-- 1. 先运行 DIAGNOSE_resubmit_status.sql 了解问题范围
-- 2. 如果只想修复特定视频，使用修复方案D
-- 3. 如果想全局修复，按顺序尝试：
--    a. 修复方案B（根据 new_annotation_id）
--    b. 修复方案A（根据 is_qualified）
--    c. 修复方案C（根据重复记录）
-- 4. 执行验证查询，确认修复效果
-- ========================================

