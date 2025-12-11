-- ========================================
-- 重新检查郭其其的情况
-- ========================================

-- 查询1：郭其其视频是否有重复记录？
SELECT 
    '郭其其_重复检查' as report_section,
    video_id,
    sentence_no,
    COUNT(*) as record_count,
    STRING_AGG(id, ' | ') as all_ids,
    STRING_AGG(COALESCE(annotator, 'NULL'), ' | ') as all_annotators
FROM annotations
WHERE video_id = 'upload_1765171740803'
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1
ORDER BY sentence_no
LIMIT 10;

-- 查询2：郭其其视频的所有记录详情（前10条）
SELECT 
    '郭其其_详细记录' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no, created_at
LIMIT 20;

-- 查询3：郭其其视频有多少条记录？annotator 分布如何？
SELECT 
    '郭其其_记录统计' as report_section,
    COUNT(*) as total_records,
    COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as empty_annotator,
    COUNT(CASE WHEN annotator = '郭其其' THEN 1 END) as guoqiqi_annotator,
    COUNT(CASE WHEN annotator IS NOT NULL AND annotator != '' AND annotator != '郭其其' THEN 1 END) as other_annotator
FROM annotations
WHERE video_id = 'upload_1765171740803';

-- 查询4：那 2969 条空 annotator 记录的分布
SELECT 
    '空annotator记录分析' as report_section,
    CASE 
        WHEN duplicate_count > 1 THEN '有重复（都是空）'
        WHEN duplicate_count = 1 THEN '唯一记录（空）'
        ELSE '其他'
    END as record_type,
    COUNT(*) as count,
    SUM(duplicate_count) as total_records
FROM (
    SELECT 
        a.id,
        a.video_id,
        a.sentence_no,
        (SELECT COUNT(*) 
         FROM annotations a2 
         WHERE a2.video_id = a.video_id 
           AND a2.sentence_no = a.sentence_no) as duplicate_count
    FROM annotations a
    WHERE a.annotator IS NULL OR a.annotator = ''
) empty_records
GROUP BY 
    CASE 
        WHEN duplicate_count > 1 THEN '有重复（都是空）'
        WHEN duplicate_count = 1 THEN '唯一记录（空）'
        ELSE '其他'
    END;

