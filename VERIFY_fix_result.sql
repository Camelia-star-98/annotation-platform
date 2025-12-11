-- 🎯 快速验证脚本：修复后验证郭其其能否看到被打回的记录

-- Step 1: 验证 rejected_annotations 表中郭其其的记录数
SELECT 
  '步骤1：郭其其的被打回记录' AS "验证项",
  COUNT(*) AS "记录数",
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ 通过'
    ELSE '❌ 失败：应该至少有6条记录'
  END AS "验证结果"
FROM rejected_annotations
WHERE annotator = '郭其其';

-- Step 2: 查看郭其其被打回记录的详情
SELECT 
  '步骤2：详细记录' AS "验证项",
  v.annotation_file_name AS "视频文件",
  ra.sentence_no AS "句子号",
  ra.annotator AS "标注人",
  ra.inspector AS "质检人",
  ra.is_resubmitted AS "是否重新提交",
  to_char(ra.rejected_at, 'YYYY-MM-DD HH24:MI:SS') AS "打回时间"
FROM rejected_annotations ra
JOIN videos v ON ra.video_id = v.id
WHERE ra.annotator = '郭其其'
ORDER BY ra.rejected_at DESC;

-- Step 3: 验证没有遗漏的空记录
SELECT 
  '步骤3：检查是否还有空记录' AS "验证项",
  COUNT(*) AS "空记录数",
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ 通过：没有空记录'
    ELSE '❌ 失败：仍有空记录'
  END AS "验证结果"
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '';

-- Step 4: 验证特定视频的记录完整性
WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '步骤4：第七批第一次改写_语文-01.xlsx' AS "验证项",
  COUNT(*) AS "郭其其的被打回记录数",
  CASE 
    WHEN COUNT(*) = 6 THEN '✅ 通过：正好6条'
    WHEN COUNT(*) > 6 THEN '⚠️ 警告：多于6条'
    ELSE '❌ 失败：少于6条'
  END AS "验证结果",
  STRING_AGG(ra.sentence_no::TEXT, ', ' ORDER BY ra.sentence_no) AS "句子号列表"
FROM rejected_annotations ra
JOIN video_data v ON ra.video_id = v.id
WHERE ra.annotator = '郭其其';

-- Step 5: 对比 annotations 表的数据一致性
WITH video_data AS (
  SELECT id FROM videos 
  WHERE annotation_file_name = '第七批第一次改写_语文-01.xlsx' 
  LIMIT 1
)
SELECT 
  '步骤5：数据一致性检查' AS "验证项",
  (SELECT COUNT(*) 
   FROM annotations a 
   JOIN video_data v ON a.video_id = v.id 
   WHERE a.annotator = '郭其其' AND a.is_qualified = false) AS "annotations表中不合格的数量",
  (SELECT COUNT(*) 
   FROM rejected_annotations ra 
   JOIN video_data v ON ra.video_id = v.id 
   WHERE ra.annotator = '郭其其') AS "rejected_annotations表中的数量",
  CASE 
    WHEN (SELECT COUNT(*) FROM annotations a JOIN video_data v ON a.video_id = v.id WHERE a.annotator = '郭其其' AND a.is_qualified = false) =
         (SELECT COUNT(*) FROM rejected_annotations ra JOIN video_data v ON ra.video_id = v.id WHERE ra.annotator = '郭其其')
    THEN '✅ 通过：数量一致'
    ELSE '⚠️ 警告：数量不一致（可能有重新提交或复检的情况）'
  END AS "验证结果";

-- 🎉 总结
SELECT 
  '==================' AS " ",
  '🎉 验证完成' AS "状态",
  '请检查以上各步骤的验证结果' AS "说明"
UNION ALL
SELECT 
  '==================',
  '✅ 如果所有验证都通过',
  '郭其其现在应该能看到被打回的记录了！'
UNION ALL
SELECT
  '==================',
  '📱 让郭其其登录系统验证',
  '进入"被打回的数据"页面查看';

