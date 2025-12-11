-- ========================================
-- 完整的郭其其和王曦禾诊断脚本
-- ========================================

-- 查询A：郭其其视频的完整情况
SELECT 
    '郭其其_完整信息' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_time
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no, created_at;

-- 查询B：王曦禾视频的完整情况（前10条）
SELECT 
    '王曦禾_完整信息' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_time
FROM annotations
WHERE video_id = 'annotation_only_1763627409585'
  AND sentence_no <= 10
ORDER BY sentence_no, created_at;

-- 查询C：所有有重复且都有annotator的记录（样例，前20条）
SELECT 
    '都有annotator的重复记录_样例' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time
FROM annotations a
WHERE EXISTS (
    SELECT 1
    FROM annotations a2
    WHERE a2.video_id = a.video_id
      AND a2.sentence_no = a.sentence_no
      AND a2.id != a.id
      AND a2.annotator IS NOT NULL
      AND a2.annotator != ''
)
AND a.annotator IS NOT NULL
AND a.annotator != ''
ORDER BY video_id, sentence_no, created_at
LIMIT 20;

-- 查询D：统计重复记录的 annotator 模式
SELECT 
    '重复记录annotator模式' as report_section,
    video_id,
    sentence_no,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT COALESCE(annotator, 'NULL'), ' | ' ORDER BY COALESCE(annotator, 'NULL')) as annotator_list,
    MIN(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as first_created,
    MAX(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_created
FROM annotations
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, video_id, sentence_no
LIMIT 30;

