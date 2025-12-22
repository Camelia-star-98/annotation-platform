-- ====================================
-- 🔍 检查"已复检"标签页为什么显示0条
-- ====================================

-- 查询 1：检查有多少 is_completed = true 的视频
SELECT 
    COUNT(*) as "is_completed为true的视频数量"
FROM videos
WHERE is_completed = true;

-- 查询 2：查看前 10 个 is_completed = true 的视频详情
SELECT 
    v.id as "视频ID",
    v.name as "视频名称",
    v.subject as "科目",
    v.is_completed as "是否完成",
    v.review_completed_at as "完成时间",
    v.annotation_file_name as "标注文件名",
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM annotations 
            WHERE video_id = v.id 
            AND annotator IS NOT NULL 
            AND annotator != ''
        )
        THEN '有'
        ELSE '无'
    END as "是否有标注数据"
FROM videos v
WHERE v.is_completed = true
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 10;

-- 查询 3：检查 annotation_completions 表
SELECT 
    COUNT(*) as "annotation_completions记录数",
    COUNT(DISTINCT video_id) as "涉及的视频数"
FROM annotation_completions;

-- 查询 4：对比 annotation_completions 和 videos 表
SELECT 
    ac.video_id as "视频ID",
    v.name as "视频名称",
    ac.annotator_name as "标注人",
    ac.completed_at as "完成时间(completions表)",
    v.is_completed as "is_completed",
    v.review_completed_at as "完成时间(videos表)"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
ORDER BY ac.completed_at DESC
LIMIT 10;

-- 查询 5：找出数据不一致的情况
-- 情况 A：在 annotation_completions 中但 is_completed != true
SELECT 
    '在completions中但videos表未标记' as "问题类型",
    COUNT(*) as "视频数量"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true;

-- 情况 B：is_completed = true 但没有 annotation_completions 记录
SELECT 
    '在videos表标记但无completions记录' as "问题类型",
    COUNT(*) as "视频数量"
FROM videos v
WHERE v.is_completed = true
AND NOT EXISTS (
    SELECT 1 FROM annotation_completions 
    WHERE video_id = v.id
);

-- 查询 6：检查首页显示的"已完成"视频（对应复检页面的"已复检"）
-- 这些视频应该在产品复检页面的"已复检"标签页显示
SELECT 
    v.id as "视频ID",
    v.name as "视频名称",
    v.subject as "科目",
    v.is_completed as "是否完成",
    v.review_completed_at as "完成时间",
    COUNT(DISTINCT ac.annotator_name) as "完成复检的标注人数"
FROM videos v
LEFT JOIN annotation_completions ac ON v.id = ac.video_id
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 10;
