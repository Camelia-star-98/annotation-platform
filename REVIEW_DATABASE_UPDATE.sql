-- 在 Supabase SQL Editor 中执行以下 SQL

-- 1. 给 annotations 表添加复检人和复检状态字段
ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS reviewer VARCHAR(100),
ADD COLUMN IF NOT EXISTS review_status BOOLEAN DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN annotations.reviewer IS '复检人姓名';
COMMENT ON COLUMN annotations.review_status IS '复检状态：true=通过，false=不通过，null=待复检';

-- 2. 给 videos 表添加复检完成时间
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMP;

COMMENT ON COLUMN videos.review_completed_at IS '复检完成时间';

-- 3. 查看表结构确认
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'annotations' 
AND column_name IN ('reviewer', 'review_status')
ORDER BY ordinal_position;

-- 4. 查看 videos 表结构
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name IN ('is_completed', 'review_completed_at')
ORDER BY ordinal_position;

