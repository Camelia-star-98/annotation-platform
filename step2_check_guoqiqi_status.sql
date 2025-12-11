-- 🎯 第二步：检查郭其其的质检状态

WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '郭其其的质检状态分布' AS "类别",
  CASE 
    WHEN a.inspector IS NULL OR a.inspector = '' THEN '⏳ 待质检'
    WHEN a.is_qualified = true THEN '✅ 通过'
    WHEN a.is_qualified = false THEN '❌ 不通过'
    ELSE '❓ 其他'
  END AS "质检状态",
  COUNT(*) AS "数量",
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) || '%' AS "百分比"
FROM annotations a
JOIN video_data v ON a.video_id = v.id
WHERE a.annotator = '郭其其'
GROUP BY 
  CASE 
    WHEN a.inspector IS NULL OR a.inspector = '' THEN '⏳ 待质检'
    WHEN a.is_qualified = true THEN '✅ 通过'
    WHEN a.is_qualified = false THEN '❌ 不通过'
    ELSE '❓ 其他'
  END
ORDER BY COUNT(*) DESC;

-- 郭其其被打回的详细记录
WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '郭其其在 rejected_annotations 中的记录' AS "类别",
  COUNT(*) AS "被打回总数",
  COUNT(*) FILTER (WHERE ra.is_resubmitted = false) AS "未重新提交"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
WHERE ra.annotator = '郭其其';

