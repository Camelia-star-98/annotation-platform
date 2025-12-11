-- 诊断郭其其的视频数据问题
-- 问题：视频有标注人，但在被打回重标里没有标注人；质检状态是待质检却出现在被打回列表

-- 1. 查找视频ID（根据文件名）
WITH target_video AS (
  SELECT 
    id,
    name,
    annotation_file_name,
    subject,
    total_sentences
  FROM videos
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
  LIMIT 1
)
SELECT 
  '=== 视频基本信息 ===' AS section,
  tv.id AS video_id,
  tv.name AS video_name,
  tv.annotation_file_name,
  tv.subject,
  tv.total_sentences
FROM target_video tv

UNION ALL

-- 2. 检查 annotations 表中的标注数据
SELECT 
  '=== annotations 表数据统计 ===' AS section,
  COUNT(*)::text AS total_count,
  COUNT(DISTINCT annotator) FILTER (WHERE annotator IS NOT NULL AND annotator != '')::text AS annotator_count,
  COUNT(*) FILTER (WHERE status = true)::text AS completed_count,
  COUNT(*) FILTER (WHERE inspector IS NOT NULL AND inspector != '')::text AS inspected_count,
  COUNT(*) FILTER (WHERE is_qualified = true)::text AS passed_count,
  COUNT(*) FILTER (WHERE is_qualified = false)::text AS rejected_count
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id

UNION ALL

-- 3. 查看标注人信息
SELECT 
  '=== 标注人列表 ===' AS section,
  COALESCE(a.annotator, '(空)')::text AS annotator,
  COUNT(*)::text AS annotation_count,
  COUNT(*) FILTER (WHERE a.status = true)::text AS completed_count,
  COUNT(*) FILTER (WHERE a.inspector IS NOT NULL AND a.inspector != '')::text AS inspected_count,
  COUNT(*) FILTER (WHERE a.is_qualified = true)::text AS passed_count,
  COUNT(*) FILTER (WHERE a.is_qualified = false)::text AS rejected_count
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id
GROUP BY a.annotator

UNION ALL

-- 4. 检查 rejected_annotations 表
SELECT 
  '=== rejected_annotations 表数据 ===' AS section,
  COUNT(*)::text AS total_rejected,
  COUNT(*) FILTER (WHERE is_resubmitted = false)::text AS not_resubmitted,
  COUNT(DISTINCT annotator) FILTER (WHERE annotator IS NOT NULL AND annotator != '')::text AS annotator_count,
  string_agg(DISTINCT COALESCE(annotator, '(空)'), ', ')::text AS annotators,
  string_agg(DISTINCT COALESCE(inspector, '(空)'), ', ')::text AS inspectors
FROM target_video tv
JOIN rejected_annotations ra ON ra.video_id = tv.id;

-- 5. 详细查看 rejected_annotations 表前10条记录
SELECT 
  '=== rejected_annotations 详细记录（前10条）===' AS info,
  ra.id,
  ra.annotation_id,
  ra.sentence_no,
  COALESCE(ra.annotator, '(空)') AS annotator,
  COALESCE(ra.inspector, '(空)') AS inspector,
  ra.is_resubmitted,
  ra.rejected_at,
  ra.resubmitted_at
FROM target_video tv
JOIN rejected_annotations ra ON ra.video_id = tv.id
ORDER BY ra.rejected_at DESC
LIMIT 10;

-- 6. 检查 annotations 表中质检状态为 false 的记录
SELECT 
  '=== annotations 表中 is_qualified = false 的记录 ===' AS info,
  a.id,
  a.sentence_no,
  COALESCE(a.annotator, '(空)') AS annotator,
  COALESCE(a.inspector, '(空)') AS inspector,
  a.is_qualified,
  a.status,
  a.updated_at
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id
WHERE a.is_qualified = false
ORDER BY a.updated_at DESC
LIMIT 10;

-- 7. 检查是否有标注人为空但有质检数据的异常情况
SELECT 
  '=== 异常数据：标注人为空但有质检信息 ===' AS info,
  a.id,
  a.sentence_no,
  COALESCE(a.annotator, '(空)') AS annotator,
  COALESCE(a.inspector, '(空)') AS inspector,
  a.is_qualified,
  a.status,
  a.updated_at
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id
WHERE (a.annotator IS NULL OR a.annotator = '')
  AND (a.inspector IS NOT NULL AND a.inspector != '')
ORDER BY a.updated_at DESC
LIMIT 10;

-- 8. 统计该视频的质检状态分布
SELECT 
  '=== 质检状态分布（郭其其的标注）===' AS info,
  CASE 
    WHEN inspector IS NULL OR inspector = '' THEN '待质检'
    WHEN is_qualified = true THEN '通过'
    WHEN is_qualified = false THEN '不通过'
    ELSE '其他'
  END AS inspection_status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)::text || '%' AS percentage
FROM target_video tv
JOIN annotations a ON a.video_id = tv.id
WHERE a.annotator = '郭其其'
GROUP BY 
  CASE 
    WHEN inspector IS NULL OR inspector = '' THEN '待质检'
    WHEN is_qualified = true THEN '通过'
    WHEN is_qualified = false THEN '不通过'
    ELSE '其他'
  END
ORDER BY count DESC;

