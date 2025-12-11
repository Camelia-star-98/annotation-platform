-- 🔍 诊断郭其其视频数据的简化版SQL
-- 直接复制到 Supabase SQL Editor 运行

-- ============================================
-- 1️⃣ 找到视频并获取基本信息
-- ============================================
SELECT 
  '1️⃣ 视频信息' AS "步骤",
  id AS "视频ID",
  name AS "视频名称",
  annotation_file_name AS "标注文件名",
  total_sentences AS "总句数"
FROM videos
WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
LIMIT 1;

-- ============================================
-- 2️⃣ annotations 表数据统计
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '2️⃣ annotations表统计' AS "步骤",
  COUNT(*) AS "总记录数",
  COUNT(*) FILTER (WHERE annotator IS NOT NULL AND annotator != '') AS "有标注人",
  COUNT(*) FILTER (WHERE status = true) AS "已完成",
  COUNT(*) FILTER (WHERE inspector IS NULL OR inspector = '') AS "待质检",
  COUNT(*) FILTER (WHERE is_qualified = true) AS "质检通过",
  COUNT(*) FILTER (WHERE is_qualified = false) AS "质检不通过"
FROM annotations a
JOIN video_data v ON a.video_id = v.id;

-- ============================================
-- 3️⃣ 按标注人统计（包括郭其其）
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '3️⃣ 标注人统计' AS "步骤",
  COALESCE(a.annotator, '(空)') AS "标注人",
  COUNT(*) AS "总数",
  COUNT(*) FILTER (WHERE a.status = true) AS "已完成",
  COUNT(*) FILTER (WHERE a.inspector IS NULL OR a.inspector = '') AS "待质检",
  COUNT(*) FILTER (WHERE a.is_qualified = true) AS "通过",
  COUNT(*) FILTER (WHERE a.is_qualified = false) AS "不通过"
FROM annotations a
JOIN video_data v ON a.video_id = v.id
GROUP BY a.annotator
ORDER BY COUNT(*) DESC;

-- ============================================
-- 4️⃣ rejected_annotations 表统计
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '4️⃣ rejected_annotations统计' AS "步骤",
  COUNT(*) AS "总记录数",
  COUNT(*) FILTER (WHERE is_resubmitted = false) AS "未重新提交",
  COUNT(*) FILTER (WHERE annotator IS NULL OR annotator = '') AS "❌标注人为空",
  COUNT(*) FILTER (WHERE annotator IS NOT NULL AND annotator != '') AS "✅有标注人"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id;

-- ============================================
-- 5️⃣ rejected_annotations 按标注人统计
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '5️⃣ 被打回标注人分布' AS "步骤",
  COALESCE(ra.annotator, '❌(空)') AS "标注人",
  COUNT(*) AS "总被打回数",
  COUNT(*) FILTER (WHERE ra.is_resubmitted = false) AS "未重新提交"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
GROUP BY ra.annotator
ORDER BY COUNT(*) DESC;

-- ============================================
-- 6️⃣ rejected_annotations 详细记录（前20条）
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '6️⃣ 被打回详细记录' AS "步骤",
  ra.sentence_no AS "句子号",
  COALESCE(ra.annotator, '❌(空)') AS "标注人",
  COALESCE(ra.inspector, '(空)') AS "质检人",
  ra.is_resubmitted AS "是否重新提交",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
ORDER BY ra.rejected_at DESC
LIMIT 20;

-- ============================================
-- 7️⃣ 郭其其的质检状态分布
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '7️⃣ 郭其其质检状态' AS "步骤",
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

-- ============================================
-- 8️⃣ 问题诊断：郭其其在 annotations 中的质检不通过记录
-- ============================================
WITH video_data AS (
  SELECT id FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' LIMIT 1
)
SELECT 
  '8️⃣ 郭其其被质检不通过的记录' AS "步骤",
  a.sentence_no AS "句子号",
  a.annotator AS "标注人",
  a.inspector AS "质检人",
  a.is_qualified AS "是否合格",
  to_char(a.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS "更新时间"
FROM annotations a
JOIN video_data v ON a.video_id = v.id
WHERE a.annotator = '郭其其' AND a.is_qualified = false
ORDER BY a.updated_at DESC
LIMIT 10;

-- ============================================
-- 🎯 诊断结论
-- ============================================
SELECT 
  '🎯 诊断结论' AS "结论",
  '如果第4步显示有"标注人为空"的记录，这就是为什么在被打回重标列表中看不到标注人的原因' AS "说明1",
  '如果第7步显示郭其其有"待质检"的记录，但第5步显示她有被打回的记录，说明视频同时出现在两个列表中' AS "说明2";

