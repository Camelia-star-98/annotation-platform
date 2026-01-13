-- 检查 videos 表的列结构
SELECT 
    column_name as "列名",
    data_type as "数据类型",
    is_nullable as "可空",
    column_default as "默认值"
FROM information_schema.columns
WHERE table_name = 'videos'
ORDER BY ordinal_position;



