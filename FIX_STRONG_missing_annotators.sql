-- ========================================
-- 🔧 强力修复：处理所有可能的情况
-- ========================================

-- ==========================================
-- 第一部分：诊断（先运行这部分了解情况）
-- ==========================================

-- 1️⃣ 检查当前问题范围
SELECT 
    'rejected_annotations 中空 annotator 记录数' as metric,
    COUNT(*) as count
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '' OR TRIM(annotator) = '';

-- 2️⃣ 检查这些记录能否从 annotations 表修复
SELECT 
    CASE 
        WHEN a.annotator IS NOT NULL AND a.annotator != '' AND TRIM(a.annotator) != '' 
        THEN '✅ 可以从 annotations 修复'
        ELSE '❌ annotations 中也是空的'
    END as status,
    COUNT(*) as count
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = ''
GROUP BY 
    CASE 
        WHEN a.annotator IS NOT NULL AND a.annotator != '' AND TRIM(a.annotator) != '' 
        THEN '✅ 可以从 annotations 修复'
        ELSE '❌ annotations 中也是空的'
    END;

-- 3️⃣ 查看具体的空记录详情
SELECT 
    ra.video_id,
    ra.sentence_no,
    ra.annotator as rejected_annotator,
    a.annotator as annotations_annotator,
    ra.rejection_reason,
    ra.rejected_at
FROM rejected_annotations ra
LEFT JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = ''
ORDER BY ra.rejected_at DESC
LIMIT 20;

-- ==========================================
-- 第二部分：修复（确认上面的诊断后，取消注释并执行）
-- ==========================================

/*
-- 🔧 修复方案 1：从 annotations 表补充 annotator
UPDATE rejected_annotations ra
SET annotator = a.annotator
FROM annotations a
WHERE ra.video_id = a.video_id 
  AND ra.sentence_no = a.sentence_no
  AND (ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = '')
  AND a.annotator IS NOT NULL 
  AND a.annotator != '' 
  AND TRIM(a.annotator) != '';

-- 显示修复了多少条
SELECT 
    '✅ 修复完成' as status,
    COUNT(*) as fixed_count
FROM rejected_annotations ra
JOIN annotations a ON ra.video_id = a.video_id AND ra.sentence_no = a.sentence_no
WHERE ra.annotator IS NOT NULL 
  AND ra.annotator != '';
*/

-- ==========================================
-- 第三部分：处理 annotations 表中也是空的情况
-- ==========================================

-- 4️⃣ 检查 annotations 表中也是空 annotator 的记录
SELECT 
    '⚠️ annotations 表中也有空 annotator' as issue,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at
FROM annotations
WHERE annotator IS NULL OR annotator = '' OR TRIM(annotator) = ''
ORDER BY created_at DESC
LIMIT 20;

-- 5️⃣ 检查被打回记录的基本信息
SELECT 
    ra.video_id,
    ra.sentence_no,
    ra.annotator as current_annotator,
    ra.rejection_reason,
    CASE 
        WHEN ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = '' 
        THEN '需要修复'
        ELSE '已有数据'
    END as status
FROM rejected_annotations ra
WHERE ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = '';

/*
-- 🔧 修复方案 2：如果 annotations 表也是空的，尝试从其他信息推断
-- （只有在确认需要时才取消注释执行）

-- 方案 2A: 查找同一视频同一用户的其他标注记录
UPDATE rejected_annotations ra
SET annotator = (
    SELECT DISTINCT a2.annotator
    FROM annotations a2
    WHERE a2.video_id = ra.video_id
      AND a2.annotator IS NOT NULL 
      AND a2.annotator != '' 
      AND TRIM(a2.annotator) != ''
    LIMIT 1
)
WHERE (ra.annotator IS NULL OR ra.annotator = '' OR TRIM(ra.annotator) = '')
  AND EXISTS (
    SELECT 1 
    FROM annotations a2
    WHERE a2.video_id = ra.video_id
      AND a2.annotator IS NOT NULL 
      AND a2.annotator != '' 
      AND TRIM(a2.annotator) != ''
  );
*/

-- ==========================================
-- 第四部分：验证修复结果
-- ==========================================

-- 6️⃣ 验证修复后的状态
SELECT 
    'rejected_annotations 修复后剩余空记录数' as metric,
    COUNT(*) as count
FROM rejected_annotations
WHERE annotator IS NULL OR annotator = '' OR TRIM(annotator) = '';

-- 7️⃣ 检查郭其其的记录是否已修复
SELECT 
    '✅ 郭其其的记录状态' as check_type,
    video_id,
    sentence_no,
    annotator,
    rejection_reason
FROM rejected_annotations
WHERE video_id = '第七批第一次改写_语文-01.xlsx'
  AND sentence_no IN (9, 16, 26, 27, 30, 32)
ORDER BY sentence_no;

-- 8️⃣ 最终统计
SELECT 
    CASE 
        WHEN annotator IS NULL OR annotator = '' OR TRIM(annotator) = '' 
        THEN '❌ 仍然为空'
        ELSE '✅ 已有数据'
    END as status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM rejected_annotations
GROUP BY 
    CASE 
        WHEN annotator IS NULL OR annotator = '' OR TRIM(annotator) = '' 
        THEN '❌ 仍然为空'
        ELSE '✅ 已有数据'
    END;

