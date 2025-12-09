-- ===================================================================
-- 检查 annotator 为空值的情况
-- ===================================================================

-- 1. 统计 annotator 为空的记录数量
SELECT 
    '=== annotator 空值统计 ===' as 说明,
    COUNT(*) as 空值记录总数,
    COUNT(DISTINCT video_id) as 涉及的视频数量
FROM annotations
WHERE annotator IS NULL OR annotator = '';

-- 2. 按视频统计空值标注
SELECT 
    '=== 各视频的空值标注数量 ===' as 说明,
    v.name as 视频名称,
    COUNT(*) as 空值标注数量,
    COUNT(DISTINCT a.sentence_no) as 涉及的句子数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE a.annotator IS NULL OR a.annotator = ''
GROUP BY v.id, v.name
ORDER BY 空值标注数量 DESC;

-- 3. 查看 "测试2" 的空值标注详情
SELECT 
    '=== 测试2 空值标注详情 ===' as 说明,
    a.id,
    a.sentence_no as 句子编号,
    a.annotator as 标注人,
    LEFT(a.human_annotated_text, 50) as 人工标注文本,
    a.inspector as 质检人,
    a.is_qualified as 是否合格,
    a.status as 状态,
    a.created_at as 创建时间
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
  AND (a.annotator IS NULL OR a.annotator = '')
ORDER BY a.sentence_no
LIMIT 30;

-- 4. 对比：测试2 有无空值标注的统计
SELECT 
    '=== 测试2 数据对比 ===' as 说明;

-- 包含空值的统计
SELECT 
    '包含空值' as 类型,
    COUNT(*) as 总标注数,
    COUNT(DISTINCT sentence_no) as 唯一句子数,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as 待质检数量,
    COUNT(DISTINCT annotator) as 标注人数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
  AND a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''

UNION ALL

-- 排除空值的统计
SELECT 
    '排除空值' as 类型,
    COUNT(*) as 总标注数,
    COUNT(DISTINCT sentence_no) as 唯一句子数,
    COUNT(CASE WHEN (inspector IS NULL OR inspector = '') THEN 1 END) as 待质检数量,
    COUNT(DISTINCT annotator) as 标注人数量
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
  AND a.status = true
  AND a.human_annotated_text IS NOT NULL
  AND TRIM(a.human_annotated_text) != ''
  AND a.annotator IS NOT NULL 
  AND a.annotator != '';

-- 5. 检查空值标注的创建时间
SELECT 
    '=== 空值标注的创建时间分布 ===' as 说明,
    DATE(a.created_at) as 创建日期,
    COUNT(*) as 记录数量,
    COUNT(DISTINCT a.video_id) as 涉及视频数
FROM annotations a
WHERE a.annotator IS NULL OR a.annotator = ''
GROUP BY DATE(a.created_at)
ORDER BY 创建日期 DESC;

-- 6. 查看 "测试2" 每个句子的标注人分布（包括空值）
SELECT 
    '=== 测试2 每个句子的标注人 ===' as 说明,
    a.sentence_no as 句子编号,
    COALESCE(a.annotator, '【空值】') as 标注人,
    COUNT(*) as 记录数,
    MAX(a.created_at) as 最后创建时间
FROM videos v
INNER JOIN annotations a ON v.id = a.video_id
WHERE v.name LIKE '%测试2%'
GROUP BY a.sentence_no, a.annotator
ORDER BY a.sentence_no, 标注人;

