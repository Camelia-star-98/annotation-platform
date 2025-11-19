-- 检查已复检数据的分布
SELECT 
  video_id,
  COUNT(*) as total_count,
  SUM(CASE WHEN review_status = true THEN 1 ELSE 0 END) as reviewed_count,
  SUM(CASE WHEN review_status = false THEN 1 ELSE 0 END) as rejected_count,
  SUM(CASE WHEN review_status IS NULL THEN 1 ELSE 0 END) as pending_count
FROM annotations
GROUP BY video_id
ORDER BY video_id;

-- 检查视频列表
SELECT id, name, subject, is_completed FROM videos ORDER BY name;
