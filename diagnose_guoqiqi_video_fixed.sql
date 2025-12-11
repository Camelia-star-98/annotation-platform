-- 诊断郭其其的视频数据问题
-- 问题：视频有标注人，但在被打回重标里没有标注人；质检状态是待质检却出现在被打回列表

-- ============================================
-- 1. 查找视频基本信息
-- ============================================
SELECT 
  '视频ID' AS 字段,
  id::text AS 值
FROM videos
WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT '视频名称', name FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT '标注文件名', annotation_file_name FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT '科目', subject FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT '总句数', total_sentences::text FROM videos WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx';

-- ============================================
-- 2. annotations 表数据统计
-- ============================================
SELECT 
  '统计项' AS 项目,
  '数量' AS 值
UNION ALL
SELECT 
  '总记录数',
  COUNT(*)::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '有标注人的记录',
  COUNT(*) FILTER (WHERE annotator IS NOT NULL AND annotator != '')::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '已完成的记录',
  COUNT(*) FILTER (WHERE status = true)::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '已质检的记录',
  COUNT(*) FILTER (WHERE inspector IS NOT NULL AND inspector != '')::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '质检通过',
  COUNT(*) FILTER (WHERE is_qualified = true)::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '质检不通过',
  COUNT(*) FILTER (WHERE is_qualified = false)::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '待质检',
  COUNT(*) FILTER (WHERE inspector IS NULL OR inspector = '')::text
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx';

-- ============================================
-- 3. 按标注人统计
-- ============================================
SELECT 
  COALESCE(a.annotator, '(空)') AS 标注人,
  COUNT(*)::text AS 总数,
  COUNT(*) FILTER (WHERE a.status = true)::text AS 已完成,
  COUNT(*) FILTER (WHERE a.inspector IS NULL OR a.inspector = '')::text AS 待质检,
  COUNT(*) FILTER (WHERE a.is_qualified = true)::text AS 质检通过,
  COUNT(*) FILTER (WHERE a.is_qualified = false)::text AS 质检不通过
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
GROUP BY a.annotator
ORDER BY COUNT(*) DESC;

-- ============================================
-- 4. rejected_annotations 表统计
-- ============================================
SELECT 
  '统计项' AS 项目,
  '数量' AS 值
UNION ALL
SELECT 
  '总被打回记录数',
  COUNT(*)::text
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '未重新提交的记录',
  COUNT(*) FILTER (WHERE is_resubmitted = false)::text
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '有标注人的记录',
  COUNT(*) FILTER (WHERE annotator IS NOT NULL AND annotator != '')::text
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
UNION ALL
SELECT 
  '标注人为空的记录',
  COUNT(*) FILTER (WHERE annotator IS NULL OR annotator = '')::text
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx';

-- ============================================
-- 5. rejected_annotations 表中标注人分布
-- ============================================
SELECT 
  COALESCE(ra.annotator, '(空)') AS 标注人,
  COUNT(*)::text AS 总被打回数,
  COUNT(*) FILTER (WHERE ra.is_resubmitted = false)::text AS 未重新提交,
  string_agg(DISTINCT COALESCE(ra.inspector, '(空)'), ', ') AS 质检人列表
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
GROUP BY ra.annotator
ORDER BY COUNT(*) DESC;

-- ============================================
-- 6. rejected_annotations 详细记录（前10条）
-- ============================================
SELECT 
  ra.id,
  ra.sentence_no AS 句子号,
  COALESCE(ra.annotator, '(空)') AS 标注人,
  COALESCE(ra.inspector, '(空)') AS 质检人,
  ra.is_resubmitted AS 是否重新提交,
  ra.rejected_at AS 打回时间,
  ra.resubmitted_at AS 重新提交时间
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
ORDER BY ra.rejected_at DESC
LIMIT 10;

-- ============================================
-- 7. annotations 表中 is_qualified = false 的记录
-- ============================================
SELECT 
  a.id,
  a.sentence_no AS 句子号,
  COALESCE(a.annotator, '(空)') AS 标注人,
  COALESCE(a.inspector, '(空)') AS 质检人,
  a.is_qualified AS 是否合格,
  a.status AS 是否完成,
  a.updated_at AS 更新时间
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
  AND a.is_qualified = false
ORDER BY a.updated_at DESC
LIMIT 10;

-- ============================================
-- 8. 异常数据：标注人为空但有质检信息
-- ============================================
SELECT 
  a.id,
  a.sentence_no AS 句子号,
  COALESCE(a.annotator, '(空)') AS 标注人,
  COALESCE(a.inspector, '(空)') AS 质检人,
  a.is_qualified AS 是否合格,
  a.status AS 是否完成,
  a.updated_at AS 更新时间
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
  AND (a.annotator IS NULL OR a.annotator = '')
  AND (a.inspector IS NOT NULL AND a.inspector != '')
ORDER BY a.updated_at DESC
LIMIT 10;

-- ============================================
-- 9. 郭其其的质检状态分布
-- ============================================
SELECT 
  CASE 
    WHEN a.inspector IS NULL OR a.inspector = '' THEN '待质检'
    WHEN a.is_qualified = true THEN '通过'
    WHEN a.is_qualified = false THEN '不通过'
    ELSE '其他'
  END AS 质检状态,
  COUNT(*) AS 数量,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2)::text || '%' AS 百分比
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.annotation_file_name = '第七批第一次改写_语文-01.xlsx'
  AND a.annotator = '郭其其'
GROUP BY 
  CASE 
    WHEN a.inspector IS NULL OR a.inspector = '' THEN '待质检'
    WHEN a.is_qualified = true THEN '通过'
    WHEN a.is_qualified = false THEN '不通过'
    ELSE '其他'
  END
ORDER BY 数量 DESC;

