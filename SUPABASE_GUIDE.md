# Supabase 后端集成指南

## 1. 创建Supabase项目

### 注册账号
1. 访问：https://supabase.com
2. 点击 "Start your project"
3. 使用GitHub账号登录（免费）

### 创建新项目
1. 点击 "New Project"
2. 填写项目信息：
   - Name: `annotation-platform`
   - Database Password: 设置一个密码（记住它！）
   - Region: 选择 `Southeast Asia (Singapore)` 或 `Northeast Asia (Tokyo)`
3. 点击 "Create new project"
4. 等待1-2分钟项目创建完成

---

## 2. 创建数据表

在Supabase控制台，进入 **SQL Editor**，执行以下SQL：

```sql
-- 创建视频表
CREATE TABLE videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  subject TEXT,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建标注数据表
CREATE TABLE annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户表
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('annotator', 'inspector', 'reviewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_annotations_video_id ON annotations(video_id);
CREATE INDEX idx_annotations_status ON annotations(status);

-- 启用行级安全（RLS）- 开发阶段可以先禁用
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

---

## 3. 获取API凭证

在Supabase控制台：
1. 点击左侧 **Settings** → **API**
2. 找到并复制：
   - `Project URL` (例如：https://xxxxx.supabase.co)
   - `anon public` key

---

## 4. 配置存储桶（用于视频文件）

1. 进入 **Storage**
2. 点击 "Create a new bucket"
3. Bucket名称：`videos`
4. Public bucket: 勾选（允许公开访问）
5. 点击 "Create bucket"

---

## 5. 前端集成

### 安装依赖
```bash
npm install @supabase/supabase-js
```

### 创建配置文件
在项目中创建 `.env.local` 文件：

```env
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的anon key
```

### 创建Supabase客户端
创建文件 `src/api/supabase.ts`

---

## 6. 使用说明

集成后，你的标注平台将拥有：

✅ **数据持久化** - 标注数据保存到云数据库
✅ **文件上传** - 视频文件存储到云端
✅ **实时同步** - 多人协作时数据实时更新
✅ **完全免费** - Supabase免费版足够使用

---

## 7. 费用说明

**免费额度（永久免费）：**
- 500MB 数据库存储
- 1GB 文件存储
- 2GB 数据传输/月
- 50,000 次请求/月

对于测试和小规模使用完全足够！

---

## 8. 快速测试

集成完成后，可以通过Supabase控制台的 **Table Editor** 直接查看和编辑数据。

