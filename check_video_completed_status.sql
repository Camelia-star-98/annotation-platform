-- 检查视频的 is_completed 状态对统计的影响

-- 1. 查看所有视频的完成状态
SELECT 
  is_completed,
  COUNT(*) as 视频数量
FROM videos
GROUP BY is_completed;

-- 2. 对比完成和未完成视频的待质检数据量
SELECT 
  v.is_completed,
  COUNT(DISTINCT CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)) as 去重后总数,
  COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检数量,
  COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as 已质检数量
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''
GROUP BY v.is_completed;

-- 3. 只统计未完成视频（模拟页面逻辑）
SELECT 
  '未完成视频统计' as 类别,
  COUNT(DISTINCT CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)) as 去重后总数,
  COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检数量,
  COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as 已质检数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE (v.is_completed IS NULL OR v.is_completed = false)
  AND a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != '';

-- 4. 查看已完成视频的列表和数据量
SELECT 
  v.id,
  v.name,
  v.is_completed,
  COUNT(*) as 标注数量,
  COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检,
  COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as 已质检
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.is_completed = true
  AND a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''
GROUP BY v.id, v.name, v.is_completed
ORDER BY 标注数量 DESC;

