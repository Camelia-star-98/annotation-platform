-- ========================================
-- 深度诊断：检查 annotator 字段的真实状态
-- ========================================

-- 🔍 诊断1：郭其其视频的详细字段检查
SELECT 
    '诊断1_字段详细检查' as report_section,
    video_id,
    sentence_no,
    annotator,
    CASE 
        WHEN annotator IS NULL THEN 'IS NULL'
        WHEN annotator = '' THEN 'EMPTY STRING'
        WHEN annotator = ' ' THEN 'SINGLE SPACE'
        WHEN TRIM(annotator) = '' THEN 'WHITESPACE ONLY'
        ELSE 'HAS VALUE'
    END as annotator_type,
    LENGTH(annotator) as annotator_length,
    LENGTH(TRIM(annotator)) as annotator_trimmed_length,
    rejected_at,
    rejection_reason
FROM rejected_annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no;

-- 🔍 诊断2：所有 rejected_annotations 中 annotator 有问题的记录
SELECT 
    '诊断2_所有问题annotator' as report_section,
    video_id,
    sentence_no,
    annotator,
    CASE 
        WHEN annotator IS NULL THEN 'IS NULL'
        WHEN annotator = '' THEN 'EMPTY STRING'
        WHEN annotator = ' ' THEN 'SINGLE SPACE'
        WHEN TRIM(annotator) = '' THEN 'WHITESPACE ONLY'
        ELSE 'HAS VALUE'
    END as annotator_type,
    LENGTH(annotator) as annotator_length,
    rejected_at
FROM rejected_annotations
WHERE annotator IS NULL 
   OR annotator = '' 
   OR TRIM(annotator) = ''
ORDER BY video_id, sentence_no;

-- 🔍 诊断3：所有 rejected_annotations 的 annotator 统计
SELECT 
    '诊断3_annotator统计' as report_section,
    CASE 
        WHEN annotator IS NULL THEN 'NULL值'
        WHEN annotator = '' THEN '空字符串'
        WHEN TRIM(annotator) = '' THEN '仅空格'
        ELSE '有内容'
    END as annotator_category,
    COUNT(*) as count,
    STRING_AGG(DISTINCT video_id, ', ') as affected_videos
FROM rejected_annotations
GROUP BY 
    CASE 
        WHEN annotator IS NULL THEN 'NULL值'
        WHEN annotator = '' THEN '空字符串'
        WHEN TRIM(annotator) = '' THEN '仅空格'
        ELSE '有内容'
    END
ORDER BY count DESC;

-- 🔍 诊断4：检查 annotations 表中郭其其视频的情况
SELECT 
    '诊断4_annotations表郭其其视频' as report_section,
    video_id,
    sentence_no,
    annotator,
    CASE 
        WHEN annotator IS NULL THEN 'IS NULL'
        WHEN annotator = '' THEN 'EMPTY STRING'
        WHEN TRIM(annotator) = '' THEN 'WHITESPACE ONLY'
        ELSE 'HAS VALUE'
    END as annotator_type,
    status,
    created_at
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no;

-- 🔍 诊断5：对比两个表中相同句子的 annotator
SELECT 
    '诊断5_两表annotator对比' as report_section,
    COALESCE(a.video_id, ra.video_id) as video_id,
    COALESCE(a.sentence_no, ra.sentence_no) as sentence_no,
    a.annotator as annotations_annotator,
    ra.annotator as rejected_annotator,
    CASE 
        WHEN a.annotator IS NULL THEN 'annotations_NULL'
        WHEN a.annotator = '' THEN 'annotations_EMPTY'
        WHEN TRIM(a.annotator) = '' THEN 'annotations_SPACE'
        ELSE 'annotations_HAS_VALUE'
    END as annotations_status,
    CASE 
        WHEN ra.annotator IS NULL THEN 'rejected_NULL'
        WHEN ra.annotator = '' THEN 'rejected_EMPTY'
        WHEN TRIM(ra.annotator) = '' THEN 'rejected_SPACE'
        ELSE 'rejected_HAS_VALUE'
    END as rejected_status
FROM annotations a
FULL OUTER JOIN rejected_annotations ra 
    ON a.video_id = ra.video_id AND a.sentence_no = ra.sentence_no
WHERE a.video_id = 'upload_1765171740803' OR ra.video_id = 'upload_1765171740803'
ORDER BY sentence_no;
