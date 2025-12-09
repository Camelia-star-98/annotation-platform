-- 检查语文02.mp4的句子统计差异

WITH video_info AS (
  SELECT id, name, total_sentences
  FROM videos
  WHERE name = '语文02.mp4'
),
annotation_stats AS (
  SELECT 
    v.id,
    v.name AS 视频名称,
    v.total_sentences AS 视频表总句数,
    
    -- 1. 所有标注数据（不过滤）
    COUNT(*) AS 标注数据总条数,
    COUNT(DISTINCT a.sentence_id) AS 不同句子总数,
    
    -- 2. 有标注人的数据（质检页面统计）
    COUNT(CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' THEN 1 END) AS 有标注人的条数,
    COUNT(DISTINCT CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' THEN a.sentence_id END) AS 有标注人的不同句子数,
    
    -- 3. status=true的数据（所有已标注任务统计）
    COUNT(CASE WHEN a.status = true THEN 1 END) AS status为true的条数,
    COUNT(DISTINCT CASE WHEN a.status = true THEN a.sentence_id END) AS status为true的不同句子数,
    
    -- 4. 既有标注人又status=true
    COUNT(CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' AND a.status = true THEN 1 END) AS 同时满足两个条件的条数,
    COUNT(DISTINCT CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' AND a.status = true THEN a.sentence_id END) AS 同时满足两个条件的不同句子数,
    
    -- 5. 有标注人但status不为true
    COUNT(CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' AND (a.status IS NULL OR a.status = false) THEN 1 END) AS 有标注人但未完成的条数,
    COUNT(DISTINCT CASE WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' AND (a.status IS NULL OR a.status = false) THEN a.sentence_id END) AS 有标注人但未完成的不同句子数
    
  FROM video_info v
  LEFT JOIN annotations a ON a.video_id = v.id
  GROUP BY v.id, v.name, v.total_sentences
)
SELECT * FROM annotation_stats;
