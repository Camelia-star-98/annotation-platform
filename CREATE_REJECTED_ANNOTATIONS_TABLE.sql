-- =========================================
-- 创建 rejected_annotations 表
-- 用于记录所有被质检打回的标注数据
-- =========================================

-- 1. 创建 rejected_annotations 表
CREATE TABLE IF NOT EXISTS rejected_annotations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- 原始标注记录ID（关联到 annotations 表）
  annotation_id TEXT NOT NULL,
  
  -- 视频信息
  video_id TEXT NOT NULL,
  video_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  
  -- 标注内容（被打回时的数据快照）
  sentence_no INTEGER NOT NULL,
  time_range TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  original_text TEXT NOT NULL,
  ai_rewritten_text TEXT NOT NULL,
  human_annotated_text TEXT NOT NULL,
  major_category TEXT DEFAULT '',
  minor_category TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  
  -- 标注人和质检人信息
  annotator TEXT NOT NULL,
  inspector TEXT NOT NULL,
  
  -- 打回信息
  rejection_reason TEXT DEFAULT '', -- 打回原因
  rejection_count INTEGER DEFAULT 1, -- 这是第几次被打回
  is_resubmitted BOOLEAN DEFAULT false, -- 是否已重新提交
  new_annotation_id TEXT, -- 重新提交后生成的新记录ID
  
  -- 时间戳
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resubmitted_at TIMESTAMP WITH TIME ZONE
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_rejected_annotations_video_id ON rejected_annotations(video_id);
CREATE INDEX IF NOT EXISTS idx_rejected_annotations_annotator ON rejected_annotations(annotator);
CREATE INDEX IF NOT EXISTS idx_rejected_annotations_annotation_id ON rejected_annotations(annotation_id);
CREATE INDEX IF NOT EXISTS idx_rejected_annotations_rejected_at ON rejected_annotations(rejected_at);
CREATE INDEX IF NOT EXISTS idx_rejected_annotations_is_resubmitted ON rejected_annotations(is_resubmitted);

-- 3. 启用 RLS (Row Level Security)
ALTER TABLE rejected_annotations ENABLE ROW LEVEL SECURITY;

-- 4. 创建访问策略（所有人都可以查看所有被打回的数据）
CREATE POLICY "所有人可以查看被打回数据"
  ON rejected_annotations
  FOR SELECT
  USING (true);

CREATE POLICY "质检人可以插入被打回数据"
  ON rejected_annotations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "系统可以更新被打回数据"
  ON rejected_annotations
  FOR UPDATE
  USING (true);

-- 5. 添加注释
COMMENT ON TABLE rejected_annotations IS '记录所有被质检打回的标注数据，所有标注人可见';
COMMENT ON COLUMN rejected_annotations.annotation_id IS '原始标注记录ID';
COMMENT ON COLUMN rejected_annotations.rejection_reason IS '质检人填写的打回原因';
COMMENT ON COLUMN rejected_annotations.rejection_count IS '这是第几次被打回（累计次数）';
COMMENT ON COLUMN rejected_annotations.is_resubmitted IS '是否已重新提交修改';
COMMENT ON COLUMN rejected_annotations.new_annotation_id IS '重新提交后生成的新记录ID';

-- =========================================
-- 迁移现有数据（可选）
-- 将现有 annotations 表中被打回的数据迁移到 rejected_annotations
-- =========================================

INSERT INTO rejected_annotations (
  annotation_id,
  video_id,
  video_name,
  subject,
  sentence_no,
  time_range,
  start_time,
  end_time,
  original_text,
  ai_rewritten_text,
  human_annotated_text,
  major_category,
  minor_category,
  remark,
  annotator,
  inspector,
  rejection_count,
  is_resubmitted,
  rejected_at
)
SELECT 
  a.id as annotation_id,
  a.video_id,
  v.name as video_name,
  v.subject,
  a.sentence_no,
  a.time_range,
  a.start_time,
  a.end_time,
  a.original_text,
  a.ai_rewritten_text,
  a.human_annotated_text,
  a.major_category,
  a.minor_category,
  a.remark,
  a.annotator,
  a.inspector,
  COALESCE(a.rejection_count, 1) as rejection_count,
  false as is_resubmitted,
  a.updated_at as rejected_at
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE a.is_qualified = false 
  AND a.inspector IS NOT NULL 
  AND a.inspector != ''
ON CONFLICT (id) DO NOTHING;

-- 完成提示
SELECT 
  '✅ rejected_annotations 表创建成功！' as status,
  COUNT(*) as migrated_records
FROM rejected_annotations;
