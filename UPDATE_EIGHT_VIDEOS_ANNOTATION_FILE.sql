-- 批量更新8个视频的标注表格文件名
-- 执行日期：2025/12/8

-- 第5批第一轮系列（4个视频）
-- 1. 更新 第5批第一轮-语文-1.mp4
UPDATE videos 
SET annotation_file_name = '第5轮第二批-语文-1'
WHERE name = '第5批第一轮-语文-1.mp4';

-- 2. 更新 第5批第一轮-物理-01.mp4
UPDATE videos 
SET annotation_file_name = '第5轮第二批-物理-1'
WHERE name = '第5批第一轮-物理-01.mp4';

-- 3. 更新 第5批第一轮-数学-1.mp4
UPDATE videos 
SET annotation_file_name = '第5轮第二批-数学-1'
WHERE name = '第5批第一轮-数学-1.mp4';

-- 4. 更新 第5批第一轮-英语-1.mp4
UPDATE videos 
SET annotation_file_name = '第5轮第二批-英语-1'
WHERE name = '第5批第一轮-英语-1.mp4';

-- 第六批视频-第一轮系列（4个视频）
-- 5. 更新 第六批视频-第一轮-物理-1.mp4
UPDATE videos 
SET annotation_file_name = '第6轮第一批-物理-1'
WHERE name = '第六批视频-第一轮-物理-1.mp4';

-- 6. 更新 第六批视频-第一轮-语文-1.mp4
UPDATE videos 
SET annotation_file_name = '第6轮第一批-语文-1'
WHERE name = '第六批视频-第一轮-语文-1.mp4';

-- 7. 更新 第六批视频-第一轮-英语-1.mp4
UPDATE videos 
SET annotation_file_name = '第6轮第一批-英语-1'
WHERE name = '第六批视频-第一轮-英语-1.mp4';

-- 8. 更新 第六批视频-第一轮-数学-1.mp4
UPDATE videos 
SET annotation_file_name = '第6轮第一批-数学-1'
WHERE name = '第六批视频-第一轮-数学-1.mp4';

-- 验证更新结果
SELECT id, name, annotation_file_name, total_sentences, created_at 
FROM videos 
WHERE name IN (
    '第5批第一轮-语文-1.mp4',
    '第5批第一轮-物理-01.mp4',
    '第5批第一轮-数学-1.mp4',
    '第5批第一轮-英语-1.mp4',
    '第六批视频-第一轮-物理-1.mp4',
    '第六批视频-第一轮-语文-1.mp4',
    '第六批视频-第一轮-英语-1.mp4',
    '第六批视频-第一轮-数学-1.mp4'
)
ORDER BY name;


