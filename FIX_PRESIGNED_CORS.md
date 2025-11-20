# 修复预签名上传 CORS 错误

## 🚨 问题

预签名上传遇到 CORS 错误：
```
Access to fetch at 'https://xxx.supabase.co/storage/v1/object/...'
from origin 'https://annotation-platform-rwxq.vercel.app'
has been blocked by CORS policy
```

## 🔍 原因

1. **Authentication URL 配置不够**
   - 您在 `Settings → API → URL Configuration` 中添加了域名
   - 但这只是 **Authentication** 的 CORS 配置
   - **Storage** 需要单独的 CORS 配置

2. **Storage 的 CORS 是独立的**
   - Storage API 和 Auth API 是不同的服务
   - 需要分别配置

---

## ✅ 解决方案

### 方法1: 通过 Dashboard 配置（推荐）

1. **进入 Supabase Dashboard**

2. **导航到 Storage 设置**
   ```
   Storage → Configuration → CORS
   ```
   或
   ```
   Settings → Storage
   ```

3. **添加允许的域名**
   ```
   https://annotation-platform-rwxq.vercel.app
   http://localhost:3000
   http://localhost:5173
   ```

4. **允许的 HTTP 方法**
   - ✅ GET
   - ✅ POST
   - ✅ PUT
   - ✅ DELETE
   - ✅ OPTIONS

5. **允许的请求头**
   ```
   Content-Type
   Authorization
   apikey
   x-upsert
   x-client-info
   ```

6. **点击保存**

---

### 方法2: 通过 SQL 配置（备选）

如果找不到 CORS 配置页面，可以在 **SQL Editor** 中执行：

```sql
-- 1. 确保 videos bucket 是公开的
UPDATE storage.buckets
SET public = true
WHERE id = 'videos';

-- 2. 允许所有人上传到 videos bucket
CREATE POLICY "Allow public uploads to videos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'videos');

-- 3. 允许所有人读取 videos bucket
CREATE POLICY "Allow public reads from videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'videos');

-- 4. 允许所有人更新 videos bucket（用于 upsert）
CREATE POLICY "Allow public updates to videos"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');
```

---

### 方法3: 修改 Supabase 项目的 CORS 配置

在 Supabase Dashboard：

1. **Settings** → **API**
2. 找到 **Storage** 部分
3. 添加 CORS 配置：

```json
{
  "allowedOrigins": [
    "https://annotation-platform-rwxq.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173"
  ],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowedHeaders": [
    "Content-Type",
    "Authorization",
    "apikey",
    "x-upsert",
    "x-client-info"
  ],
  "maxAge": 3600
}
```

---

## 🔧 代码修改

已恢复使用预签名上传，并添加了 CORS 错误提示：

```typescript
// 使用预签名直传
const uploadedUrl = await presignedUploadVideo(
  finalVideoFile,
  (percentage) => {
    // 实时进度回调
    setUploadProgress(20 + percentage * 0.75);
  }
);
```

如果遇到 CORS 错误，会显示：
```
上传失败：CORS配置问题
请在 Supabase Dashboard → Storage → Configuration 中添加您的域名
```

---

## 📋 验证步骤

### 1. 检查 Bucket 是否公开

在 **Storage** → **Buckets**：
- 找到 `videos` bucket
- 确保 `Public` 开关是 **ON**

### 2. 检查 Policies

在 **Storage** → **Policies**：
- 应该看到类似这样的策略：
  ```
  videos: Allow public uploads
  videos: Allow public reads
  videos: Allow public updates
  ```

### 3. 测试上传

1. 清除浏览器缓存
2. 重新加载页面
3. 尝试上传视频
4. 查看浏览器控制台，确认没有 CORS 错误

---

## 🎯 预期结果

配置正确后，控制台应该显示：

```
🚀 开始预签名直传
📝 文件名: video_1732123456789.mp4
📦 文件大小: 80.5 MB
📝 正在获取预签名 URL...
✅ 获取预签名 URL 成功
📤 开始直传到 Supabase Storage...
📊 上传进度: 10.5%
📊 上传进度: 25.3%
📊 上传进度: 50.8%
📊 上传进度: 75.2%
📊 上传进度: 100.0%
✅ 上传完成！耗时: 15.3秒, 速度: 5.26 MB/s
✅ 获取公开 URL 成功
```

**不会再有 CORS 错误！**

---

## 🆘 常见问题

### Q1: 配置后还是报 CORS 错误？

**A**: 清除浏览器缓存并刷新页面，CORS 配置可能需要几分钟生效。

### Q2: 找不到 Storage CORS 配置？

**A**: 使用方法2（SQL）直接配置 Storage Policies。

### Q3: 仍然失败？

**A**: 检查：
1. Supabase URL 和 Key 是否正确
2. Videos bucket 是否存在
3. Bucket 是否公开
4. 网络连接是否正常

### Q4: 本地开发可以，部署后失败？

**A**: 确保添加了 Vercel 域名到 CORS 配置：
```
https://annotation-platform-rwxq.vercel.app
```

---

## 📝 文件清单

- `STORAGE_CORS_FIX.sql` - SQL 配置脚本
- `src/pages/VideoManagePage.tsx` - 恢复预签名上传
- `src/utils/presignedUpload.ts` - 预签名上传逻辑

---

## 🎉 配置完成后

预签名上传将正常工作：
- ✅ 最快的上传速度
- ✅ 真实的进度反馈
- ✅ 准确的速度计算
- ✅ 不占用服务器资源

**这才是最优方案！** 🚀

