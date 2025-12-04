-- =========================================
-- 删除"缩略删除"类别
-- =========================================

-- 第一步：查看当前"缩略删除"类别的使用情况
-- 查看problem_categories表中的数据
SELECT major_category, minor_category 
FROM problem_categories 
WHERE major_category = '缩略删除';

-- 查看annotations表中有多少条记录使用了"缩略删除"
SELECT COUNT(*) as count_with_suolueshanche
FROM annotations 
WHERE major_category LIKE '%缩略删除%';

-- 第二步：删除problem_categories表中的"缩略删除"类别
DELETE FROM problem_categories 
WHERE major_category = '缩略删除';

-- 第三步：清理annotations表中的"缩略删除"数据
-- 选项A：如果想保留这些记录但清空其分类信息
-- UPDATE annotations 
-- SET major_category = NULL, minor_category = NULL
-- WHERE major_category LIKE '%缩略删除%';

-- 选项B：如果想完全删除使用了"缩略删除"的标注记录（请谨慎使用）
-- DELETE FROM annotations 
-- WHERE major_category LIKE '%缩略删除%';

-- 选项C：将"缩略删除"从多选分类中移除，但保留其他分类
UPDATE annotations 
SET 
  major_category = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', major_category, ','), ',缩略删除,', ',')),
  minor_category = (
    CASE 
      WHEN major_category LIKE '%缩略删除%' THEN
        -- 需要手动处理小类，因为需要找到对应的小类进行删除
        -- 这里只是示例，具体逻辑需要根据实际情况调整
        minor_category
      ELSE minor_category
    END
  )
WHERE major_category LIKE '%缩略删除%';

-- 第四步：验证删除结果
-- 确认problem_categories中已无"缩略删除"
SELECT COUNT(*) as remaining_suolueshanche_categories
FROM problem_categories 
WHERE major_category = '缩略删除';

-- 确认annotations中已无"缩略删除"引用
SELECT COUNT(*) as remaining_suolueshanche_annotations
FROM annotations 
WHERE major_category LIKE '%缩略删除%';

-- =========================================
-- ⚠️ 使用说明
-- =========================================
-- 1. 请先执行第一步的查询，查看影响范围
-- 2. 根据实际情况选择第三步的选项A、B或C
-- 3. 如果annotations表中有大量数据使用了"缩略删除"，
--    建议先备份数据再执行删除操作
-- 4. 执行完成后运行第四步验证
-- =========================================

