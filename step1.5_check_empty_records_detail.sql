-- 🔍 查看标注人为空的详细记录

WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '标注人为空的记录详情' AS "说明",
  ra.sentence_no AS "句子号",
  COALESCE(ra.annotator, '❌(空)') AS "标注人",
  COALESCE(ra.inspector, '(空)') AS "质检人",
  ra.is_resubmitted AS "是否重新提交",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
WHERE ra.annotator IS NULL OR ra.annotator = ''
ORDER BY ra.sentence_no;

-- 对比：annotations 表中这些句子的真实标注人是谁？
WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
),
empty_rejected AS (
  SELECT sentence_no
  FROM rejected_annotations ra
  JOIN video_data v ON ra.video_id = v.id
  WHERE ra.annotator IS NULL OR ra.annotator = ''
)
SELECT 
  'annotations表中对应句子的标注人' AS "说明",
  a.sentence_no AS "句子号",
  a.annotator AS "标注人",
  a.inspector AS "质检人",
  a.is_qualified AS "是否合格"
FROM annotations a
JOIN video_data v ON a.video_id = v.id
WHERE a.sentence_no IN (SELECT sentence_no FROM empty_rejected)
ORDER BY a.sentence_no;
