-- ========================================
-- 检查 annotations 表的真实结构
-- ========================================

-- 查询1：查看 annotations 表的所有列和类型
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'annotations'
ORDER BY ordinal_position;

-- 查询2：查看 status 字段的实际值分布
SELECT 
    'status字段值分布' as report_section,
    status,
    COUNT(*) as count
FROM annotations
GROUP BY status
ORDER BY count DESC;

-- 查询3：查看所有字段的样例数据（前10条）
SELECT *
FROM annotations
ORDER BY created_at DESC
LIMIT 10;

-- 查询4：如果有 review_status 或类似字段，检查其值
SELECT 
    column_name
FROM information_schema.columns
WHERE table_name = 'annotations'
  AND column_name LIKE '%status%'
     OR column_name LIKE '%review%'
     OR column_name LIKE '%reject%'
     OR column_name LIKE '%approve%';

-- 检查 annotations 表的真实结构
-- ========================================

-- 查询1：查看 annotations 表的所有列和类型
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'annotations'
ORDER BY ordinal_position;

-- 查询2：查看 status 字段的实际值分布
SELECT 
    'status字段值分布' as report_section,
    status,
    COUNT(*) as count
FROM annotations
GROUP BY status
ORDER BY count DESC;

-- 查询3：查看所有字段的样例数据（前10条）
SELECT *
FROM annotations
ORDER BY created_at DESC
LIMIT 10;

-- 查询4：如果有 review_status 或类似字段，检查其值
SELECT 
    column_name
FROM information_schema.columns
WHERE table_name = 'annotations'
  AND column_name LIKE '%status%'
     OR column_name LIKE '%review%'
     OR column_name LIKE '%reject%'
     OR column_name LIKE '%approve%';

