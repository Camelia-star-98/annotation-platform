-- 修复标注人为 'unknown' 的数据，将 'unknown' 改为空字符串
UPDATE annotations
SET annotator = ''
WHERE annotator = 'unknown';

-- 查看修复结果（可选，可以单独执行）
SELECT 
  annotator,
  COUNT(*) as count
FROM annotations
GROUP BY annotator
ORDER BY count DESC;

