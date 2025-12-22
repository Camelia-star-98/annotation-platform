-- ====================================================
-- 🔍 检查当前产品复检页面状态
-- ====================================================

-- 1. 查看 videos 表中 is_completed 的分布
SELECT 
    is_completed as "是否完成复检",
    COUNT(*) as "视频数量"
FROM videos
GROUP BY is_completed
ORDER BY is_completed NULLS LAST;

-- 2. 查看有标注数据但 is_completed 状态不同的视频
SELECT 
    v.id,
    v.name,
    v.subject,
    v.is_completed as "是否已完成",
    v.review_completed_at as "完成时间",
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.status = true) as "已完成标注的人数",
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.review_status = true) as "已复检的人数",
    COUNT(DISTINCT a.annotator) FILTER (
        WHERE a.inspector IS NOT NULL 
        AND a.inspector != '' 
        AND a.is_qualified = true
    ) as "质检通过的人数",
    BOOL_OR(ac.video_id IS NOT NULL) as "有annotation_completions记录"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
LEFT JOIN annotation_completions ac ON v.id = ac.video_id
WHERE EXISTS (
    SELECT 1 FROM annotations 
    WHERE video_id = v.id 
    AND status = true
    AND annotator IS NOT NULL 
    AND annotator != '' 
    AND annotator != 'unknown'
)
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
ORDER BY v.is_completed NULLS FIRST, v.id
LIMIT 30;

-- 3. 查看 annotation_completions 表的记录数
SELECT 
    COUNT(*) as "annotation_completions记录总数"
FROM annotation_completions;

-- 4. 查看哪些视频在 annotation_completions 但 is_completed != true
SELECT 
    ac.video_id,
    v.name as "视频名称",
    v.is_completed as "is_completed",
    v.review_completed_at as "review_completed_at",
    ac.completed_at as "annotation_completions时间",
    ac.annotator_name as "标注人",
    ac.annotation_count as "标注数量"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true
ORDER BY ac.completed_at DESC
LIMIT 20;

-- 5. 查看哪些视频 is_completed = true 但没有 annotation_completions 记录
SELECT 
    v.id,
    v.name as "视频名称",
    v.is_completed,
    v.review_completed_at,
    CASE 
        WHEN ac.video_id IS NULL THEN '缺少 annotation_completions 记录'
        ELSE '正常'
    END as "状态"
FROM videos v
LEFT JOIN annotation_completions ac ON v.id = ac.video_id
WHERE v.is_completed = true
  AND ac.video_id IS NULL
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 20;


