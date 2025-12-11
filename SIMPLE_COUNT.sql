-- ========================================
-- 超级简单的计数查询
-- ========================================

-- 🔍 查询1：郭其其视频的 rejected_annotations 总数
SELECT 
    'rejected表记录总数' as description,
    COUNT(*) as total_count
FROM rejected_annotations
WHERE video_id = 'upload_1765171740803';

-- 🔍 查询2：郭其其视频的 annotations 总数（按 annotator 分组）
SELECT 
    'annotations表记录分布' as description,
    CASE 
        WHEN annotator IS NULL THEN 'NULL'
        WHEN annotator = '' THEN 'EMPTY'
        ELSE annotator
    END as annotator_value,
    COUNT(*) as count
FROM annotations
WHERE video_id = 'upload_1765171740803'
GROUP BY 
    CASE 
        WHEN annotator IS NULL THEN 'NULL'
        WHEN annotator = '' THEN 'EMPTY'
        ELSE annotator
    END;

-- 🔍 查询3：整个 rejected_annotations 表的统计
SELECT 
    'rejected表总体统计' as description,
    COUNT(*) as total_records,
    COUNT(CASE WHEN annotator IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN annotator = '' THEN 1 END) as empty_count,
    COUNT(CASE WHEN annotator IS NOT NULL AND annotator != '' THEN 1 END) as has_value_count
FROM rejected_annotations;

-- 🔍 查询4：整个 annotations 表有重复记录的视频
SELECT 
    'annotations重复记录检查' as description,
    video_id,
    sentence_no,
    COUNT(*) as duplicate_count,
    STRING_AGG(COALESCE(annotator, 'NULL'), ' | ') as annotators
FROM annotations
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, video_id, sentence_no
LIMIT 50;

-- 🔍 查询5：郭其其视频的重复记录详情
SELECT 
    '郭其其视频重复记录' as description,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no, created_at;

