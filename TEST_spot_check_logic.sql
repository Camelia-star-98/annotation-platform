-- ================================================================
-- 🧪 测试抽检自动通过逻辑
-- ================================================================
-- 测试场景：
--   1. 质检人抽检部分句子（比如10条中抽3条）
--   2. 如果抽检的3条全部通过 ✅ → 自动将其他7条也标记为通过
--   3. 如果抽检的3条中有任何不通过 ❌ → 只标记那些被打回的句子
-- ================================================================

-- 📊 报告1：选一个视频进行测试（郭其其的视频）
WITH target_video AS (
    -- 选择郭其其的第一个视频作为测试对象
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true  -- 已完成标注
    LIMIT 1
)
SELECT 
    '📊 测试视频信息' as report_title,
    tv.video_id,
    tv.video_name,
    COUNT(a.id) as total_annotations,
    COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) as pending_inspection,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as already_inspected,
    COUNT(CASE WHEN a.is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN a.is_qualified = false THEN 1 END) as failed_count
FROM target_video tv
LEFT JOIN annotations a ON a.video_id = tv.video_id
GROUP BY tv.video_id, tv.video_name;

-- 📊 报告2：模拟抽检场景 - 查看抽检前的状态
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '📊 抽检前的句子状态' as report_title,
    a.id,
    a.sentence_no,
    a.annotator,
    a.inspector,
    a.is_qualified,
    CASE 
        WHEN a.inspector IS NULL OR a.inspector = '' THEN '⏳ 待质检'
        WHEN a.is_qualified = true THEN '✅ 已通过'
        WHEN a.is_qualified = false THEN '❌ 已打回'
        ELSE '❓ 未知状态'
    END as inspection_status
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id
ORDER BY a.sentence_no
LIMIT 20;  -- 只显示前20条

-- 📊 报告3：测试场景1 - 抽检3条全部通过的情况
-- （这个需要在前端实际操作后才能看到效果）
-- 预期结果：
--   - 抽检的3条被标记为 is_qualified = true, inspector = '测试质检员'
--   - 其他未抽检的7条也被自动标记为 is_qualified = true, inspector = '测试质检员'
SELECT 
    '📊 测试场景1：预期结果' as report_title,
    '抽检3条全部通过 → 其他7条自动标记为通过' as scenario,
    '所有10条都应该显示：is_qualified = true' as expected_result;

-- 📊 报告4：测试场景2 - 抽检3条中有1条不通过的情况
-- 预期结果：
--   - 抽检的3条被标记（2条通过，1条不通过）
--   - 其他未抽检的7条保持"待质检"状态（不自动标记）
SELECT 
    '📊 测试场景2：预期结果' as report_title,
    '抽检3条中有1条不通过 → 其他7条保持待质检状态' as scenario,
    '应该有2条 is_qualified = true, 1条 is_qualified = false, 7条 inspector = null' as expected_result;

-- ================================================================
-- 🎯 测试步骤（在前端进行）
-- ================================================================
-- 步骤1：打开"选择视频进行质检"页面
-- 步骤2：选择郭其其标注的视频（如：英语02.mp4）
-- 步骤3：选择抽检比例：30%（假设视频有10条，会抽3条）
-- 步骤4：进入质检页面，对抽检的3条全部标记为"通过" ✅
-- 步骤5：提交质检
-- 步骤6：运行下面的验证SQL，检查结果
-- ================================================================

-- 🧪 验证SQL：检查抽检后的结果
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '🧪 抽检后的验证结果' as report_title,
    COUNT(*) as total_annotations,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN a.is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN a.is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) as still_pending,
    CASE 
        WHEN COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) = 0 
        THEN '✅ 测试通过：所有句子都已质检（自动标记成功）'
        ELSE '❌ 测试失败：还有未质检的句子（自动标记未生效）'
    END as test_result
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id;

