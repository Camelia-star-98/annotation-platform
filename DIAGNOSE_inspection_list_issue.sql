-- 诊断：为什么质检通过了一部分数据，但视频还在质检列表里？
-- 问题：1104-数学-3.mp4 有25条通过，98条待质检，0条不通过

-- ============================================
-- 1. 查看这些视频的详细质检情况
-- ============================================

-- 1027-英语-1.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1027-英语-1%'
    AND status = true
GROUP BY video_name;

-- 1104-数学-3.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
GROUP BY video_name;

-- 1027-物理-1.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1027-物理-1%'
    AND status = true
GROUP BY video_name;

-- ============================================
-- 2. 查看是否有被打回的记录（在 rejected_annotations 表中）
-- ============================================

SELECT 
    a.video_name,
    COUNT(DISTINCT ra.annotation_id) as rejected_count,
    STRING_AGG(DISTINCT ra.rejected_by, ', ') as rejected_by
FROM rejected_annotations ra
JOIN annotations a ON ra.annotation_id = a.id
WHERE a.video_name IN (
    '1027-英语-1.mp4',
    '1104-数学-3.mp4',
    '1027-物理-1.mp4'
)
GROUP BY a.video_name;

-- ============================================
-- 3. 查看详细的句子级别数据（前20条）
-- ============================================

-- 1104-数学-3.mp4 的详细数据（有25条通过，可能是分批质检的）
SELECT 
    sentence_no,
    annotator,
    inspector,
    is_qualified,
    CASE 
        WHEN inspector IS NULL OR inspector = '' THEN '⏳ 待质检'
        WHEN is_qualified = true THEN '✅ 通过'
        WHEN is_qualified = false THEN '❌ 不通过'
        ELSE '❓ 未知'
    END as status_display
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
ORDER BY sentence_no
LIMIT 30;

-- ============================================
-- 4. 检查是否有历史打回记录（可能先打回，后来又重新标注通过了）
-- ============================================

SELECT 
    a.video_name,
    a.sentence_no,
    a.annotator,
    a.inspector,
    a.is_qualified,
    a.rejection_count,
    ra.rejected_reason,
    ra.rejected_at
FROM annotations a
LEFT JOIN rejected_annotations ra ON ra.annotation_id = a.id
WHERE a.video_name LIKE '%1104-数学-3%'
    AND a.status = true
    AND (ra.annotation_id IS NOT NULL OR a.rejection_count > 0)
ORDER BY a.sentence_no;

-- ============================================
-- 5. 查看所有待质检的视频（排除已全部质检完成的）
-- ============================================

SELECT 
    video_name,
    annotator,
    COUNT(*) as total_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    ROUND(
        COUNT(CASE WHEN is_qualified = true THEN 1 END)::numeric / 
        NULLIF(COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END), 0) * 100, 
        1
    ) as pass_rate
FROM annotations
WHERE status = true
    AND (inspector IS NULL OR inspector = '')
GROUP BY video_name, annotator
HAVING COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) > 0
ORDER BY pending_count DESC
LIMIT 20;

-- ============================================
-- 6. 🔍 关键诊断：查看这些视频是否存在 is_qualified = false 的记录
-- ============================================

SELECT 
    video_name,
    COUNT(*) as total_failed
FROM annotations
WHERE video_name IN (
    '1027-英语-1.mp4',
    '1104-数学-3.mp4', 
    '1027-物理-1.mp4'
)
    AND status = true
    AND is_qualified = false
GROUP BY video_name;

-- 如果没有返回结果，说明确实没有不通过的，那就是我们的自动标记逻辑没生效

-- ============================================
-- 7. 查看最近的质检提交记录（通过 updated_at 时间）
-- ============================================

SELECT 
    video_name,
    inspector,
    is_qualified,
    COUNT(*) as count,
    MAX(updated_at) as last_updated
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
    AND inspector IS NOT NULL
    AND inspector != ''
GROUP BY video_name, inspector, is_qualified
ORDER BY last_updated DESC;

-- ============================================
-- 🎯 诊断结论预测：
-- ============================================
-- 
-- 可能的原因：
-- 1. 质检是分多次进行的，每次只质检一部分，所以没有触发"全部通过自动标记"
-- 2. 曾经有句子被打回（is_qualified = false），后来又重新标注通过了
-- 3. 我们的自动标记逻辑有bug，没有正确执行
-- 
-- 解决方案：
-- - 如果确认该视频所有已质检的句子都是"通过"，没有"不通过"，
--   那就应该手动触发一次批量更新，将剩余未质检的句子也标记为通过

-- 问题：1104-数学-3.mp4 有25条通过，98条待质检，0条不通过

