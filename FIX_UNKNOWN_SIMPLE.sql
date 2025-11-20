-- 修复标注人为 'unknown' 的数据
-- 执行方法：在 Supabase SQL Editor 中，只复制下面的 UPDATE 语句执行

UPDATE annotations
SET annotator = ''
WHERE annotator = 'unknown';

-- 执行后，可以运行下面的查询查看结果（可选）
SELECT annotator, COUNT(*) as count
FROM annotations
GROUP BY annotator
ORDER BY count DESC;

