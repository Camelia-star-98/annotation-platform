-- ===================================================================
-- 清理空值和测试标注人的数据（可选）
-- ===================================================================
-- ⚠️ 警告：此操作会删除数据，执行前请务必备份数据库！
-- ===================================================================

-- 1. 先查看要删除的数据
SELECT 
    '=== 即将删除的数据预览 ===' as 说明;

SELECT 
    COUNT(*) as 将被删除的记录数,
    COUNT(DISTINCT video_id) as 涉及的视频数,
    COUNT(DISTINCT CASE WHEN annotator IS NULL THEN 'NULL' ELSE annotator END) as 标注人类型数
FROM annotations
WHERE annotator IS NULL 
   OR annotator = '' 
   OR annotator IN ('1', '你', '你好');

-- 2. 按标注人分组查看
SELECT 
    '=== 按标注人分组 ===' as 说明,
    COALESCE(annotator, '【NULL】') as 标注人,
    COUNT(*) as 记录数,
    COUNT(DISTINCT video_id) as 涉及视频数
FROM annotations
WHERE annotator IS NULL 
   OR annotator = '' 
   OR annotator IN ('1', '你', '你好')
GROUP BY annotator
ORDER BY 记录数 DESC;

-- 3. 查看具体要删除的记录样本（前20条）
SELECT 
    '=== 要删除的记录样本 ===' as 说明,
    id,
    video_id,
    sentence_no,
    COALESCE(annotator, '【NULL】') as 标注人,
    LEFT(human_annotated_text, 30) as 标注文本,
    created_at
FROM annotations
WHERE annotator IS NULL 
   OR annotator = '' 
   OR annotator IN ('1', '你', '你好')
ORDER BY created_at DESC
LIMIT 20;

-- ===================================================================
-- 如果确认要删除，请取消下面的注释并执行
-- ===================================================================

/*
-- 4. 删除空值和测试标注人的数据
DELETE FROM annotations
WHERE annotator IS NULL 
   OR annotator = '' 
   OR annotator IN ('1', '你', '你好');

-- 5. 查看删除结果
SELECT 
    '=== 删除完成 ===' as 说明,
    COUNT(*) as 剩余记录数,
    COUNT(DISTINCT video_id) as 剩余视频数,
    COUNT(DISTINCT annotator) as 剩余标注人数
FROM annotations;

-- 6. 查看剩余的标注人列表
SELECT 
    '=== 剩余标注人列表 ===' as 说明,
    annotator as 标注人,
    COUNT(*) as 记录数
FROM annotations
GROUP BY annotator
ORDER BY 记录数 DESC;
*/

-- ===================================================================
-- 如果只想删除空值，保留测试标注人（1、你、你好），取消下面的注释
-- ===================================================================

/*
-- 只删除空值标注人
DELETE FROM annotations
WHERE annotator IS NULL OR annotator = '';

SELECT 
    '=== 删除空值完成 ===' as 说明,
    COUNT(*) as 剩余记录数,
    COUNT(DISTINCT annotator) as 剩余标注人数
FROM annotations;
*/

