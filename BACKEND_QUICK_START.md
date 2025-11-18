# 🚀 5分钟快速集成Supabase后端

## 📋 准备工作

### 1. 注册Supabase账号（2分钟）

1. 访问：https://supabase.com
2. 点击 **"Start your project"**
3. 使用GitHub账号登录（免费）
4. 验证邮箱

### 2. 创建项目（1分钟）

1. 点击 **"New Project"**
2. 选择组织（如果是第一次，先创建组织）
3. 填写信息：
   ```
   Name: annotation-platform
   Database Password: 输入密码并记住（例如：Admin123456!）
   Region: Southeast Asia (Singapore) 或 Northeast Asia (Tokyo)
   ```
4. 点击 **"Create new project"**
5. ⏱️ 等待1-2分钟项目初始化

---

## 💾 创建数据库（1分钟）

### 执行SQL

1. 项目创建完成后，点击左侧 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制以下SQL，粘贴到编辑器：

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

-- 创建索引
CREATE INDEX idx_annotations_video_id ON annotations(video_id);
CREATE INDEX idx_annotations_status ON annotations(status);

-- 禁用RLS（开发阶段）
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
```

4. 点击 **"Run"** 或按 `Ctrl+Enter`
5. 看到 **"Success"** 提示即可

---

## 📦 配置存储桶（30秒）

### 创建视频存储

1. 点击左侧 **"Storage"**
2. 点击 **"Create a new bucket"**
3. 填写信息：
   ```
   Name: videos
   Public bucket: ✅ 勾选（允许公开访问）
   ```
4. 点击 **"Create bucket"**

---

## 🔑 获取API凭证（30秒）

1. 点击左侧 **"Settings"** → **"API"**
2. 找到以下信息并复制：

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIs...（很长的字符串）
```

---

## ⚙️ 配置前端（30秒）

### 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
cd /Users/ailian/Downloads/annotation-platform
cp .env.local.example .env.local
```

然后编辑 `.env.local`，填入你的信息：

```env
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon_key
```

**⚠️ 重要**：填入你刚才复制的URL和Key！

---

## ✅ 测试连接

### 启动项目

```bash
npm run dev
```

### 验证

1. 打开浏览器控制台（F12）
2. 看看是否有Supabase相关错误
3. 如果配置正确，不会有报错

---

## 🎉 完成！

现在你的标注平台已经连接到云端后端！

### 可以做什么？

- ✅ 标注数据会保存到云端数据库
- ✅ 视频可以上传到云端存储
- ✅ 多人可以同时使用（数据共享）
- ✅ 数据永久保存（不会丢失）

### 如何查看数据？

1. 进入Supabase控制台
2. 点击 **"Table Editor"**
3. 选择 `videos` 或 `annotations` 表
4. 就能看到所有数据！

---

## 📊 监控使用情况

在Supabase控制台首页，可以看到：
- 数据库大小
- 存储使用量
- API请求次数
- 带宽使用

**免费额度**：
- 500MB 数据库
- 1GB 文件存储
- 50K 请求/月

对于测试完全够用！

---

## 🆘 遇到问题？

### 常见问题

**Q: 提示 "Invalid API key"**
A: 检查 `.env.local` 文件中的Key是否正确复制

**Q: 数据保存失败**
A: 确认SQL已成功执行，表已创建

**Q: 视频上传失败**
A: 确认Storage中的 `videos` bucket已创建且设为public

**Q: 控制台找不到数据**
A: 等待几秒刷新，或检查Table Editor中的表

---

## 🎯 下一步

完成后端集成后，建议：

1. **测试上传** - 上传一个视频和Excel，看看数据是否保存
2. **查看数据** - 在Supabase控制台查看保存的数据
3. **多设备测试** - 在不同设备上打开，验证数据同步

---

**预计总用时：5分钟** ⏱️

就是这么简单！🎊

