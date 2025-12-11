-- ========================================
-- 检查是否还有缺失标注人的数据
-- ========================================

-- 1️⃣ 检查 rejected_annotations 中是否还有空的 annotator
SELECT 
    '❌ rejected_annotations 中仍有空 annotator' as issue,
    COUNT(*) as count,
    COUNT(DISTINCT video_id) as affected_videos
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '';

-- 2️⃣ 查看具体有哪些记录还是空的
SELECT 
    video_id,
    sentence_no,
    annotator,
    rejection_reason,
    rejected_at
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = ''
ORDER BY rejected_at DESC
LIMIT 20;

-- 3️⃣ 检查这些空记录在 annotations 表中是否有对应的 annotator
SELECT 
    ra.video_id,
    ra.sentence_no,
    ra.annotator as rejected_annotator,
    a.annotator as annotations_annotator,
    CASE 
        WHEN a.annotator IS NULL OR a.annotator = '' THEN '❌ annotations 表中也是空的'
        ELSE '✅ annotations 表中有数据，可以修复'
    END as status
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.annotator IS NULL OR ra.annotator = ''
LIMIT 20;

-- 4️⃣ 统计两个表中都是空的记录数量
SELECT 
    '⚠️ 两个表中都是空的记录数' as issue,
    COUNT(*) as count
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE (ra.annotator IS NULL OR ra.annotator = '')
  AND (a.annotator IS NULL OR a.annotator = '');

-- 5️⃣ 检查郭其其的具体情况
SELECT 
    '郭其其的记录检查' as check_type,
    ra.video_id,
    ra.sentence_no,
    ra.annotator as rejected_annotator,
    a.annotator as annotations_annotator,
    ra.rejection_reason
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.video_id = '第七批第一次改写_语文-01.xlsx'
  AND ra.sentence_no IN (9, 16, 26, 27, 30, 32)
ORDER BY ra.sentence_no;

