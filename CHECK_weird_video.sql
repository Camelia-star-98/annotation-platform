-- ========================================
-- 检查异常视频 annotation_only_1764589430486
-- ========================================

-- 查询1：这个视频的所有记录（按句子和创建时间排序）
SELECT 
    '异常视频_完整记录' as report_section,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS.MS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS.MS') as updated_time,
    id
FROM annotations
WHERE video_id = 'annotation_only_1764589430486'
ORDER BY sentence_no, created_at
LIMIT 50;

-- 查询2：统计这个视频的情况
SELECT 
    '异常视频_统计' as report_section,
    COUNT(*) as total_records,
    COUNT(DISTINCT sentence_no) as unique_sentences,
    COUNT(DISTINCT annotator) as unique_annotators,
    STRING_AGG(DISTINCT annotator, ', ' ORDER BY annotator) as all_annotators
FROM annotations
WHERE video_id = 'annotation_only_1764589430486';

-- 查询3：每个 annotator 提交了多少条
SELECT 
    '异常视频_按annotator统计' as report_section,
    annotator,
    COUNT(*) as record_count,
    MIN(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as first_created,
    MAX(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_created
FROM annotations
WHERE video_id = 'annotation_only_1764589430486'
GROUP BY annotator
ORDER BY first_created;

-- 查询4：检查是否还有其他视频也有类似问题（多个不同的annotator标注了同一句子）
SELECT 
    '其他类似问题视频' as report_section,
    video_id,
    COUNT(DISTINCT sentence_no) as sentences_with_duplicates,
    COUNT(*) as total_duplicate_records,
    STRING_AGG(DISTINCT annotator, ' | ' ORDER BY annotator) as annotator_list
FROM annotations a
WHERE EXISTS (
    SELECT 1
    FROM annotations a2
    WHERE a2.video_id = a.video_id
      AND a2.sentence_no = a.sentence_no
      AND a2.id != a.id
)
GROUP BY video_id
HAVING COUNT(DISTINCT annotator) >= 3
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 检查异常视频 annotation_only_1764589430486
-- ========================================

-- 查询1：这个视频的所有记录（按句子和创建时间排序）
SELECT 
    '异常视频_完整记录' as report_section,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS.MS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS.MS') as updated_time,
    id
FROM annotations
WHERE video_id = 'annotation_only_1764589430486'
ORDER BY sentence_no, created_at
LIMIT 50;

-- 查询2：统计这个视频的情况
SELECT 
    '异常视频_统计' as report_section,
    COUNT(*) as total_records,
    COUNT(DISTINCT sentence_no) as unique_sentences,
    COUNT(DISTINCT annotator) as unique_annotators,
    STRING_AGG(DISTINCT annotator, ', ' ORDER BY annotator) as all_annotators
FROM annotations
WHERE video_id = 'annotation_only_1764589430486';

-- 查询3：每个 annotator 提交了多少条
SELECT 
    '异常视频_按annotator统计' as report_section,
    annotator,
    COUNT(*) as record_count,
    MIN(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as first_created,
    MAX(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_created
FROM annotations
WHERE video_id = 'annotation_only_1764589430486'
GROUP BY annotator
ORDER BY first_created;

-- 查询4：检查是否还有其他视频也有类似问题（多个不同的annotator标注了同一句子）
SELECT 
    '其他类似问题视频' as report_section,
    video_id,
    COUNT(DISTINCT sentence_no) as sentences_with_duplicates,
    COUNT(*) as total_duplicate_records,
    STRING_AGG(DISTINCT annotator, ' | ' ORDER BY annotator) as annotator_list
FROM annotations a
WHERE EXISTS (
    SELECT 1
    FROM annotations a2
    WHERE a2.video_id = a.video_id
      AND a2.sentence_no = a.sentence_no
      AND a2.id != a.id
)
GROUP BY video_id
HAVING COUNT(DISTINCT annotator) >= 3
ORDER BY COUNT(*) DESC
LIMIT 10;

