-- ====================================================
-- 🔧 修复产品复检页面"已复检"标签页数据缺失问题
-- ====================================================
-- 
-- 问题原因：
-- - annotation_completions 表中有数据（点击"完成复检"时插入的记录）
-- - 但 videos 表的 is_completed 和 review_completed_at 没有同步更新
-- 
-- 解决方案：
-- 将 annotation_completions 的数据同步回 videos 表
--
-- ====================================================

-- 第一步：查看当前问题
-- 查看有多少视频在 annotation_completions 中但 videos.is_completed != true
SELECT 
    COUNT(*) as "需要修复的视频数"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true;

-- 第二步：查看详细数据（前10条）
SELECT 
    ac.video_id,
    ac.annotator_name,
    ac.annotation_count,
    ac.completed_at,
    v.is_completed as "videos表当前状态",
    v.review_completed_at as "videos表当前时间"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true
LIMIT 10;

-- ====================================================
-- 🚀 执行修复（确认上面的数据后再运行此步骤）
-- ====================================================

-- 第三步：同步数据（将 annotation_completions 的数据同步到 videos 表）
UPDATE videos v
SET 
    is_completed = true,
    review_completed_at = ac.completed_at
FROM annotation_completions ac
WHERE v.id = ac.video_id
  AND (v.is_completed IS DISTINCT FROM true 
       OR v.review_completed_at IS DISTINCT FROM ac.completed_at);

-- 第四步：验证修复结果
-- 应该返回 0，表示所有数据已同步
SELECT 
    COUNT(*) as "仍需修复的视频数"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true;

-- 第五步：查看最终结果（前10个已复检的视频）
SELECT 
    v.id as "视频ID",
    v.name as "视频名称",
    v.subject as "主题",
    v.is_completed as "已完成",
    v.review_completed_at as "完成时间",
    COUNT(DISTINCT a.annotator) as "标注人数",
    COUNT(DISTINCT a.reviewer) FILTER (WHERE a.reviewer IS NOT NULL) as "复检人数"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id AND a.review_status = true
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 10;

-- ====================================================
-- ✅ 完成！现在刷新产品复检页面，已复检标签页应该有数据了
-- ====================================================


