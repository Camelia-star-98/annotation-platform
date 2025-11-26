# ✅ 快速部署检查清单

## 🎯 更新到 Supabase 后端的步骤

### 第1步：更新数据库（5分钟）

1. ✅ 打开 Supabase 控制台：https://supabase.com
2. ✅ 选择项目：`annotation-platform`
3. ✅ 点击 **SQL Editor** → **New query**
4. ✅ 打开项目中的 `UPDATE_DATABASE_TO_LATEST.sql`
5. ✅ 复制全部内容，粘贴到 SQL Editor
6. ✅ 点击 **Run** 执行
7. ✅ 确认看到 "Success" 提示

---

### 第2步：配置环境变量（2分钟）

#### 本地开发环境

1. ✅ 在项目根目录创建 `.env.local` 文件
2. ✅ 添加以下内容（替换为您的实际值）：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**获取凭证：**
- Supabase 控制台 → **Settings** → **API**
- 复制 **Project URL** 和 **anon public** key

#### Vercel 生产环境

1. ✅ 访问：https://vercel.com
2. ✅ 选择项目 → **Settings** → **Environment Variables**
3. ✅ 添加：
   - `VITE_SUPABASE_URL` = 您的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 您的 anon key
4. ✅ 选择所有环境（Production, Preview, Development）
5. ✅ 点击 **Save**

---

### 第3步：构建和部署（3分钟）

#### 方式1：使用 Git 自动部署（推荐）

```bash
# 1. 提交代码
git add .
git commit -m "更新到 Supabase 后端"
git push origin main

# 2. Vercel 会自动部署（等待 1-2 分钟）
```

#### 方式2：使用部署脚本

```bash
chmod +x deploy.sh
./deploy.sh "更新到 Supabase 后端"
```

#### 方式3：手动构建测试

```bash
# 本地测试
npm run dev

# 构建生产版本
npm run build
```

---

### 第4步：验证部署（2分钟）

1. ✅ 打开部署后的网站
2. ✅ 打开浏览器控制台（F12）
3. ✅ 应该看到：
   ```
   ✅ Supabase 客户端已初始化
   📍 Supabase URL: https://xxxxx.supabase.co
   ```

4. ✅ 测试功能：
   - 上传视频和标注数据
   - 在 Supabase 控制台 → **Table Editor** 查看数据
   - 测试标注、质检、复检功能

---

## 🔍 常见问题

### ❌ 环境变量未生效
- 检查 `.env.local` 文件是否存在
- 确认变量名正确（`VITE_SUPABASE_URL`）
- 重启开发服务器
- 在 Vercel 中检查环境变量配置

### ❌ 数据库表不存在
- 确认已执行 `UPDATE_DATABASE_TO_LATEST.sql`
- 在 Supabase SQL Editor 中检查表是否存在

### ❌ 视频上传失败
- 在 Supabase → **Storage** 中创建 `videos` 存储桶
- 确保存储桶设置为 **Public**

---

## 📝 文件说明

- `UPDATE_DATABASE_TO_LATEST.sql` - 数据库更新脚本（必须执行）
- `DEPLOY_TO_SUPABASE.md` - 详细部署指南
- `.env.local` - 本地环境变量（需要创建，不会被 Git 提交）

---

## ✅ 完成标志

- [ ] 数据库已更新（执行了 SQL 脚本）
- [ ] 环境变量已配置（本地和 Vercel）
- [ ] 代码已部署
- [ ] 功能测试通过
- [ ] 数据能正常保存到 Supabase

---

**🎉 完成！您的标注平台现在已连接到 Supabase 后端！**

