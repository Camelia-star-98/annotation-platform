-- ===================================================================
-- 检查 video_id 和 annotation_file_name 的匹配情况
-- ===================================================================

-- 1. 查看 videos 表的结构和数据样例
SELECT 
    '=== Videos 表样例 ===' as 说明,
    id as 视频ID,
    name as 视频名称,
    annotation_file_name as 标注文件名,
    subject as 科目
FROM videos
LIMIT 10;

-- 2. 查看 annotations 表的 video_id 和 video_name 字段
SELECT 
    '=== Annotations 表样例 ===' as 说明,
    id,
    video_id as 关联的视频ID,
    video_name as 视频名称字段,
    sentence_no,
    annotator
FROM annotations
LIMIT 10;

-- 3. 统计有多少 annotations 通过 video_id 能关联到 videos
SELECT 
    '=== 通过 video_id 关联 ===' as 说明,
    COUNT(*) as 能关联的数量
FROM annotations a
INNER JOIN videos v ON a.video_id = v.id;

-- 4. 统计有多少 annotations 的 video_name 匹配 videos.annotation_file_name
SELECT 
    '=== 通过 annotation_file_name 关联 ===' as 说明,
    COUNT(*) as 能关联的数量
FROM annotations a
INNER JOIN videos v ON a.video_name = v.annotation_file_name;

-- 5. 找出 video_id 和 annotation_file_name 不一致的情况
SELECT 
    v.id as 视频ID,
    v.name as 视频名称,
    v.annotation_file_name as 标注文件名,
    COUNT(a.id) as 通过videoID关联的标注数,
    COUNT(CASE WHEN a.video_name = v.annotation_file_name THEN 1 END) as 通过文件名匹配的数量
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
GROUP BY v.id, v.name, v.annotation_file_name
HAVING COUNT(a.id) > 0
ORDER BY 通过videoID关联的标注数 DESC
LIMIT 20;

-- 6. 查看待质检数据按 annotation_file_name 分组的统计
SELECT 
    v.annotation_file_name as 标注文件名,
    v.name as 视频名称,
    v.is_completed as 是否完成,
    COUNT(*) as 总标注数,
    COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检数量,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as 已质检数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''
GROUP BY v.annotation_file_name, v.name, v.is_completed
ORDER BY 待质检数量 DESC
LIMIT 30;
