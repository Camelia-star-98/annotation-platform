-- ===================================================================
-- 诊断为什么待质检数量这么高
-- ===================================================================

-- 1. 检查 "测试2" 的详细情况（总标注数376，待质检337）
SELECT 
    '=== 测试2 详细分析 ===' as 说明;

-- 找出测试2的 video_id
SELECT 
    id as 视频ID,
    name as 视频名称,
    annotation_file_name as 标注文件名
FROM videos
WHERE name LIKE '%测试2%'
LIMIT 5;

-- 2. 查看 "测试2" 的标注数据详情
-- 按 sentence_no 分组，看看每个句子有多少条标注
SELECT 
    '=== 测试2 按句子分组 ===' as 说明,
    a.sentence_no as 句子编号,
    COUNT(*) as 该句子的标注条数,
    COUNT(DISTINCT a.annotator) as 标注人数量,
    STRING_AGG(DISTINCT a.annotator, ', ') as 标注人列表,
    COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检数量,
    COUNT(CASE WHEN a.inspector IS NOT NULL AND a.inspector != '' THEN 1 END) as 已质检数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
GROUP BY a.sentence_no
ORDER BY 该句子的标注条数 DESC, a.sentence_no
LIMIT 20;

-- 3. 查看 "测试2" 有多少个唯一的句子
SELECT 
    '=== 测试2 统计摘要 ===' as 说明,
    COUNT(DISTINCT a.sentence_no) as 唯一句子数,
    COUNT(*) as 总标注条数,
    COUNT(DISTINCT a.annotator) as 唯一标注人数
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%';

-- 4. 检查是否有同一个句子被同一个标注人标注了多次
SELECT 
    '=== 测试2 重复标注检查 ===' as 说明,
    a.sentence_no as 句子编号,
    a.annotator as 标注人,
    COUNT(*) as 重复次数,
    STRING_AGG(a.id, ', ') as 标注ID列表
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
GROUP BY a.sentence_no, a.annotator
HAVING COUNT(*) > 1
ORDER BY 重复次数 DESC
LIMIT 20;

-- 5. 查看 "第二轮英语-2" 的情况（总标注数316，待质检316）
SELECT 
    '=== 第二轮英语-2 详细分析 ===' as 说明;

SELECT 
    COUNT(DISTINCT a.sentence_no) as 唯一句子数,
    COUNT(*) as 总标注条数,
    COUNT(DISTINCT a.annotator) as 唯一标注人数,
    COUNT(CASE WHEN (a.inspector IS NULL OR a.inspector = '') THEN 1 END) as 待质检数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%第二轮英语-2%';

-- 6. 检查所有视频的标注人数量分布
SELECT 
    '=== 所有视频的标注人数量 ===' as 说明,
    v.name as 视频名称,
    COUNT(DISTINCT a.annotator) as 标注人数量,
    COUNT(DISTINCT a.sentence_no) as 唯一句子数,
    COUNT(*) as 总标注条数,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT a.sentence_no), 0), 2) as 平均每句标注次数
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''
GROUP BY v.id, v.name
ORDER BY 总标注条数 DESC
LIMIT 20;

-- 7. 检查是否存在 annotator 为空或异常的情况
SELECT 
    '=== 标注人字段检查 ===' as 说明,
    CASE 
        WHEN a.annotator IS NULL THEN 'NULL'
        WHEN a.annotator = '' THEN '空字符串'
        WHEN a.annotator = 'unknown' THEN 'unknown'
        ELSE '正常'
    END as 标注人状态,
    COUNT(*) as 数量
FROM annotations a
GROUP BY 标注人状态
ORDER BY 数量 DESC;

-- 8. 随机抽查几条 "测试2" 的标注数据
SELECT 
    '=== 测试2 数据样本 ===' as 说明,
    a.id,
    a.sentence_no as 句子编号,
    a.annotator as 标注人,
    LEFT(a.human_annotated_text, 30) as 人工标注文本前30字,
    a.inspector as 质检人,
    a.is_qualified as 是否合格,
    a.status as 状态
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
ORDER BY a.sentence_no, a.annotator
LIMIT 30;