-- 🔍 详细查看每一条的状态
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '🔍 每条句子的详细状态' as report_title,
    a.sentence_no,
    a.annotator,
    COALESCE(a.inspector, '❓ 未质检') as inspector,
    CASE 
        WHEN a.is_qualified = true THEN '✅ 通过'
        WHEN a.is_qualified = false THEN '❌ 不通过'
        ELSE '⏳ 待质检'
    END as quality_status,
    a.updated_at as last_updated
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id
ORDER BY a.sentence_no;

-- ================================================================
-- 📝 预期行为说明
-- ================================================================
-- 【场景1：抽检全部通过】
--   输入：抽检3条，全部标记为"通过" ✅
--   输出：
--     1. 前端调用 handleSubmit()
--     2. 检测到 allPassed = true（failedCount === 0）
--     3. 查询该视频的所有未质检句子（排除已抽检的3条）
--     4. 批量更新未质检句子：is_qualified = true, inspector = '质检人姓名'
--     5. 消息提示："🎉 抽检完成！全部通过，整个视频已自动标记为质检通过"
--     6. 该视频从"待质检"列表消失
--
-- 【场景2：抽检中有不通过】
--   输入：抽检3条，其中1条标记为"不通过" ❌
--   输出：
--     1. 前端调用 handleSubmit()
--     2. 检测到 allPassed = false（failedCount > 0）
--     3. 跳过自动标记逻辑（不会更新未抽检的句子）
--     4. 只更新已抽检的3条句子状态
--     5. 将不通过的1条记录到 rejected_annotations 表
--     6. 该视频仍显示在"待质检"列表中（还有未抽检的句子）
-- ================================================================

-- ✅ 总结
SELECT 
    '✅ 测试总结' as title,
    '抽检逻辑已优化：全部通过时自动标记其他句子' as feature,
    '请在前端实际操作后运行本SQL验证结果' as next_action;

-- 🧪 测试抽检自动通过逻辑
-- ================================================================
-- 测试场景：
--   1. 质检人抽检部分句子（比如10条中抽3条）
--   2. 如果抽检的3条全部通过 ✅ → 自动将其他7条也标记为通过
--   3. 如果抽检的3条中有任何不通过 ❌ → 只标记那些被打回的句子
-- ================================================================

-- 📊 报告1：选一个视频进行测试（郭其其的视频）
WITH target_video AS (
    -- 选择郭其其的第一个视频作为测试对象
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true  -- 已完成标注
    LIMIT 1
)
SELECT 
    '📊 测试视频信息' as report_title,
    tv.video_id,
    tv.video_name,
    COUNT(a.id) as total_annotations,
    COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) as pending_inspection,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as already_inspected,
    COUNT(CASE WHEN a.is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN a.is_qualified = false THEN 1 END) as failed_count
FROM target_video tv
LEFT JOIN annotations a ON a.video_id = tv.video_id
GROUP BY tv.video_id, tv.video_name;

-- 📊 报告2：模拟抽检场景 - 查看抽检前的状态
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '📊 抽检前的句子状态' as report_title,
    a.id,
    a.sentence_no,
    a.annotator,
    a.inspector,
    a.is_qualified,
    CASE 
        WHEN a.inspector IS NULL OR a.inspector = '' THEN '⏳ 待质检'
        WHEN a.is_qualified = true THEN '✅ 已通过'
        WHEN a.is_qualified = false THEN '❌ 已打回'
        ELSE '❓ 未知状态'
    END as inspection_status
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id
ORDER BY a.sentence_no
LIMIT 20;  -- 只显示前20条

-- 📊 报告3：测试场景1 - 抽检3条全部通过的情况
-- （这个需要在前端实际操作后才能看到效果）
-- 预期结果：
--   - 抽检的3条被标记为 is_qualified = true, inspector = '测试质检员'
--   - 其他未抽检的7条也被自动标记为 is_qualified = true, inspector = '测试质检员'
SELECT 
    '📊 测试场景1：预期结果' as report_title,
    '抽检3条全部通过 → 其他7条自动标记为通过' as scenario,
    '所有10条都应该显示：is_qualified = true' as expected_result;

