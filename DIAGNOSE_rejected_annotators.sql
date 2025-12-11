-- ========================================
-- 诊断被打回数据中的标注人信息
-- ========================================

-- 查询1：检查 rejected_annotations 表结构
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'rejected_annotations'
ORDER BY ordinal_position;

-- 查询2：统计 rejected_annotations 表中的数据
SELECT 
    '被打回数据_annotator统计' as report_section,
    COUNT(*) as total_count,
    COUNT(annotator) as has_annotator_count,
    COUNT(*) - COUNT(annotator) as null_annotator_count,
    COUNT(CASE WHEN annotator IS NOT NULL AND annotator != '' THEN 1 END) as valid_annotator_count,
    COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as empty_annotator_count
FROM rejected_annotations
WHERE is_resubmitted = false;

-- 查询3：按视频分组，显示标注人和质检人信息
SELECT 
    '被打回数据_按视频分组' as report_section,
    video_id,
    video_name,
    subject,
    COUNT(*) as rejected_count,
    STRING_AGG(DISTINCT COALESCE(annotator, '(空)'), ' | ' ORDER BY COALESCE(annotator, '(空)')) as annotators,
    STRING_AGG(DISTINCT COALESCE(inspector, '(空)'), ' | ' ORDER BY COALESCE(inspector, '(空)')) as inspectors,
    MAX(rejected_at) as last_rejected_time
FROM rejected_annotations
WHERE is_resubmitted = false
GROUP BY video_id, video_name, subject
ORDER BY last_rejected_time DESC
LIMIT 20;

-- 查询4：查看所有 annotator 为空的被打回记录（前20条样例）
SELECT 
    '标注人为空的被打回记录' as report_section,
    id,
    video_id,
    video_name,
    subject,
    sentence_no,
    annotator,
    inspector,
    rejected_at,
    annotation_id
FROM rejected_annotations
WHERE is_resubmitted = false
  AND (annotator IS NULL OR annotator = '')
ORDER BY rejected_at DESC
LIMIT 20;

-- 查询5：查看郭其其的被打回记录（如果存在）
SELECT 
    '郭其其的被打回记录' as report_section,
    id,
    video_id,
    video_name,
    subject,
    sentence_no,
    annotator,
    inspector,
    rejected_at,
    annotation_id
FROM rejected_annotations
WHERE is_resubmitted = false
  AND annotator = '郭其其'
ORDER BY rejected_at DESC
LIMIT 20;

-- 查询6：检查 annotations 表中这些被打回记录的原始数据
-- （查找 is_qualified = false 的记录）
SELECT 
    'annotations表中被打回的记录' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    inspector,
    is_qualified,
    rejection_count,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_time
FROM annotations
WHERE is_qualified = false
  AND inspector IS NOT NULL
  AND inspector != ''
ORDER BY updated_at DESC
LIMIT 20;

