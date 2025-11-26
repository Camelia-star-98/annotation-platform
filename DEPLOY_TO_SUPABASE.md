# 🚀 部署到 Supabase 后端指南

## 📋 步骤概览

1. ✅ 更新数据库结构（执行 SQL 脚本）
2. ✅ 配置环境变量
3. ✅ 构建前端代码
4. ✅ 部署到 Vercel（或您的部署平台）

---

## 第1步：更新 Supabase 数据库结构

### 1.1 登录 Supabase 控制台

1. 访问：https://supabase.com
2. 登录您的账号
3. 选择项目：`annotation-platform`

### 1.2 执行数据库更新脚本

1. 点击左侧菜单 **SQL Editor**
2. 点击 **New query**
3. 打开项目中的 `UPDATE_DATABASE_TO_LATEST.sql` 文件
4. 复制全部内容，粘贴到 SQL Editor
5. 点击 **Run** 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
6. 等待执行完成，应该看到 "Success" 提示

### 1.3 验证更新结果

执行脚本末尾的验证查询，确认：
- ✅ videos 表包含所有新字段
- ✅ annotations 表包含所有新字段
- ✅ problem_categories 表已创建
- ✅ annotation_completions 表已创建

---

## 第2步：配置环境变量

### 2.1 获取 Supabase API 凭证

在 Supabase 控制台：
1. 点击左侧 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**（例如：`https://xxxxx.supabase.co`）
   - **anon public** key

### 2.2 创建本地环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# Supabase 配置
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的anon key
```

**示例：**
```env
VITE_SUPABASE_URL=https://ybukjvugqulbonbqewow.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 配置 Vercel 环境变量（用于生产环境）

如果您使用 Vercel 部署：

1. 访问：https://vercel.com
2. 选择您的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加以下变量：
   - `VITE_SUPABASE_URL` = 您的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 您的 anon key
5. 选择环境：**Production**, **Preview**, **Development**
6. 点击 **Save**

---

## 第3步：构建前端代码

### 3.1 安装依赖（如果还没有）

```bash
npm install
```

### 3.2 本地测试

```bash
npm run dev
```

访问 http://localhost:5173，测试功能是否正常。

### 3.3 构建生产版本

```bash
npm run build
```

构建完成后，会在 `dist` 目录生成生产文件。

---

## 第4步：部署到 Vercel

### 方式1：使用 Git 自动部署（推荐）

如果您的项目已连接到 GitHub：

1. 提交代码到 Git：
   ```bash
   git add .
   git commit -m "更新到 Supabase 后端"
   git push origin main
   ```

2. Vercel 会自动检测并部署
3. 等待 1-2 分钟，访问部署的 URL

### 方式2：使用 Vercel CLI

```bash
# 安装 Vercel CLI（如果还没有）
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 方式3：使用部署脚本

项目已包含 `deploy.sh` 脚本：

```bash
chmod +x deploy.sh
./deploy.sh "更新到 Supabase 后端"
```

---

## 第5步：验证部署

### 5.1 检查环境变量

部署后，在浏览器控制台应该看到：
```
✅ Supabase 客户端已初始化
📍 Supabase URL: https://xxxxx.supabase.co
```

### 5.2 测试功能

1. **上传视频和标注数据**
   - 访问上传页面
   - 上传一个测试视频和 Excel 文件
   - 检查是否成功保存到 Supabase

2. **查看数据**
   - 在 Supabase 控制台 → **Table Editor**
   - 检查 `videos` 和 `annotations` 表是否有新数据

3. **测试其他功能**
   - 标注页面
   - 质检页面
   - 复检页面
   - 数据分析页面

---

## 🔧 故障排查

### 问题1：环境变量未生效

**症状：** 控制台显示 "❌ Supabase 环境变量缺失！"

**解决：**
- 检查 `.env.local` 文件是否存在
- 确认环境变量名称正确（`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`）
- 重启开发服务器
- 在 Vercel 中检查环境变量配置

### 问题2：数据库表不存在

**症状：** 错误信息包含 "Could not find the table"

**解决：**
- 确认已执行 `UPDATE_DATABASE_TO_LATEST.sql` 脚本
- 在 Supabase SQL Editor 中检查表是否存在
- 清除浏览器缓存并刷新

### 问题3：Storage 上传失败

**症状：** 视频上传失败

**解决：**
- 在 Supabase 控制台 → **Storage** 中创建 `videos` 存储桶
- 确保存储桶设置为 **Public**
- 检查 Storage 的 CORS 配置

### 问题4：RLS 策略错误

**症状：** 查询数据时提示权限错误

**解决：**
- 确认已执行 SQL 脚本中的 RLS 配置部分
- 检查 `UPDATE_DATABASE_TO_LATEST.sql` 中的 RLS 策略是否正确

---

## 📊 数据库表结构说明

### videos 表
- `id`: 视频ID（主键）
- `name`: 视频名称
- `url`: 视频URL
- `subject`: 科目
- `duration`: 时长（秒）
- `required_annotators`: 待标注数量
- `is_published`: 是否发布
- `is_completed`: 是否完成所有流程
- `review_completed_at`: 复检完成时间
- `created_at`: 创建时间

### annotations 表
- `id`: 标注ID（主键）
- `video_id`: 视频ID（外键）
- `sentence_no`: 句号
- `time_range`: 时间范围
- `start_time`: 开始时间
- `end_time`: 结束时间
- `original_text`: 原始文本
- `ai_rewritten_text`: AI改写文本
- `human_annotated_text`: 人工标注文本
- `major_category`: 大类
- `minor_category`: 小类
- `remark`: 备注
- `status`: 标注状态
- `annotator`: 标注人
- `is_qualified`: 质检是否通过
- `inspector`: 质检人
- `reviewer`: 复检人
- `review_status`: 复检状态
- `created_at`: 创建时间
- `updated_at`: 更新时间

### problem_categories 表
- `id`: 分类ID（主键）
- `major_category`: 大类
- `minor_category`: 小类
- `created_at`: 创建时间
- `updated_at`: 更新时间

### annotation_completions 表
- `id`: 记录ID（主键）
- `video_id`: 视频ID（外键）
- `annotator_name`: 标注人姓名
- `annotation_count`: 标注数量
- `completed_at`: 完成时间

---

## ✅ 完成检查清单

- [ ] 已执行 `UPDATE_DATABASE_TO_LATEST.sql` 脚本
- [ ] 已创建 `.env.local` 文件并配置环境变量
- [ ] 已在 Vercel 中配置环境变量（如果使用 Vercel）
- [ ] 已构建并测试本地版本
- [ ] 已部署到生产环境
- [ ] 已测试所有主要功能
- [ ] 已在 Supabase 控制台验证数据

---

## 🎉 完成！

如果所有步骤都已完成，您的标注平台现在应该已经成功连接到 Supabase 后端了！

如有任何问题，请检查：
1. Supabase 控制台的错误日志
2. 浏览器控制台的错误信息
3. Vercel 部署日志

