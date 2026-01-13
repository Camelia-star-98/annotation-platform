-- ===================================================================
-- 修复 RPC 函数：移除 updated_at 字段引用
-- 原因：annotations 表已经没有 updated_at 字段
-- ===================================================================

-- 1. 先删除旧函数
DROP FUNCTION IF EXISTS get_all_annotations();

-- 2. 创建新的 RPC 函数（不包含 updated_at）
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
  created_at timestamp with time zone
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
    created_at
  FROM annotations
  WHERE annotator IS NOT NULL
    AND annotator != ''
    AND annotator != 'unknown'
  ORDER BY created_at DESC;
$$;

-- 3. 授权给 anon 和 authenticated 角色
GRANT EXECUTE ON FUNCTION get_all_annotations() TO anon;
GRANT EXECUTE ON FUNCTION get_all_annotations() TO authenticated;

-- 4. 测试查询
SELECT 
  '=== 测试修复后的 RPC 函数 ===' as 说明,
  COUNT(*) as 总数,
  COUNT(DISTINCT video_id) as 视频数,
  COUNT(DISTINCT annotator) as 标注人数
FROM get_all_annotations();

-- 5. 查看前5条数据确认
SELECT 
  '=== 前5条数据 ===' as 说明,
  video_id,
  sentence_no,
  annotator,
  created_at,
  LEFT(human_annotated_text, 30) as 标注文本
FROM get_all_annotations()
LIMIT 5;



