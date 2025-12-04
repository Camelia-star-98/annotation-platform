-- =========================================
-- Supabase 数据库完整更新脚本
-- 请在 Supabase SQL Editor 中执行此脚本
-- =========================================

-- =========================================
-- 1. 更新 videos 表结构
-- =========================================

-- 添加 required_annotators 字段（待标注数量）
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS required_annotators INTEGER DEFAULT 1;

-- 添加 is_published 字段（是否发布）
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- 添加 is_completed 字段（是否完成所有流程）
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- 添加 review_completed_at 字段（复检完成时间）
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMP WITH TIME ZONE;

-- 添加注释
COMMENT ON COLUMN videos.required_annotators IS '待标注数量';
COMMENT ON COLUMN videos.is_published IS '是否发布';
COMMENT ON COLUMN videos.is_completed IS '是否完成所有流程：教研标注 → 抽样质检 → 产品复检';
COMMENT ON COLUMN videos.review_completed_at IS '复检完成时间';

-- =========================================
-- 2. 更新 annotations 表结构
-- =========================================

-- 添加 is_qualified 字段（质检是否通过）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN;

-- 添加 inspector 字段（质检人）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS inspector TEXT;

-- 添加 reviewer 字段（复检人）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS reviewer TEXT;

-- 添加 review_status 字段（复检状态）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS review_status BOOLEAN DEFAULT NULL;

-- 添加 video_name 字段（冗余字段，提高查询性能）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS video_name TEXT;

-- 添加 video_url 字段（冗余字段，提高查询性能）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 添加 subject 字段（冗余字段，提高查询性能）
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS subject TEXT;

-- 添加注释
COMMENT ON COLUMN annotations.is_qualified IS '质检是否通过：true=通过，false=不通过，null=待质检';
COMMENT ON COLUMN annotations.inspector IS '质检人姓名';
COMMENT ON COLUMN annotations.reviewer IS '复检人姓名';
COMMENT ON COLUMN annotations.review_status IS '复检状态：true=通过，false=不通过，null=待复检';

-- =========================================
-- 3. 创建 problem_categories 表（问题分类表）
-- =========================================

CREATE TABLE IF NOT EXISTS problem_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_category TEXT NOT NULL,
  minor_category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(major_category, minor_category)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_problem_categories_major 
  ON problem_categories(major_category);

CREATE INDEX IF NOT EXISTS idx_problem_categories_minor 
  ON problem_categories(minor_category);

-- 插入默认分类数据
INSERT INTO problem_categories (major_category, minor_category) VALUES
  ('大班课话术改写问题', '出现"讲义"和具体页数'),
  ('大班课话术改写问题', '出现评论区话术'),
  ('大班课话术改写问题', '出现互动话术'),
  ('大班课话术改写问题', '人称代词改错'),
  ('大班课话术改写问题', '出现具体姓名或网名'),
  ('大班课话术改写问题', '举例子内容误改成个性化'),
  
  ('asr识别问题', '老师说话不清晰'),
  ('asr识别问题', '人工个性化改写'),
  ('asr识别问题', '需要删除'),
  ('asr识别问题', '测试大类')
ON CONFLICT (major_category, minor_category) DO NOTHING;

-- =========================================
-- 4. 创建 annotation_completions 表（标注完成跟踪表）
-- =========================================

CREATE TABLE IF NOT EXISTS annotation_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  annotator_name TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  annotation_count INTEGER DEFAULT 0,
  UNIQUE(video_id, annotator_name),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_annotation_completions_video_id 
  ON annotation_completions(video_id);

CREATE INDEX IF NOT EXISTS idx_annotation_completions_annotator 
  ON annotation_completions(annotator_name);

-- =========================================
-- 5. 添加必要的索引
-- =========================================

-- annotations 表索引
CREATE INDEX IF NOT EXISTS idx_annotations_video_id ON annotations(video_id);
CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status);
CREATE INDEX IF NOT EXISTS idx_annotations_annotator ON annotations(annotator);
CREATE INDEX IF NOT EXISTS idx_annotations_review_status ON annotations(review_status);
CREATE INDEX IF NOT EXISTS idx_annotations_is_qualified ON annotations(is_qualified);

-- =========================================
-- 6. 配置 RLS（行级安全）策略
-- =========================================

-- 禁用 RLS（开发阶段，允许所有操作）
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- problem_categories 表 RLS 策略
ALTER TABLE problem_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允许所有人查看分类" ON problem_categories;
CREATE POLICY "允许所有人查看分类" 
  ON problem_categories FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "允许所有人插入分类" ON problem_categories;
CREATE POLICY "允许所有人插入分类" 
  ON problem_categories FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "允许所有人更新分类" ON problem_categories;
CREATE POLICY "允许所有人更新分类" 
  ON problem_categories FOR UPDATE 
  USING (true);

DROP POLICY IF EXISTS "允许所有人删除分类" ON problem_categories;
CREATE POLICY "允许所有人删除分类" 
  ON problem_categories FOR DELETE 
  USING (true);

-- annotation_completions 表 RLS 策略
ALTER TABLE annotation_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "允许所有人查看完成记录" ON annotation_completions;
CREATE POLICY "允许所有人查看完成记录" 
  ON annotation_completions FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "允许所有人插入完成记录" ON annotation_completions;
CREATE POLICY "允许所有人插入完成记录" 
  ON annotation_completions FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "允许所有人更新完成记录" ON annotation_completions;
CREATE POLICY "允许所有人更新完成记录" 
  ON annotation_completions FOR UPDATE 
  USING (true);

DROP POLICY IF EXISTS "允许所有人删除完成记录" ON annotation_completions;
CREATE POLICY "允许所有人删除完成记录" 
  ON annotation_completions FOR DELETE 
  USING (true);

-- =========================================
-- 7. 验证表结构
-- =========================================

-- 查看 videos 表结构
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos'
ORDER BY ordinal_position;

-- 查看 annotations 表结构
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'annotations'
AND column_name IN ('is_qualified', 'inspector', 'reviewer', 'review_status', 'video_name', 'video_url', 'subject')
ORDER BY ordinal_position;

-- 查看 problem_categories 表
SELECT COUNT(*) as category_count FROM problem_categories;

-- 查看 annotation_completions 表
SELECT COUNT(*) as completion_count FROM annotation_completions;

-- =========================================
-- ✅ 更新完成！
-- =========================================
-- 如果上面的查询都正常返回，说明数据库更新成功
-- 接下来可以：
-- 1. 配置环境变量（.env.local）
-- 2. 构建并部署前端代码
-- =========================================

