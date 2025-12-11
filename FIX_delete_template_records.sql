-- ========================================
-- 修复方案：删除过时的 template 记录
-- ========================================
-- 问题：annotations 表中存在重复记录
--   - template 记录：annotator 为空，是系统初始化时创建的
--   - 实际标注记录：annotator 有值，是标注员标注时创建的
-- 解决：删除 template 记录，保留实际标注记录
-- ========================================

-- ⚠️ 重要：执行前请先运行检查查询！

-- ========================================
-- 第一部分：检查查询（只读，安全）
-- ========================================

-- 🔍 检查1：找出所有有重复记录的视频
SELECT 
    '检查1_重复记录统计' as report_section,
    video_id,
    sentence_no,
    COUNT(*) as record_count,
    COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as empty_annotator_count,
    COUNT(CASE WHEN annotator IS NOT NULL AND annotator != '' THEN 1 END) as has_annotator_count,
    STRING_AGG(id, ' | ') as all_ids
FROM annotations
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1
ORDER BY video_id, sentence_no
LIMIT 100;

-- 🔍 检查2：郭其其视频的详细情况
SELECT 
    '检查2_郭其其视频详情' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    CASE 
        WHEN id LIKE '%_template' THEN '是template记录'
        WHEN id LIKE '%_郭其其' THEN '是郭其其标注'
        ELSE '其他类型'
    END as record_type,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no, 
    CASE WHEN id LIKE '%_template' THEN 1 ELSE 2 END;

-- 🔍 检查3：统计将要删除的记录
SELECT 
    '检查3_待删除记录统计' as report_section,
    COUNT(*) as total_template_records,
    COUNT(DISTINCT video_id) as affected_videos,
    STRING_AGG(DISTINCT video_id, ', ') as video_list
FROM annotations a
WHERE (annotator IS NULL OR annotator = '')
  AND EXISTS (
      SELECT 1 
      FROM annotations a2 
      WHERE a2.video_id = a.video_id 
        AND a2.sentence_no = a.sentence_no 
        AND a2.annotator IS NOT NULL 
        AND a2.annotator != ''
  );

-- ========================================
-- 第二部分：修复操作（写操作，需谨慎）
-- ========================================

-- ⚠️ 警告：以下是删除操作！
-- ⚠️ 请先确认上面的检查结果无误后再执行！
-- ⚠️ 建议：先在测试环境执行，或先导出备份！

-- 🔧 修复：删除有重复的 template 记录
-- 策略：只删除那些"同一个视频+句子有多条记录，且其中有 annotator 有值的记录"的空 annotator 记录
DELETE FROM annotations
WHERE id IN (
    SELECT a.id
    FROM annotations a
    WHERE (a.annotator IS NULL OR a.annotator = '')
      AND EXISTS (
          -- 确保同一个句子有其他有 annotator 的记录
          SELECT 1 
          FROM annotations a2 
          WHERE a2.video_id = a.video_id 
            AND a2.sentence_no = a.sentence_no 
            AND a2.id != a.id
            AND a2.annotator IS NOT NULL 
            AND a2.annotator != ''
      )
);

-- ========================================
-- 第三部分：验证修复结果
-- ========================================

-- 🔍 验证1：检查是否还有重复记录
SELECT 
    '验证1_剩余重复记录' as report_section,
    video_id,
    sentence_no,
    COUNT(*) as record_count
FROM annotations
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1;

-- 🔍 验证2：检查郭其其视频的最终状态
SELECT 
    '验证2_郭其其视频最终状态' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    created_at,
    updated_at
FROM annotations
WHERE video_id = 'upload_1765171740803'
ORDER BY sentence_no;

-- 🔍 验证3：检查是否还有 annotator 为空的记录
SELECT 
    '验证3_剩余空annotator记录' as report_section,
    COUNT(*) as empty_annotator_count,
    COUNT(DISTINCT video_id) as affected_videos
FROM annotations
WHERE annotator IS NULL OR annotator = '';

-- 🔍 验证4：检查总记录数变化
SELECT 
    '验证4_总记录统计' as report_section,
    COUNT(*) as total_records,
    COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as empty_count,
    COUNT(CASE WHEN annotator IS NOT NULL AND annotator != '' THEN 1 END) as has_value_count,
    COUNT(DISTINCT video_id) as total_videos
FROM annotations;

