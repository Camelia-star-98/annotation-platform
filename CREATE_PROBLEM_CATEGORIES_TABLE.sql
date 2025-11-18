-- 创建问题分类表
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
  
  ('缩略删除', '缩略词加字'),
  ('缩略删除', '把asr对的改错的，影响句意'),
  ('缩略删除', '人称代词改错'),
  ('缩略删除', '出现具体姓名或网名'),
  ('缩略删除', '英文单词识别错误'),
  ('缩略删除', '开头出现数字序号'),
  ('缩略删除', '识别多字'),
  ('缩略删除', '同音字识别错，不影响句意'),
  ('缩略删除', '单字动词重复'),
  ('缩略删除', '评论区互动'),
  
  ('asr识别问题', '老师说话不清晰'),
  ('asr识别问题', '人工个性化改写'),
  ('asr识别问题', '需要删除'),
  ('asr识别问题', '测试大类')
ON CONFLICT (major_category, minor_category) DO NOTHING;

-- 添加 RLS 策略
ALTER TABLE problem_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人查看分类" 
  ON problem_categories FOR SELECT 
  USING (true);

CREATE POLICY "允许所有人插入分类" 
  ON problem_categories FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "允许所有人更新分类" 
  ON problem_categories FOR UPDATE 
  USING (true);

CREATE POLICY "允许所有人删除分类" 
  ON problem_categories FOR DELETE 
  USING (true);

