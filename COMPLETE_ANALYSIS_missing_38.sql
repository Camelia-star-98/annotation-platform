-- ========================================
-- 完整分析：38条缺失 annotator 的记录
-- ========================================

-- 📊 查询2：按视频分组统计（看看哪些视频问题最多）
SELECT 
    '查询2_按视频分组' as report_section,
    problematic.video_id,
    COUNT(*) as missing_count,
    STRING_AGG(CAST(problematic.sentence_no AS TEXT), ', ' ORDER BY problematic.sentence_no) as sentence_numbers
FROM (
    SELECT DISTINCT ra.video_id, ra.sentence_no
    FROM rejected_annotations ra
    LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND (a.annotator IS NULL OR a.annotator = '')
) problematic
GROUP BY problematic.video_id
ORDER BY missing_count DESC, problematic.video_id;

-- 🔍 查询3：【最关键】从同视频其他句子找 annotator
SELECT 
    '查询3_同视频其他句子的标注人' as report_section,
    problematic.video_id,
    a.annotator,
    COUNT(*) as sentence_count,
    STRING_AGG(CAST(a.sentence_no AS TEXT), ', ' ORDER BY a.sentence_no) as sample_sentences
FROM (
    SELECT DISTINCT ra.video_id
    FROM rejected_annotations ra
    LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND (a.annotator IS NULL OR a.annotator = '')
) problematic
JOIN annotations a ON problematic.video_id = a.video_id
WHERE a.annotator IS NOT NULL 
  AND a.annotator != ''
GROUP BY problematic.video_id, a.annotator
ORDER BY problematic.video_id, sentence_count DESC;

-- 🎯 查询4：从 rejected_annotations 找同视频其他记录
SELECT 
    '查询4_同视频被打回记录' as report_section,
    problematic.video_id,
    ra2.annotator as possible_annotator,
    COUNT(*) as rejected_by_this_annotator
FROM (
    SELECT DISTINCT ra.video_id
    FROM rejected_annotations ra
    LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND (a.annotator IS NULL OR a.annotator = '')
) problematic
JOIN rejected_annotations ra2 ON problematic.video_id = ra2.video_id
WHERE ra2.annotator IS NOT NULL 
  AND ra2.annotator != ''
GROUP BY problematic.video_id, ra2.annotator
ORDER BY problematic.video_id, rejected_by_this_annotator DESC;

-- 📋 查询5：郭其其的6条记录详情
SELECT 
    '查询5_郭其其记录详情' as report_section,
    ra.video_id,
    ra.sentence_no,
    ra.annotator as ra_annotator,
    ra.rejection_reason,
    ra.rejected_at,
    a.annotator as a_annotator,
    a.status,
    a.created_at,
    a.updated_at
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.video_id = '第七批第一次改写_语文-01.xlsx'
  AND ra.sentence_no IN (9, 16, 26, 27, 30, 32)
ORDER BY ra.sentence_no;

-- 🔎 查询6：郭其其视频的其他句子（有annotator的）
SELECT 
    '查询6_郭其其视频其他句子' as report_section,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = '第七批第一次改写_语文-01.xlsx'
  AND annotator IS NOT NULL 
  AND annotator != ''
ORDER BY sentence_no;

