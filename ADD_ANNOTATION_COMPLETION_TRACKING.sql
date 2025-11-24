image.png-- 添加标注完成跟踪表
-- 用于记录每个标注人对每个视频的标注完成状态

-- 1. 创建标注完成记录表
CREATE TABLE IF NOT EXISTS annotation_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  annotator_name TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  annotation_count INTEGER DEFAULT 0,
  UNIQUE(video_id, annotator_name),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- 2. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_annotation_completions_video_id 
  ON annotation_completions(video_id);

CREATE INDEX IF NOT EXISTS idx_annotation_completions_annotator 
  ON annotation_completions(annotator_name);

-- 3. 添加 RLS 策略（允许所有操作）
ALTER TABLE annotation_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人查看完成记录" 
  ON annotation_completions FOR SELECT 
  USING (true);

CREATE POLICY "允许所有人插入完成记录" 
  ON annotation_completions FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "允许所有人更新完成记录" 
  ON annotation_completions FOR UPDATE 
  USING (true);

CREATE POLICY "允许所有人删除完成记录" 
  ON annotation_completions FOR DELETE 
  USING (true);

-- 4. 插入测试数据（可选）
-- INSERT INTO annotation_completions (video_id, annotator_name, annotation_count) 
-- VALUES ('test_video_1', '张三', 10);