-- 📊 报告4：测试场景2 - 抽检3条中有1条不通过的情况
-- 预期结果：
--   - 抽检的3条被标记（2条通过，1条不通过）
--   - 其他未抽检的7条保持"待质检"状态（不自动标记）
SELECT 
    '📊 测试场景2：预期结果' as report_title,
    '抽检3条中有1条不通过 → 其他7条保持待质检状态' as scenario,
    '应该有2条 is_qualified = true, 1条 is_qualified = false, 7条 inspector = null' as expected_result;

-- ================================================================
-- 🎯 测试步骤（在前端进行）
-- ================================================================
-- 步骤1：打开"选择视频进行质检"页面
-- 步骤2：选择郭其其标注的视频（如：英语02.mp4）
-- 步骤3：选择抽检比例：30%（假设视频有10条，会抽3条）
-- 步骤4：进入质检页面，对抽检的3条全部标记为"通过" ✅
-- 步骤5：提交质检
-- 步骤6：运行下面的验证SQL，检查结果
-- ================================================================

-- 🧪 验证SQL：检查抽检后的结果
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '🧪 抽检后的验证结果' as report_title,
    COUNT(*) as total_annotations,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as inspected_count,
    COUNT(CASE WHEN a.is_qualified = true THEN 1 END) as passed_count,
    COUNT(CASE WHEN a.is_qualified = false THEN 1 END) as failed_count,
    COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) as still_pending,
    CASE 
        WHEN COUNT(CASE WHEN a.inspector IS NULL OR a.inspector = '' THEN 1 END) = 0 
        THEN '✅ 测试通过：所有句子都已质检（自动标记成功）'
        ELSE '❌ 测试失败：还有未质检的句子（自动标记未生效）'
    END as test_result
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id;

-- 🔍 详细查看每一条的状态
WITH target_video AS (
    SELECT DISTINCT video_id, video_name
    FROM annotations
    WHERE annotator = '郭其其'
        AND status = true
    LIMIT 1
)
SELECT 
    '🔍 每条句子的详细状态' as report_title,
    a.sentence_no,
    a.annotator,
    COALESCE(a.inspector, '❓ 未质检') as inspector,
    CASE 
        WHEN a.is_qualified = true THEN '✅ 通过'
        WHEN a.is_qualified = false THEN '❌ 不通过'
        ELSE '⏳ 待质检'
    END as quality_status,
    a.updated_at as last_updated
FROM target_video tv
JOIN annotations a ON a.video_id = tv.video_id
ORDER BY a.sentence_no;

-- ================================================================
-- 📝 预期行为说明
-- ================================================================
-- 【场景1：抽检全部通过】
--   输入：抽检3条，全部标记为"通过" ✅
--   输出：
--     1. 前端调用 handleSubmit()
--     2. 检测到 allPassed = true（failedCount === 0）
--     3. 查询该视频的所有未质检句子（排除已抽检的3条）
--     4. 批量更新未质检句子：is_qualified = true, inspector = '质检人姓名'
--     5. 消息提示："🎉 抽检完成！全部通过，整个视频已自动标记为质检通过"
--     6. 该视频从"待质检"列表消失
--
-- 【场景2：抽检中有不通过】
--   输入：抽检3条，其中1条标记为"不通过" ❌
--   输出：
--     1. 前端调用 handleSubmit()
--     2. 检测到 allPassed = false（failedCount > 0）
--     3. 跳过自动标记逻辑（不会更新未抽检的句子）
--     4. 只更新已抽检的3条句子状态
--     5. 将不通过的1条记录到 rejected_annotations 表
--     6. 该视频仍显示在"待质检"列表中（还有未抽检的句子）
-- ================================================================

-- ✅ 总结
SELECT 
    '✅ 测试总结' as title,
    '抽检逻辑已优化：全部通过时自动标记其他句子' as feature,
    '请在前端实际操作后运行本SQL验证结果' as next_action;

