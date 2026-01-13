-- =========================================
-- 检查和修复丢失的复检数据 SQL脚本
-- =========================================

-- 第1步：查看数据统计
-- 复制下面的SQL，在Supabase SQL编辑器中运行

SELECT 
  '总数据量' as 统计项,
  COUNT(*) as 数量
FROM annotations

UNION ALL

SELECT 
  '有复检人的数据' as 统计项,
  COUNT(*) as 数量
FROM annotations
WHERE reviewer IS NOT NULL AND reviewer != ''

UNION ALL

SELECT 
  'review_status = true' as 统计项,
  COUNT(*) as 数量
FROM annotations
WHERE review_status = true

UNION ALL

SELECT 
  'review_status = false' as 统计项,
  COUNT(*) as 数量
FROM annotations
WHERE review_status = false

UNION ALL

SELECT 
  'review_status = null' as 统计项,
  COUNT(*) as 数量
FROM annotations
WHERE review_status IS NULL

UNION ALL

SELECT 
  '🔴 有复检人但review_status不是true（丢失的数据）' as 统计项,
  COUNT(*) as 数量
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != '' 
  AND review_status != true;


-- =========================================
-- 第2步：查看丢失数据的详情（前20条）
-- =========================================

SELECT 
  video_id,
  sentence_no as 句号,
  annotator as 标注人,
  reviewer as 复检人,
  review_status,
  CASE 
    WHEN human_annotated_text IS NOT NULL AND human_annotated_text != '' 
    THEN '有' 
    ELSE '无' 
  END as 人工标注文本,
  updated_at as 更新时间
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != '' 
  AND review_status != true
ORDER BY updated_at DESC
LIMIT 20;


-- =========================================
-- 第3步：查看涉及的复检人
-- =========================================

SELECT DISTINCT reviewer as 复检人
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
ORDER BY reviewer;


-- =========================================
-- 第4步：按视频统计丢失的数据
-- =========================================

SELECT 
  video_id,
  COUNT(*) as 丢失数量,
  STRING_AGG(DISTINCT reviewer, ', ') as 复检人列表
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != '' 
  AND review_status != true
GROUP BY video_id
ORDER BY COUNT(*) DESC;


-- =========================================
-- 🔧 修复方案：恢复丢失的复检数据
-- =========================================
-- ⚠️ 警告：执行前请先确认上面的统计结果
-- ⚠️ 此操作会将所有有复检人但review_status不是true的数据标记为已复检
-- ⚠️ 此操作不可撤销！

-- 如果确认要修复，请删除下面这行注释并运行：
-- UPDATE annotations
-- SET review_status = true
-- WHERE reviewer IS NOT NULL 
--   AND reviewer != '' 
--   AND review_status != true;

-- 修复后，再次运行第1步的统计查询，验证是否修复成功










