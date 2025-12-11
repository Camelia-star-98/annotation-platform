-- ========================================
-- 深度分析：38条两表都空的记录
-- ========================================

-- 📋 目标：尝试从各种渠道找到这38条记录的 annotator

-- 1️⃣ 列出所有38条记录的详细信息
SELECT 
    '第1步：查看所有38条记录' as step,
    ra.video_id,
    ra.sentence_no,
    ra.rejection_reason,
    ra.rejected_at,
    a.status as annotations_status,
    a.created_at as annotation_created_at,
    a.updated_at as annotation_updated_at
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE (ra.annotator IS NULL OR ra.annotator = '')
  AND (a.annotator IS NULL OR a.annotator = '')
ORDER BY ra.rejected_at DESC;

-- 2️⃣ 按视频分组统计
SELECT 
    '第2步：按视频分组' as step,
    ra.video_id,
    COUNT(*) as empty_count,
    MIN(ra.sentence_no) as min_sentence,
    MAX(ra.sentence_no) as max_sentence,
    MIN(ra.rejected_at) as earliest_reject,
    MAX(ra.rejected_at) as latest_reject
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE (ra.annotator IS NULL OR ra.annotator = '')
  AND (a.annotator IS NULL OR a.annotator = '')
GROUP BY ra.video_id
ORDER BY empty_count DESC;

-- 3️⃣ 检查这些视频的其他句子是否有 annotator
SELECT 
    '第3步：查找同视频其他句子的annotator' as step,
    problematic.video_id,
    problematic.empty_sentences,
    other_annotations.annotator as possible_annotator,
    COUNT(DISTINCT other_annotations.sentence_no) as sentences_by_this_annotator
FROM (
    -- 有问题的视频列表
    SELECT DISTINCT ra.video_id, COUNT(*) as empty_sentences
    FROM rejected_annotations ra
    LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND (a.annotator IS NULL OR a.annotator = '')
    GROUP BY ra.video_id
) problematic
LEFT JOIN annotations other_annotations 
    ON problematic.video_id = other_annotations.video_id
    AND other_annotations.annotator IS NOT NULL 
    AND other_annotations.annotator != ''
GROUP BY problematic.video_id, problematic.empty_sentences, other_annotations.annotator
ORDER BY problematic.video_id, sentences_by_this_annotator DESC;

-- 4️⃣ 查找被打回记录（rejected_annotations）中同视频的其他记录
SELECT 
    '第4步：从rejected_annotations中找线索' as step,
    problematic.video_id,
    other_rejected.annotator as possible_annotator,
    COUNT(*) as rejected_by_this_annotator
FROM (
    -- 有问题的视频列表
    SELECT DISTINCT ra.video_id
    FROM rejected_annotations ra
    LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND (a.annotator IS NULL OR a.annotator = '')
) problematic
LEFT JOIN rejected_annotations other_rejected
    ON problematic.video_id = other_rejected.video_id
    AND other_rejected.annotator IS NOT NULL 
    AND other_rejected.annotator != ''
GROUP BY problematic.video_id, other_rejected.annotator
ORDER BY problematic.video_id, rejected_by_this_annotator DESC;

-- 5️⃣ 特别关注郭其其的6条记录
SELECT 
    '第5步：郭其其的6条记录详情' as step,
    ra.video_id,
    ra.sentence_no,
    ra.rejection_reason,
    ra.rejected_at,
    a.status,
    a.annotator as annotations_annotator,
    a.created_at,
    a.updated_at
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.video_id = '第七批第一次改写_语文-01.xlsx'
  AND ra.sentence_no IN (9, 16, 26, 27, 30, 32)
ORDER BY ra.sentence_no;

-- 6️⃣ 查看郭其其视频的其他句子
SELECT 
    '第6步：郭其其视频的其他句子' as step,
    sentence_no,
    annotator,
    status,
    created_at
FROM annotations
WHERE video_id = '第七批第一次改写_语文-01.xlsx'
  AND annotator IS NOT NULL 
  AND annotator != ''
ORDER BY sentence_no;

