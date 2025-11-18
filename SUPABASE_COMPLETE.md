# 🎉 Supabase配置完成！

## ✅ 已完成的配置

1. ✅ Supabase数据库表创建成功
   - videos（视频表）
   - annotations（标注数据表）
   - users（用户表）

2. ✅ API密钥已配置
   - Project URL: https://ybukjvugqulbonbqewow.supabase.co
   - 已保存到 `.env.local` 文件

3. ✅ 前端代码已更新
   - 自动检测并使用Supabase
   - 保留JSON Server作为备用

---

## 🔄 还需要完成的步骤

### 第1步：创建Storage存储桶（重要！）

在Supabase控制台操作：

1. 点击左侧 **📁 Storage** 菜单
2. 点击 **"Create a new bucket"** 按钮
3. 填写：
   ```
   Name: videos
   Public bucket: ✅ 必须勾选！
   ```
4. 点击 **"Create bucket"**

---

## 🎯 测试Supabase连接

服务器正在启动，等待10秒后：

### 测试步骤：

1. **访问主页**
   ```
   http://localhost:3000
   ```

2. **上传视频测试**
   - 点击"上传视频和标注数据"
   - 上传视频 + Excel
   - 查看是否保存成功

3. **验证数据**
   - 登录Supabase控制台
   - 点击 **Table Editor** → **annotations**
   - 应该能看到刚才上传的数据！

---

## 💾 数据存储位置

### 使用Supabase后
- ✅ 数据存储在云端PostgreSQL数据库
- ✅ 视频文件存储在Supabase Storage
- ✅ 支持多人协作
- ✅ 数据永久保存

### 之前使用JSON Server
- 数据存储在 `db.json` 本地文件
- 视频文件存储在本地
- 单人使用
- 重启后数据可能丢失

---

## 🔧 如何切换后端

### 当前配置（自动模式）

代码会自动检测：
- 如果 `.env.local` 中配置了Supabase → 使用Supabase
- 如果没有配置 → 使用JSON Server

### 强制使用JSON Server

临时删除或重命名 `.env.local` 文件：
```bash
mv .env.local .env.local.backup
```

### 恢复使用Supabase

恢复文件：
```bash
mv .env.local.backup .env.local
```

---

## 📊 查看数据

### 在Supabase控制台

1. 登录 https://supabase.com
2. 选择项目：annotation-platform
3. 点击 **Table Editor**
4. 选择表查看数据：
   - `videos` - 视频列表
   - `annotations` - 标注数据
   - `users` - 用户列表

### 使用SQL查询

在SQL Editor中执行：
```sql
-- 查看所有标注数据
SELECT * FROM annotations ORDER BY created_at DESC;

-- 查看所有视频
SELECT * FROM videos;

-- 查看待质检的数据
SELECT * FROM annotations WHERE status = true AND is_qualified IS NULL;

-- 查看质检通过的数据
SELECT * FROM annotations WHERE is_qualified = true;
```

---

## 🎊 优势对比

| 功能 | JSON Server | Supabase |
|------|-------------|----------|
| 数据持久化 | 本地文件 | 云端数据库 ✅ |
| 多人协作 | ❌ | ✅ |
| 备份恢复 | 手动 | 自动 ✅ |
| 访问速度 | 快（本地） | 稍慢（网络） |
| 容量限制 | 无限制 | 500MB免费 |
| 视频存储 | 本地 | 云端 ✅ |
| 数据安全 | 低 | 高 ✅ |

---

## ⚠️ 注意事项

### 1. Storage存储桶必须创建
如果没有创建 `videos` 存储桶，视频上传会失败！

### 2. Public bucket必须勾选
否则无法访问上传的视频！

### 3. 免费额度
- 数据库：500MB
- 存储：1GB
- 带宽：2GB/月
- 足够测试和小规模使用

### 4. 数据迁移
如果之前用JSON Server，可以导入数据到Supabase

---

## 🐛 故障排查

### 问题1：保存失败
- 检查 `.env.local` 配置是否正确
- 检查浏览器控制台错误
- 确认Storage存储桶已创建

### 问题2：看不到数据
- 登录Supabase控制台
- 进入Table Editor查看
- 刷新页面

### 问题3：连接超时
- 检查网络连接
- 检查Supabase服务状态
- 重启前端服务器

---

## 🎯 下一步

1. ✅ 确保创建Storage存储桶
2. ✅ 测试上传视频和标注数据
3. ✅ 在Supabase控制台查看数据
4. ✅ 测试完整的标注→质检流程

---

**现在访问 http://localhost:3000 测试吧！** 🚀

所有数据都会保存到Supabase云端了！

