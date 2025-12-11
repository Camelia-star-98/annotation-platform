-- ===================================================================
-- 测试质检页面的筛选逻辑（抽检逻辑）
-- ===================================================================
-- 
-- 业务规则：
-- 1. 如果视频有质检通过的数据（passedCount > 0）
-- 2. 且没有质检不通过的数据（failedCount = 0）
-- 3. 则该视频应该从质检列表中移除，进入复检流程
-- 4. 即使还有待质检的数据（pendingCount > 0），也应该进入复检
-- 
-- ===================================================================

-- 1. 查看所有视频的质检统计（按视频分组）
WITH video_stats AS (
  SELECT 
    v.id as video_id,
    v.name as video_name,
    v.subject,
    v.is_completed,
    
    -- 去重后的总标注数（按 video_id + sentence_no + annotator 去重）
    COUNT(DISTINCT CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)) as total_annotations,
    
    -- 待质检数量（没有质检人）
    COUNT(DISTINCT CASE 
      WHEN a.inspector IS NULL OR a.inspector = '' 
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as pending_count,
    
    -- 质检通过数量
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = true AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as passed_count,
    
    -- 质检不通过数量
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = false AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as failed_count
    
  FROM videos v
  LEFT JOIN annotations a ON v.id = a.video_id
  WHERE 
    (v.is_completed IS NULL OR v.is_completed = false)  -- 未完成复检的视频
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
  GROUP BY v.id, v.name, v.subject, v.is_completed
)
SELECT 
  video_name,
  subject,
  total_annotations,
  pending_count,
  passed_count,
  failed_count,
  
  -- 🆕 判断是否应该显示在质检列表
  CASE 
    WHEN passed_count > 0 AND failed_count = 0 THEN '❌ 不显示（进入复检）'
    ELSE '✅ 显示在质检列表'
  END as should_show_in_inspection,
  
  -- 说明原因
  CASE 
    WHEN passed_count > 0 AND failed_count = 0 THEN '抽检数据全部通过'
    WHEN failed_count > 0 THEN '有质检不通过数据'
    WHEN passed_count = 0 THEN '还没有质检通过的数据'
    ELSE '其他情况'
  END as reason
  
FROM video_stats
ORDER BY 
  CASE 
    WHEN passed_count > 0 AND failed_count = 0 THEN 1  -- 应该进入复检的排前面
    ELSE 2
  END,
  video_name;

-- 2. 统计应该显示/隐藏的视频数量
WITH video_stats AS (
  SELECT 
    v.id as video_id,
    v.name as video_name,
    
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = true AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as passed_count,
    
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = false AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as failed_count
    
  FROM videos v
  LEFT JOIN annotations a ON v.id = a.video_id
  WHERE 
    (v.is_completed IS NULL OR v.is_completed = false)
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
  GROUP BY v.id, v.name
)
SELECT 
  '📊 统计结果' as 说明,
  COUNT(*) as 总视频数,
  COUNT(CASE WHEN passed_count > 0 AND failed_count = 0 THEN 1 END) as 应该进入复检的视频数,
  COUNT(CASE WHEN NOT (passed_count > 0 AND failed_count = 0) THEN 1 END) as 应该显示在质检列表的视频数
FROM video_stats;

-- 3. 查看具体哪些视频应该进入复检
WITH video_stats AS (
  SELECT 
    v.id as video_id,
    v.name as video_name,
    
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = true AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as passed_count,
    
    COUNT(DISTINCT CASE 
      WHEN a.is_qualified = false AND a.inspector IS NOT NULL AND a.inspector != ''
      THEN CONCAT(a.video_id, '_', a.sentence_no, '_', a.annotator)
    END) as failed_count
    
  FROM videos v
  LEFT JOIN annotations a ON v.id = a.video_id
  WHERE 
    (v.is_completed IS NULL OR v.is_completed = false)
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
    AND a.human_annotated_text IS NOT NULL
    AND a.human_annotated_text != ''
  GROUP BY v.id, v.name
)
SELECT 
  '🎯 应该进入复检的视频' as 说明,
  video_name,
  passed_count as 质检通过数,
  failed_count as 质检不通过数
FROM video_stats
WHERE passed_count > 0 AND failed_count = 0
ORDER BY video_name;

