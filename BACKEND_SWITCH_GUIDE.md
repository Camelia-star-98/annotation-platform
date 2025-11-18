## 🔄 切换后端数据源

当前项目支持两种后端：

### 1. JSON Server（本地开发）
- 文件：`src/api/jsonServer.ts`
- 优点：快速、简单、本地运行
- 缺点：数据存本地、无法多人协作

### 2. Supabase（推荐生产环境）
- 文件：`src/api/database.ts` + `src/api/supabase.ts`
- 优点：云端存储、数据持久化、多人协作
- 缺点：需要配置账号

---

## 🔧 如何切换

### 方式1：使用环境变量（推荐）

在 `.env.local` 文件中添加：
```env
VITE_USE_SUPABASE=true
```

### 方式2：修改导入

在需要使用API的文件中，修改导入：

```typescript
// 从
import { getVideos, saveAnnotations } from '@/api/jsonServer';

// 改为
import { getVideos, saveAnnotations } from '@/api/database';
```

---

## 📋 需要修改的文件

如果使用Supabase，需要修改以下文件的API导入：

1. `src/pages/AnnotationPage.tsx`
2. `src/pages/InspectionPage.tsx`
3. `src/pages/InspectionManagePage.tsx`
4. `src/pages/HomePage.tsx`
5. `src/pages/AnalysisPage.tsx`

---

## ✅ Supabase配置完成后

1. 停止JSON Server（如果在运行）
2. 重启前端服务器
3. 所有数据将保存到Supabase云端数据库

