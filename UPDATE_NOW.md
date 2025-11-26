# 🚀 立即更新到 Supabase 后端

## ⚡ 快速更新步骤（3步完成）

### 第1步：更新 Supabase 数据库（必须手动执行）

**重要：这一步必须在 Supabase 控制台手动执行！**

1. 打开浏览器，访问：https://supabase.com
2. 登录并选择您的项目
3. 点击左侧菜单 **SQL Editor**
4. 点击 **New query** 按钮
5. 打开项目中的 `UPDATE_DATABASE_TO_LATEST.sql` 文件
6. **复制全部内容**（Ctrl+A / Cmd+A，然后 Ctrl+C / Cmd+C）
7. 粘贴到 Supabase SQL Editor 中
8. 点击 **Run** 按钮（或按 `Ctrl+Enter` / `Cmd+Enter`）
9. 等待执行完成，应该看到 "Success" 提示

**验证：** 执行后，在 SQL Editor 中运行：
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'annotations' 
AND column_name IN ('reviewer', 'review_status', 'is_qualified', 'inspector');
```
应该能看到这些字段。

---

### 第2步：配置环境变量

#### 本地开发环境

1. 在项目根目录创建 `.env.local` 文件（如果还没有）
2. 添加以下内容：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**获取凭证：**
- Supabase 控制台 → **Settings** → **API**
- 复制 **Project URL** 和 **anon public** key

#### Vercel 生产环境

1. 访问：https://vercel.com
2. 选择您的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加两个变量：
   - `VITE_SUPABASE_URL` = 您的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 您的 anon key
5. 选择所有环境（Production, Preview, Development）
6. 点击 **Save**

---

### 第3步：提交并部署代码

#### 方式1：使用更新脚本（推荐）

```bash
./update_to_supabase.sh "更新到 Supabase 后端"
```

#### 方式2：手动提交

```bash
# 添加所有更改
git add .

# 提交
git commit -m "更新到 Supabase 后端"

# 推送到远程仓库
git push origin main
```

#### 方式3：使用部署脚本

```bash
./deploy.sh "更新到 Supabase 后端"
```

**Vercel 会自动部署**，等待 1-2 分钟后访问网站即可。

---

## ✅ 验证更新

1. **检查环境变量**
   - 打开浏览器控制台（F12）
   - 应该看到：`✅ Supabase 客户端已初始化`

2. **测试功能**
   - 上传视频和标注数据
   - 在 Supabase 控制台 → **Table Editor** 查看数据
   - 测试标注、质检、复检功能

3. **检查数据库**
   - Supabase 控制台 → **Table Editor**
   - 确认 `annotations` 表有 `reviewer`、`review_status` 等字段
   - 确认 `problem_categories` 表已创建

---

## 🔍 常见问题

### ❌ 数据库更新失败
- 检查 SQL 脚本是否完整复制
- 确认表已存在（如果表不存在，需要先创建基础表）
- 查看 Supabase SQL Editor 的错误信息

### ❌ 环境变量未生效
- 确认 `.env.local` 文件在项目根目录
- 重启开发服务器（`npm run dev`）
- 在 Vercel 中确认环境变量已保存

### ❌ 构建失败
- 运行 `npm install` 安装依赖
- 检查代码是否有语法错误
- 查看构建日志中的错误信息

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. `DEPLOY_TO_SUPABASE.md` - 详细部署指南
2. `QUICK_DEPLOY_CHECKLIST.md` - 快速检查清单
3. `UPDATE_DATABASE_TO_LATEST.sql` - 数据库更新脚本

---

**🎉 完成以上步骤后，您的标注平台就成功更新到 Supabase 后端了！**

