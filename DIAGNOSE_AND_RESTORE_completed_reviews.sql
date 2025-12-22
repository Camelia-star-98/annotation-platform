-- 诊断并恢复已复检数据的 SQL 脚本
-- 执行日期: 2024-12-12

-- ============================================
-- 第一部分：数据诊断
-- ============================================

-- 1. 检查 annotation_completions 表中的记录数
SELECT 
    COUNT(*) as "annotation_completions 总记录数",
    COUNT(DISTINCT video_id) as "涉及的视频数",
    MIN(completed_at) as "最早完成时间",
    MAX(completed_at) as "最晚完成时间"
FROM annotation_completions;

-- 2. 查看所有已完成复检的视频详情
SELECT 
    ac.video_id,
    v.name as "视频名称",
    ac.completed_at as "完成时间",
    v.is_completed as "videos表中的完成状态",
    v.review_completed_at as "videos表中的完成时间"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
ORDER BY ac.completed_at DESC;

-- 3. 检查数据一致性：在 annotation_completions 但 videos 未标记为完成的
SELECT 
    ac.video_id,
    v.name as "视频名称",
    ac.completed_at,
    v.is_completed,
    v.review_completed_at,
    CASE 
        WHEN v.is_completed IS NULL THEN '视频不存在'
        WHEN v.is_completed = false THEN '未标记为已完成'
        ELSE '正常'
    END as "状态"
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true;

-- 4. 检查 videos 表中 is_completed=true 但不在 annotation_completions 的视频
SELECT 
    v.id,
    v.name,
    v.is_completed,
    v.review_completed_at,
    CASE 
        WHEN ac.video_id IS NULL THEN '缺少 annotation_completions 记录'
        ELSE '正常'
    END as "状态"
FROM videos v
LEFT JOIN annotation_completions ac ON v.id = ac.video_id
WHERE v.is_completed = true AND ac.video_id IS NULL;

-- 5. 统计 annotations 表中的复检状态
SELECT 
    COUNT(*) as "总标注数",
    COUNT(*) FILTER (WHERE review_status = true) as "已复检标注数",
    COUNT(*) FILTER (WHERE reviewer IS NOT NULL AND reviewer != '') as "有复检人的标注数",
    COUNT(*) FILTER (WHERE reviewer IS NOT NULL AND reviewer != '' AND review_status != true) as "需要修复的标注数"
FROM annotations;

-- 6. 按视频统计已复检的标注数据
SELECT 
    video_id,
    COUNT(*) as "已复检标注数",
    COUNT(DISTINCT annotator) as "标注人数",
    STRING_AGG(DISTINCT reviewer, ', ') as "复检人列表"
FROM annotations
WHERE review_status = true
GROUP BY video_id
ORDER BY video_id;

-- ============================================
-- 第二部分：数据恢复
-- ============================================

-- 7. 恢复操作 1：同步 videos 表的完成状态（基于 annotation_completions）
-- 这会将 annotation_completions 中的数据同步到 videos 表
UPDATE videos v
SET 
    is_completed = true,
    review_completed_at = ac.completed_at
FROM annotation_completions ac
WHERE v.id = ac.video_id
  AND (v.is_completed IS DISTINCT FROM true 
       OR v.review_completed_at IS DISTINCT FROM ac.completed_at);

-- 查看更新了多少条记录
SELECT 
    COUNT(*) as "已更新的视频数"
FROM videos v
INNER JOIN annotation_completions ac ON v.id = ac.video_id;

-- 8. 恢复操作 2：修复 annotations 表中的 review_status
-- 如果有 reviewer 但 review_status 不是 true，则设置为 true
UPDATE annotations
SET 
    review_status = true,
    updated_at = NOW()
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
  AND review_status != true;

-- 查看修复了多少条记录
SELECT 
    COUNT(*) as "已修复的标注数"
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
  AND review_status = true;

-- ============================================
-- 第三部分：验证恢复结果
-- ============================================

-- 9. 验证：再次检查数据一致性
SELECT 
    '一致性检查' as "检查项",
    COUNT(*) as "记录数",
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 数据一致'
        ELSE '❌ 仍有不一致'
    END as "状态"
FROM (
    -- 检查 annotation_completions 和 videos 的一致性
    SELECT ac.video_id
    FROM annotation_completions ac
    LEFT JOIN videos v ON ac.video_id = v.id
    WHERE v.is_completed IS DISTINCT FROM true
    
    UNION ALL
    
    -- 检查 annotations 的 review_status 一致性
    SELECT id::text as video_id
    FROM annotations
    WHERE reviewer IS NOT NULL 
      AND reviewer != ''
      AND review_status != true
) inconsistencies;

-- 10. 最终统计
SELECT 
    'annotation_completions' as "表名",
    COUNT(*) as "记录数"
FROM annotation_completions
UNION ALL
SELECT 
    'videos (is_completed=true)' as "表名",
    COUNT(*) as "记录数"
FROM videos
WHERE is_completed = true
UNION ALL
SELECT 
    'annotations (review_status=true)' as "表名",
    COUNT(*) as "记录数"
FROM annotations
WHERE review_status = true;

-- 11. 查看所有已完成复检的视频（最终结果）
SELECT 
    v.id as "视频ID",
    v.name as "视频名称",
    v.subject as "主题",
    v.is_completed as "已完成",
    v.review_completed_at as "完成时间",
    COUNT(DISTINCT a.annotator) as "标注人数",
    COUNT(DISTINCT a.reviewer) FILTER (WHERE a.reviewer IS NOT NULL) as "复检人数",
    STRING_AGG(DISTINCT a.reviewer, ', ') FILTER (WHERE a.reviewer IS NOT NULL) as "复检人列表",
    COUNT(a.id) as "已复检标注数"
FROM videos v
INNER JOIN annotation_completions ac ON v.id = ac.video_id
LEFT JOIN annotations a ON v.id = a.video_id AND a.review_status = true
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
ORDER BY v.review_completed_at DESC;
