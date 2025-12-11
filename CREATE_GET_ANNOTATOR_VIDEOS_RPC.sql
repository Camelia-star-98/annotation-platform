-- 创建函数：获取指定标注员的所有视频任务
-- 用于查看标注员工作详情

CREATE OR REPLACE FUNCTION get_annotator_videos(p_annotator TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    status TEXT,
    annotator TEXT,
    total_sentences INTEGER,
    annotated_sentences INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    is_published BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.status,
        v.annotator,
        v.total_sentences,
        v.annotated_sentences,
        v.created_at,
        v.updated_at,
        v.submitted_at,
        v.is_published
    FROM videos v
    WHERE v.annotator = p_annotator
    ORDER BY v.created_at DESC;
END;
$$;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_annotator_videos(TEXT) TO anon, authenticated;

-- 测试函数
-- SELECT * FROM get_annotator_videos('郭其其');

