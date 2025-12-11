-- 🎯 第一步：检查 rejected_annotations 表中是否有标注人为空的问题

WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '📊 rejected_annotations 表统计' AS "类别",
  COUNT(*) AS "总记录数",
  COUNT(*) FILTER (WHERE is_resubmitted = false) AS "未重新提交",
  COUNT(*) FILTER (WHERE annotator IS NULL OR annotator = '') AS "❌标注人为空",
  COUNT(*) FILTER (WHERE annotator IS NOT NULL AND annotator != '') AS "✅有标注人"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id;

-- 如果上面显示"标注人为空" > 0，继续运行下面的查询查看详情：

WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '详细记录（标注人为空）' AS "类别",
  ra.sentence_no AS "句子号",
  COALESCE(ra.annotator, '❌(空)') AS "标注人",
  COALESCE(ra.inspector, '(空)') AS "质检人",
  ra.is_resubmitted AS "是否重新提交",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
WHERE ra.annotator IS NULL OR ra.annotator = ''
ORDER BY ra.rejected_at DESC
LIMIT 10;

