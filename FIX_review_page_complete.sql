-- ====================================================
-- 🔧 完整修复方案：恢复产品复检页面的正常显示
-- ====================================================
--
-- 问题描述：
-- 1. "待复检"标签页：0 个视频
-- 2. "已复检"标签页：0 个视频
--
-- 原因分析：
-- 1. videos 表的 is_completed 字段可能被错误设置
-- 2. annotation_completions 表可能缺少必要的记录
-- 3. 两张表之间的数据不同步
--
-- ====================================================

-- 第一步：诊断当前状态
-- ====================================================

-- 1.1 查看 is_completed 的分布
SELECT 
    CASE 
        WHEN is_completed = true THEN '已完成'
        WHEN is_completed = false THEN '未完成'
        ELSE '空值'
    END as "复检状态",
    COUNT(*) as "视频数量"
FROM videos
GROUP BY is_completed
ORDER BY is_completed NULLS LAST;

-- 1.2 查看有标注数据的视频统计（应该在"待复检"）
SELECT 
    COUNT(DISTINCT v.id) as "有标注数据且质检通过的视频数"
FROM videos v
WHERE v.is_completed IS DISTINCT FROM true  -- 未标记为已完成
AND EXISTS (
    -- 有已完成的标注
    SELECT 1 FROM annotations a1
    WHERE a1.video_id = v.id 
    AND a1.status = true
    AND a1.annotator IS NOT NULL 
    AND a1.annotator != '' 
    AND a1.annotator != 'unknown'
    -- 且有质检通过的数据
    AND EXISTS (
        SELECT 1 FROM annotations a2
        WHERE a2.video_id = a1.video_id
        AND a2.annotator = a1.annotator
        AND a2.status = true
        AND a2.inspector IS NOT NULL
        AND a2.inspector != ''
        AND a2.is_qualified = true
    )
);

-- 1.3 查看已标记为完成的视频（应该在"已复检"）
SELECT 
    COUNT(*) as "已标记为完成的视频数"
FROM videos
WHERE is_completed = true;

-- 1.4 查看 annotation_completions 记录数
SELECT 
    COUNT(*) as "annotation_completions记录数",
    COUNT(DISTINCT video_id) as "涉及的视频数"
FROM annotation_completions;

-- ====================================================
-- 第二步：查看具体数据（前10条示例）
-- ====================================================

-- 2.1 查看"应该在待复检但可能被错误标记"的视频
SELECT 
    v.id as "视频ID",
    v.name as "视频名称",
    v.is_completed as "是否完成",
    COUNT(DISTINCT a.annotator) FILTER (
        WHERE a.status = true
        AND a.inspector IS NOT NULL 
        AND a.inspector != '' 
        AND a.is_qualified = true
    ) as "质检通过的人数",
    COUNT(DISTINCT a.annotator) FILTER (
        WHERE a.status = true
        AND a.review_status != true
    ) as "待复检的人数",
    COUNT(DISTINCT a.annotator) FILTER (
        WHERE a.review_status = true
    ) as "已复检的人数"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
WHERE EXISTS (
    SELECT 1 FROM annotations 
    WHERE video_id = v.id 
    AND status = true
    AND inspector IS NOT NULL
    AND inspector != ''
    AND is_qualified = true
)
GROUP BY v.id, v.name, v.is_completed
ORDER BY v.id
LIMIT 10;

-- ====================================================
-- 第三步：修复数据（确认上面的诊断结果后再执行）
-- ====================================================

-- 3.1 重置所有视频的 is_completed 状态（设为 NULL 或 false）
-- ⚠️ 慎重执行：这会重置所有视频的完成状态
UPDATE videos
SET 
    is_completed = NULL,
    review_completed_at = NULL
WHERE is_completed = true
  -- 安全检查：只重置那些在 annotation_completions 中没有记录的
  AND NOT EXISTS (
    SELECT 1 FROM annotation_completions 
    WHERE video_id = videos.id
  );

-- 查看更新了多少条
SELECT 
    COUNT(*) as "已重置的视频数"
FROM videos
WHERE is_completed IS NULL;

-- 3.2 对于在 annotation_completions 中有记录的视频，同步状态
UPDATE videos v
SET 
    is_completed = true,
    review_completed_at = ac.completed_at
FROM annotation_completions ac
WHERE v.id = ac.video_id
  AND (v.is_completed IS DISTINCT FROM true 
       OR v.review_completed_at IS DISTINCT FROM ac.completed_at);

-- 查看同步了多少条
SELECT 
    COUNT(*) as "已同步的视频数"
FROM videos v
INNER JOIN annotation_completions ac ON v.id = ac.video_id
WHERE v.is_completed = true;

-- ====================================================
-- 第四步：验证修复结果
-- ====================================================

-- 4.1 应该在"待复检"标签页的视频（有质检通过数据，但 is_completed != true）
SELECT 
    COUNT(DISTINCT v.id) as "待复检视频数"
FROM videos v
WHERE v.is_completed IS DISTINCT FROM true
AND EXISTS (
    SELECT 1 FROM annotations a
    WHERE a.video_id = v.id 
    AND a.status = true
    AND a.inspector IS NOT NULL 
    AND a.inspector != '' 
    AND a.is_qualified = true
);

-- 4.2 应该在"已复检"标签页的视频（is_completed = true）
SELECT 
    COUNT(*) as "已复检视频数"
FROM videos
WHERE is_completed = true;

-- 4.3 查看前5个待复检视频的详细信息
SELECT 
    v.id,
    v.name,
    v.subject,
    v.is_completed,
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.status = true) as "标注人数",
    COUNT(DISTINCT a.annotator) FILTER (
        WHERE a.inspector IS NOT NULL 
        AND a.inspector != '' 
        AND a.is_qualified = true
    ) as "质检通过人数"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
    AND a.annotator IS NOT NULL 
    AND a.annotator != ''
WHERE v.is_completed IS DISTINCT FROM true
AND EXISTS (
    SELECT 1 FROM annotations 
    WHERE video_id = v.id 
    AND status = true
    AND inspector IS NOT NULL
    AND inspector != ''
    AND is_qualified = true
)
GROUP BY v.id, v.name, v.subject, v.is_completed
ORDER BY v.id
LIMIT 5;

-- 4.4 查看前5个已复检视频的详细信息
SELECT 
    v.id,
    v.name,
    v.subject,
    v.is_completed,
    v.review_completed_at,
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.review_status = true) as "已复检人数"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 5;

-- ====================================================
-- ✅ 完成！刷新页面检查结果
-- ====================================================


