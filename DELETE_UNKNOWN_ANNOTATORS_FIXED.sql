-- ============================================
-- 删除 annotator = 'unknown' 的数据（修正版）
-- ============================================

-- 步骤1: 先查看要删除的数据量（安全检查）
SELECT 
  video_id,
  COUNT(*) as count_to_delete
FROM annotations
WHERE annotator = 'unknown' OR annotator IS NULL OR annotator = ''
GROUP BY video_id
ORDER BY video_id;

-- 步骤2: 查看总数
SELECT COUNT(*) as total_to_delete
FROM annotations
WHERE annotator = 'unknown' OR annotator IS NULL OR annotator = '';

-- 步骤3: 如果确认要删除，执行下面的删除语句
-- DELETE FROM annotations
-- WHERE annotator = 'unknown' OR annotator IS NULL OR annotator = '';

-- 步骤4: 删除后验证结果
-- SELECT 
--   v.name,
--   a.annotator,
--   COUNT(*) as total,
--   SUM(CASE WHEN a.review_status = true THEN 1 ELSE 0 END) as reviewed,
--   MAX(a.reviewer) as reviewer
-- FROM videos v
-- JOIN annotations a ON v.id = a.video_id
-- WHERE v.name IN (
--   '1104-数学-1.mp4',
--   '1104-数学-2.mp4',
--   '1104-物理-1.mp4',
--   '1104-物理-2.mp4',
--   '1104-英语-1.mp4',
--   '1104-英语-2.mp4',
--   '1104-语文-1.mp4'
-- )
-- GROUP BY v.name, a.annotator
-- ORDER BY v.name;
