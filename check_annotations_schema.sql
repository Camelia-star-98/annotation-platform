-- 查看 annotations 表结构
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'annotations'
ORDER BY ordinal_position;

-- 查看 annotations 表的前几条数据（看看字段内容）
SELECT 
    id,
    video_id,
    video_name,
    sentence_no,
    annotator,
    created_at
FROM annotations
LIMIT 5;
