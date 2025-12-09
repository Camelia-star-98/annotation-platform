-- 批量更新三个视频的标注表格文件名
-- 执行日期：2025/12/8

-- 1. 更新 1027-语文-1.mp4
UPDATE videos 
SET annotation_file_name = '第二批第二次改写_语文-01'
WHERE name = '1027-语文-1.mp4';

-- 2. 更新 1030-语文-2.mp4
UPDATE videos 
SET annotation_file_name = '第二批第二次改写_语文-02'
WHERE name = '1030-语文-2.mp4';

-- 3. 更新 1030-数学-2.mp4
UPDATE videos 
SET annotation_file_name = '第二批第二次改写_数学-02'
WHERE name = '1030-数学-2.mp4';

-- 验证更新结果
SELECT id, name, annotation_file_name, created_at 
FROM videos 
WHERE name IN ('1027-语文-1.mp4', '1030-语文-2.mp4', '1030-数学-2.mp4')
ORDER BY name;


