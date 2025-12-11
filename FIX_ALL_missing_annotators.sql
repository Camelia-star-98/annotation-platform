-- 🔧 全面修复 rejected_annotations 表中缺失的标注人信息
-- 适用于所有视频的所有缺失记录

-- Step 1: 诊断 - 查看有多少条记录缺失标注人
SELECT 
  '诊断：缺失标注人的记录总数' AS "说明",
  COUNT(*) AS "记录数"
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '';

-- Step 2: 诊断 - 这些缺失的记录分布在哪些视频
SELECT 
  '诊断：按视频分组统计' AS "说明",
  v.annotation_file_name AS "视频文件名",
  COUNT(*) AS "缺失标注人的记录数"
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE ra.annotator IS NULL OR ra.annotator = ''
GROUP BY v.annotation_file_name
ORDER BY COUNT(*) DESC;

-- Step 3: 修复预览 - 查看将要修复的数据（前20条）
SELECT 
  '修复预览（前20条）' AS "说明",
  ra.sentence_no AS "句子号",
  v.annotation_file_name AS "视频文件名",
  COALESCE(ra.annotator, '❌(空)') AS "当前标注人",
  COALESCE(a.annotator, '未找到') AS "应该是的标注人",
  ra.inspector AS "质检人",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
LEFT JOIN annotations a ON a.video_id = ra.video_id AND a.sentence_no = ra.sentence_no
WHERE ra.annotator IS NULL OR ra.annotator = ''
ORDER BY ra.rejected_at DESC
LIMIT 20;

-- ⚠️ Step 4: 执行修复（请先确认上面的预览结果正确后再执行）
-- 取消下面的注释来执行修复

/*
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 执行修复
  WITH to_update AS (
    SELECT 
      ra.id AS rejected_id,
      a.annotator AS correct_annotator
    FROM rejected_annotations ra
    JOIN annotations a ON a.video_id = ra.video_id AND a.sentence_no = ra.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND a.annotator IS NOT NULL 
      AND a.annotator != ''
  )
  UPDATE rejected_annotations ra
  SET 
    annotator = tu.correct_annotator,
    updated_at = NOW()
  FROM to_update tu
  WHERE ra.id = tu.rejected_id;
  
  -- 获取更新的记录数
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 输出结果
  RAISE NOTICE '✅ 成功修复 % 条记录', updated_count;
END $$;

-- 验证修复结果
SELECT 
  '修复后验证' AS "说明",
  COUNT(*) AS "仍然缺失标注人的记录数"
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '';

-- 显示修复后的郭其其的记录（示例）
SELECT 
  '郭其其的被打回记录' AS "说明",
  ra.sentence_no AS "句子号",
  v.annotation_file_name AS "视频文件名",
  ra.annotator AS "标注人",
  ra.inspector AS "质检人",
  ra.is_resubmitted AS "是否重新提交",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE ra.annotator = '郭其其'
ORDER BY ra.rejected_at DESC;
*/

