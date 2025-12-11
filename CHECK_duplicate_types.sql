-- ========================================
-- 检查3：统计将要删除的记录（空 annotator 的重复记录）
-- ========================================

SELECT 
    '检查3_待删除记录统计' as report_section,
    COUNT(*) as total_template_records,
    COUNT(DISTINCT video_id) as affected_videos,
    STRING_AGG(DISTINCT video_id, ', ') as video_list
FROM annotations a
WHERE (annotator IS NULL OR annotator = '')
  AND EXISTS (
      SELECT 1 
      FROM annotations a2 
      WHERE a2.video_id = a.video_id 
        AND a2.sentence_no = a.sentence_no 
        AND a2.annotator IS NOT NULL 
        AND a2.annotator != ''
  );

-- ========================================
-- 额外检查：王曦禾视频的详细情况
-- ========================================

SELECT 
    '王曦禾视频详情' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = 'annotation_only_1763627409585'
  AND sentence_no <= 5
ORDER BY sentence_no, created_at;

-- ========================================
-- 检查：所有重复记录的类型分布
-- ========================================

SELECT 
    '重复记录类型分布' as report_section,
    CASE 
        WHEN empty_count = record_count THEN '全部都是空annotator'
        WHEN empty_count = 0 THEN '全部都有annotator'
        ELSE '混合（有空有非空）'
    END as duplicate_type,
    COUNT(*) as video_sentence_count,
    SUM(record_count) as total_records,
    SUM(empty_count) as total_empty_records
FROM (
    SELECT 
        video_id,
        sentence_no,
        COUNT(*) as record_count,
        COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as empty_count
    FROM annotations
    GROUP BY video_id, sentence_no
    HAVING COUNT(*) > 1
) duplicates
GROUP BY 
    CASE 
        WHEN empty_count = record_count THEN '全部都是空annotator'
        WHEN empty_count = 0 THEN '全部都有annotator'
        ELSE '混合（有空有非空）'
    END;

