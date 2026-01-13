-- 检查 annotations 表的列结构
SELECT 
    column_name as "列名",
    data_type as "数据类型",
    is_nullable as "可空",
    column_default as "默认值"
FROM information_schema.columns
WHERE table_name = 'annotations'
ORDER BY ordinal_position;

-- 特别检查是否有 updated_at 列
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'annotations' AND column_name = 'updated_at'
        )
        THEN '✅ annotations 表有 updated_at 列'
        ELSE '❌ annotations 表没有 updated_at 列'
    END as "updated_at 列检查";

-- 检查 videos 表是否有 updated_at 列
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'videos' AND column_name = 'updated_at'
        )
        THEN '✅ videos 表有 updated_at 列'
        ELSE '❌ videos 表没有 updated_at 列'
    END as "updated_at 列检查";



