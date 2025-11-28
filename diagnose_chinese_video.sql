-- 查找第5批的所有视频及其复检状态
-- 用于诊断为什么语文视频没有出现在待复检列表中

-- 1. 查询第5批所有视频的基本信息
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  v.created_at,
  COUNT(DISTINCT a.annotator) FILTER (WHERE a.annotator IS NOT NULL AND a.annotator != '' AND a.annotator != 'unknown') as annotator_count,
  COUNT(a.id) as total_annotations,
  COUNT(a.id) FILTER (WHERE a.review_status = true) as reviewed_count,
  COUNT(a.id) FILTER (WHERE a.review_status IS NULL OR a.review_status = false) as pending_count,
  COUNT(a.id) FILTER (WHERE a.human_annotated_text IS NOT NULL AND a.human_annotated_text != '') as has_human_text_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%第5批%'
GROUP BY v.id, v.name, v.subject, v.is_completed, v.created_at
ORDER BY v.name;

-- 2. 查询第5批语文视频的详细标注数据
SELECT 
  v.id as video_id,
  v.name as video_name,
  v.is_completed,
  a.annotator,
  COUNT(a.id) as total,
  COUNT(a.id) FILTER (WHERE a.review_status = true) as reviewed,
  COUNT(a.id) FILTER (WHERE a.review_status IS NULL OR a.review_status = false) as pending,
  COUNT(a.id) FILTER (WHERE a.human_annotated_text IS NOT NULL AND a.human_annotated_text != '') as has_text
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%第5批%' 
  AND (v.name LIKE '%语文%' OR v.subject LIKE '%语文%')
GROUP BY v.id, v.name, v.is_completed, a.annotator
ORDER BY v.name, a.annotator;

-- 3. 查询所有语文视频（不限第5批）
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  v.created_at,
  COUNT(DISTINCT a.annotator) FILTER (WHERE a.annotator IS NOT NULL AND a.annotator != '' AND a.annotator != 'unknown') as annotator_count,
  COUNT(a.id) FILTER (WHERE a.review_status IS NULL OR a.review_status = false) as pending_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%语文%' OR v.subject LIKE '%语文%'
GROUP BY v.id, v.name, v.subject, v.is_completed, v.created_at
ORDER BY v.created_at DESC;

