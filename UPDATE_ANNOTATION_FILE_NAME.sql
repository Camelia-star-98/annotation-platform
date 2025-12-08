-- 更新视频的标注表格文件名
-- 视频：1027-数学-1.mp4
-- 新的标注文件名：第二批第二次改写_数学-01

-- 方法1：根据视频文件名更新（推荐）
UPDATE videos 
SET annotation_file_name = '第二批第二次改写_数学-01'
WHERE name = '1027-数学-1.mp4';

-- 方法2：如果上面的方法没有匹配到记录，可以查看所有相关记录
-- 取消下面的注释来查看
-- SELECT id, name, annotation_file_name, created_at 
-- FROM videos 
-- WHERE name LIKE '%1027%' OR name LIKE '%数学%';

-- 方法3：如果知道具体的 video ID，可以直接用ID更新（最精确）
-- UPDATE videos 
-- SET annotation_file_name = '第二批第二次改写_数学-01'
-- WHERE id = 'your-video-id-here';

-- 验证更新结果
SELECT id, name, annotation_file_name, created_at 
FROM videos 
WHERE name = '1027-数学-1.mp4';

