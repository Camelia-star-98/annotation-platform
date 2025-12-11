-- ============================================
-- 🎯 根据实际标注文件名批量更新
-- ============================================
-- 基于CSV文件: Supabase Snippet 被打回记录标注人诊断 (2).csv
-- 在 Supabase Dashboard 的 SQL Editor 中运行

-- ============================================
-- 步骤 1: 先确认字段存在
-- ============================================
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;

-- ============================================
-- 步骤 2: 批量更新所有视频的标注文件名
-- ============================================

-- 第七批第一次改写
UPDATE videos SET annotation_file_name = '第七批第一次改写_语文-02.xlsx' WHERE id = 'upload_1765192794130';
UPDATE videos SET annotation_file_name = '第七批第一次改写_语文-01.xlsx' WHERE id = 'upload_1765192456302';
UPDATE videos SET annotation_file_name = '第七批第一次改写_英语-02.xlsx' WHERE id = 'upload_1765189766435';
UPDATE videos SET annotation_file_name = '第七批第一次改写_物理-02.xlsx' WHERE id = 'upload_1765188773242';
UPDATE videos SET annotation_file_name = '第七批第一次改写_英语-01.xlsx' WHERE id = 'upload_1765188466384';
UPDATE videos SET annotation_file_name = '第七批第一次改写_物理-01.xlsx' WHERE id = 'upload_1765187826694';
UPDATE videos SET annotation_file_name = '第七批第一次改写_数学-02.xlsx' WHERE id = 'upload_1765187305675';
UPDATE videos SET annotation_file_name = '第七批第一次改写_数学-01.xlsx' WHERE id = 'upload_1765186805117';

-- 第四批第二次改写
UPDATE videos SET annotation_file_name = '第四批第二次改写_物理-01.xlsx' WHERE id = 'upload_1765186116322';
UPDATE videos SET annotation_file_name = '第四批第二次改写_英语-01.xlsx' WHERE id = 'upload_1765185637648';
UPDATE videos SET annotation_file_name = '第四批第二次改写_语文-01.xlsx' WHERE id = 'upload_1765185298718';
UPDATE videos SET annotation_file_name = '第四批第二次改写_数学-01.xlsx' WHERE id = 'upload_1765183317816';

-- 第三批第二次改写
UPDATE videos SET annotation_file_name = '第三批第二次改写_语文-01.xlsx' WHERE id = 'upload_1765182833100';
UPDATE videos SET annotation_file_name = '第三批第二次改写_物理-01.xlsx' WHERE id = 'upload_1765182262981';
UPDATE videos SET annotation_file_name = '第三批第二次改写_英语-01.xlsx' WHERE id = 'upload_1765180042656';
UPDATE videos SET annotation_file_name = '第三批第二次改写_数学-01.xlsx' WHERE id = 'upload_1765176113030';

-- 第二批第二次改写
UPDATE videos SET annotation_file_name = '第二批第二次改写_英语-01.xlsx' WHERE id = 'upload_1765176976177';
UPDATE videos SET annotation_file_name = '第二批第二次改写_物理-01.xlsx' WHERE id = 'upload_1765175619575';
UPDATE videos SET annotation_file_name = '第二批第二次改写_英语-02' WHERE id = 'upload_1765173526722';
UPDATE videos SET annotation_file_name = '第二批第二次改写_语文-01' WHERE id = 'upload_1765172297836';

-- ============================================
-- 步骤 3: 验证更新结果
-- ============================================
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' THEN '❌ 未设置'
        ELSE '✅ 已设置'
    END AS "状态"
FROM videos
WHERE id IN (
    'upload_1765192794130',
    'upload_1765192456302',
    'upload_1765189766435',
    'upload_1765188773242',
    'upload_1765188466384',
    'upload_1765187826694',
    'upload_1765187305675',
    'upload_1765186805117',
    'upload_1765186116322',
    'upload_1765185637648',
    'upload_1765185298718',
    'upload_1765183317816',
    'upload_1765182833100',
    'upload_1765182262981',
    'upload_1765180042656',
    'upload_1765176976177',
    'upload_1765176113030',
    'upload_1765175619575',
    'upload_1765173526722',
    'upload_1765172297836'
)
ORDER BY created_at DESC;

-- ============================================
-- 步骤 4: 查看所有视频的标注文件名状态
-- ============================================
SELECT 
    COUNT(*) AS "总视频数",
    COUNT(annotation_file_name) AS "已设置标注文件名",
    COUNT(*) - COUNT(annotation_file_name) AS "未设置标注文件名"
FROM videos;

-- ============================================
-- ✅ 完成！
-- ============================================
-- 执行成功后，刷新质检管理页面，即可看到"标注文件名"列的数据

