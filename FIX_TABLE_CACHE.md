# 🔧 修复Supabase表缓存问题

## 问题原因
错误信息：`Could not find the table 'public.annotations' in the schema cache`

这意味着：
1. 表可能没有正确创建
2. 或者Supabase的缓存没有更新

---

## 解决方案

### 步骤1：在Supabase SQL Editor中执行以下SQL

登录 https://supabase.com → 项目 annotation-platform → SQL Editor

复制并执行以下完整的SQL：

```sql
-- 删除旧表（如果存在）
DROP TABLE IF EXISTS annotations CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 创建视频表
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  subject TEXT,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建标注数据表
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  sentence_no INTEGER NOT NULL,
  time_range TEXT,
  start_time INTEGER,
  end_time INTEGER,
  original_text TEXT,
  ai_rewritten_text TEXT,
  human_annotated_text TEXT,
  major_category TEXT,
  minor_category TEXT,
  remark TEXT,
  status BOOLEAN DEFAULT FALSE,
  annotator TEXT,
  is_qualified BOOLEAN,
  inspector TEXT,
  video_name TEXT,
  video_url TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('annotator', 'inspector', 'reviewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_annotations_video_id ON annotations(video_id);
CREATE INDEX idx_annotations_status ON annotations(status);
CREATE INDEX idx_annotations_qualified ON annotations(is_qualified);

-- 禁用RLS（行级安全）
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 插入测试数据
INSERT INTO videos (id, name, url, subject, duration) VALUES
  ('video1', '示例视频1', 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4', '物理', 596),
  ('video2', '示例视频2', 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4', '化学', 596);

INSERT INTO annotations (id, video_id, sentence_no, time_range, original_text, ai_rewritten_text, human_annotated_text, status, annotator) VALUES
  ('anno1', 'video1', 1, '00:00-00:05', '这是原文', '这是AI改写', '这是人工标注', true, '测试用户'),
  ('anno2', 'video1', 2, '00:05-00:10', '第二句原文', '第二句AI改写', '第二句人工标注', false, '测试用户');

-- 验证表已创建
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 验证数据
SELECT COUNT(*) as video_count FROM videos;
SELECT COUNT(*) as annotation_count FROM annotations;
```

### 步骤2：验证表已创建

执行SQL后，应该看到：
- ✅ Success
- 显示3个表：annotations, users, videos
- 2个视频，2条标注数据

### 步骤3：刷新Schema缓存

在Supabase控制台：
1. 点击左侧 **Table Editor**
2. 应该能看到3个表：annotations, users, videos
3. 如果看不到，刷新页面（Ctrl+R）

### 步骤4：重启前端服务器

```bash
# 在终端中按 Ctrl+C 停止服务器
# 然后重新启动：
npm run dev
```

### 步骤5：测试

1. 访问 http://localhost:3000/test-supabase
2. 应该显示"测试成功！"
3. 或访问 http://localhost:3000 测试标注功能

---

## 如果还是不行

### 方案A：检查表名

在SQL Editor执行：
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

看看实际的表名是什么。

### 方案B：使用JSON Server（临时方案）

如果Supabase一直有问题，可以先用JSON Server：

```bash
# 1. 禁用Supabase
mv .env.local .env.local.backup

# 2. 启动JSON Server（新终端）
npm run server

# 3. 启动前端（另一个终端）
npm run dev
```

这样可以先让功能正常使用。

---

请先执行步骤1的SQL，然后告诉我结果！

