-- ===================================================================
-- 创建或替换 RPC 函数：get_all_annotations（过滤空值标注人）
-- ===================================================================

-- 1. 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_all_annotations();

-- 2. 创建新的 RPC 函数
CREATE OR REPLACE FUNCTION get_all_annotations()
RETURNS TABLE (
  id text,
  video_id text,
  sentence_no integer,
  original_text text,
  ai_rewritten_text text,
  human_annotated_text text,
  major_category text,
  minor_category text,
  remark text,
  status boolean,
  annotator text,
  is_qualified boolean,
  inspector text,
  reviewer text,
  review_status boolean,
  rejection_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
AS $$
  SELECT 
    id,
    video_id,
    sentence_no,
    original_text,
    ai_rewritten_text,
    human_annotated_text,
    major_category,
    minor_category,
    remark,
    status,
    annotator,
    is_qualified,
    inspector,
    reviewer,
    review_status,
    rejection_count,
    created_at,
    updated_at
  FROM annotations
  WHERE annotator IS NOT NULL
    AND annotator != ''
    AND annotator != 'unknown'
  ORDER BY created_at DESC;
$$;

-- 3. 授权给 anon 和 authenticated 角色（如果需要）
GRANT EXECUTE ON FUNCTION get_all_annotations() TO anon;
GRANT EXECUTE ON FUNCTION get_all_annotations() TO authenticated;

-- 4. 测试查询（统计总数）
SELECT 
  '=== 测试 RPC 函数 ===' as 说明,
  COUNT(*) as 总数,
  COUNT(DISTINCT video_id) as 视频数,
  COUNT(DISTINCT annotator) as 标注人数
FROM get_all_annotations();

-- 5. 测试查询（查看前10条）
SELECT 
  '=== 前10条数据 ===' as 说明,
  video_id,
  sentence_no,
  annotator,
  LEFT(human_annotated_text, 30) as 标注文本前30字
FROM get_all_annotations()
LIMIT 10;