-- ============================================
-- 1. 查看这些视频的详细质检情况
-- ============================================

-- 1027-英语-1.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1027-英语-1%'
    AND status = true
GROUP BY video_name;

-- 1104-数学-3.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
GROUP BY video_name;

-- 1027-物理-1.mp4 的情况
SELECT 
    video_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    STRING_AGG(DISTINCT inspector, ', ') as inspectors
FROM annotations
WHERE video_name LIKE '%1027-物理-1%'
    AND status = true
GROUP BY video_name;

-- ============================================
-- 2. 查看是否有被打回的记录（在 rejected_annotations 表中）
-- ============================================

SELECT 
    a.video_name,
    COUNT(DISTINCT ra.annotation_id) as rejected_count,
    STRING_AGG(DISTINCT ra.rejected_by, ', ') as rejected_by
FROM rejected_annotations ra
JOIN annotations a ON ra.annotation_id = a.id
WHERE a.video_name IN (
    '1027-英语-1.mp4',
    '1104-数学-3.mp4',
    '1027-物理-1.mp4'
)
GROUP BY a.video_name;

-- ============================================
-- 3. 查看详细的句子级别数据（前20条）
-- ============================================

-- 1104-数学-3.mp4 的详细数据（有25条通过，可能是分批质检的）
SELECT 
    sentence_no,
    annotator,
    inspector,
    is_qualified,
    CASE 
        WHEN inspector IS NULL OR inspector = '' THEN '⏳ 待质检'
        WHEN is_qualified = true THEN '✅ 通过'
        WHEN is_qualified = false THEN '❌ 不通过'
        ELSE '❓ 未知'
    END as status_display
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
ORDER BY sentence_no
LIMIT 30;

-- ============================================
-- 4. 检查是否有历史打回记录（可能先打回，后来又重新标注通过了）
-- ============================================

SELECT 
    a.video_name,
    a.sentence_no,
    a.annotator,
    a.inspector,
    a.is_qualified,
    a.rejection_count,
    ra.rejected_reason,
    ra.rejected_at
FROM annotations a
LEFT JOIN rejected_annotations ra ON ra.annotation_id = a.id
WHERE a.video_name LIKE '%1104-数学-3%'
    AND a.status = true
    AND (ra.annotation_id IS NOT NULL OR a.rejection_count > 0)
ORDER BY a.sentence_no;

-- ============================================
-- 5. 查看所有待质检的视频（排除已全部质检完成的）
-- ============================================

SELECT 
    video_name,
    annotator,
    COUNT(*) as total_count,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as pending_count,
    COUNT(CASE WHEN is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN is_qualified = false THEN 1 END) as failed_count,
    ROUND(
        COUNT(CASE WHEN is_qualified = true THEN 1 END)::numeric / 
        NULLIF(COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END), 0) * 100, 
        1
    ) as pass_rate
FROM annotations
WHERE status = true
    AND (inspector IS NULL OR inspector = '')
GROUP BY video_name, annotator
HAVING COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) > 0
ORDER BY pending_count DESC
LIMIT 20;

-- ============================================
-- 6. 🔍 关键诊断：查看这些视频是否存在 is_qualified = false 的记录
-- ============================================

SELECT 
    video_name,
    COUNT(*) as total_failed
FROM annotations
WHERE video_name IN (
    '1027-英语-1.mp4',
    '1104-数学-3.mp4', 
    '1027-物理-1.mp4'
)
    AND status = true
    AND is_qualified = false
GROUP BY video_name;

-- 如果没有返回结果，说明确实没有不通过的，那就是我们的自动标记逻辑没生效

-- ============================================
-- 7. 查看最近的质检提交记录（通过 updated_at 时间）
-- ============================================

SELECT 
    video_name,
    inspector,
    is_qualified,
    COUNT(*) as count,
    MAX(updated_at) as last_updated
FROM annotations
WHERE video_name LIKE '%1104-数学-3%'
    AND status = true
    AND inspector IS NOT NULL
    AND inspector != ''
GROUP BY video_name, inspector, is_qualified
ORDER BY last_updated DESC;

-- ============================================
-- 🎯 诊断结论预测：
-- ============================================
-- 
-- 可能的原因：
-- 1. 质检是分多次进行的，每次只质检一部分，所以没有触发"全部通过自动标记"
-- 2. 曾经有句子被打回（is_qualified = false），后来又重新标注通过了
-- 3. 我们的自动标记逻辑有bug，没有正确执行
-- 
-- 解决方案：
-- - 如果确认该视频所有已质检的句子都是"通过"，没有"不通过"，
--   那就应该手动触发一次批量更新，将剩余未质检的句子也标记为通过

