# 修复前端显示 total_sentences 问题

## 📋 问题描述

前端页面（质检选择页面）显示的"总标注数"很少，不符合实际的视频句子总数。

**示例**：
- "第5批第一轮-英语-1.mp4" 显示 **4 条**，实际应该是 **95 句**
- "第5批第一轮-数学-1.mp4" 显示 **32 条**，实际应该更多

## 🔍 根本原因

1. **后端字段已存在**：`videos.total_sentences` 字段已经添加并正确填充（183 个视频已更新）
2. **前端查询缺失**：前端代码在查询视频时**没有包含** `total_sentences` 字段

### 问题代码位置

#### 1. `src/pages/InspectionSelectPage.tsx` (质检选择页面)

**第 71 行**：查询视频时缺少 `total_sentences`

```typescript
// ❌ 修复前
const { data: allVideos, error: videosError } = await supabase
  .from('videos')
  .select('id, name, subject, created_at, is_completed')  // 缺少 total_sentences
```

**第 168 行**：尝试使用但值为 undefined

```typescript
totalAnnotations: video.total_sentences || validAnnotations.length,
// 因为 total_sentences 未查询，所以总是 undefined，回退到 validAnnotations.length
```

#### 2. `src/api/database.ts` (数据库API)

**第 54 行**：`getVideos()` 函数缺少 `total_sentences`

```typescript
// ❌ 修复前
.select('id, name, url, subject, duration, required_annotators, created_at, is_published, is_completed')
```

**第 70 行**：`getVideo()` 函数也缺少 `total_sentences`

## ✅ 修复方案

### 修改 1: `src/pages/InspectionSelectPage.tsx`

```typescript
// ✅ 修复后：添加 total_sentences 字段
const { data: allVideos, error: videosError } = await supabase
  .from('videos')
  .select('id, name, subject, created_at, is_completed, total_sentences')  // ✅ 添加
  .or('is_completed.is.null,is_completed.eq.false')
  .order('created_at', { ascending: false });
```

### 修改 2: `src/api/database.ts`

#### `getVideos()` 函数

```typescript
// ✅ 修复后
export async function getVideos(): Promise<VideoInfo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, name, url, subject, duration, required_annotators, total_sentences, created_at, is_published, is_completed')  // ✅ 添加
    .order('created_at', { ascending: false });
  // ...
}
```

#### `getVideo()` 函数

```typescript
// ✅ 修复后
export async function getVideo(videoId: string): Promise<VideoInfo | null> {
  try {
    const query = supabase
      .from('videos')
      .select('id, name, url, subject, duration, required_annotators, total_sentences, created_at, is_published, is_completed')  // ✅ 添加
      .eq('id', videoId)
      .single();
    // ...
  }
}
```

## 🎯 修复后的效果

修复后，前端页面会正确显示每个视频的总句数：

| 视频名称 | 修复前 | 修复后 | 说明 |
|---------|-------|-------|------|
| 第5批第一轮-英语-1.mp4 | 4 条 | 95 条 | ✅ 从 videos.total_sentences 读取 |
| 第5批第一轮-数学-1.mp4 | 32 条 | 正确数值 | ✅ 从 videos.total_sentences 读取 |
| 第5批第一轮-物理-01.mp4 | 1 条 | 正确数值 | ✅ 从 videos.total_sentences 读取 |
| 第5批第一轮-语文-1.mp4 | 1 条 | 正确数值 | ✅ 从 videos.total_sentences 读取 |

## 📊 数据流程

```
┌─────────────────────────────────────────────────┐
│  1. 上传视频时                                   │
│     - addVideo() 写入 total_sentences           │
│     - 自动更新脚本可以补充/修复数据              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  2. 数据库                                       │
│     videos.total_sentences = 实际句子总数        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  3. 前端查询（修复后）                           │
│     ✅ SELECT ... total_sentences ...           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  4. 前端显示                                     │
│     totalAnnotations: video.total_sentences     │
│     ✅ 显示正确的句子总数                        │
└─────────────────────────────────────────────────┘
```

## 🚀 部署步骤

1. ✅ **后端数据准备**（已完成）
   - 添加 `videos.total_sentences` 字段
   - 运行 `auto_update_sentences_standalone.js` 更新数据
   - 验证：183 个视频数据正确

2. ✅ **前端代码修复**（已完成）
   - 修改 `InspectionSelectPage.tsx`
   - 修改 `database.ts` 的 `getVideos()` 和 `getVideo()`

3. ✅ **重新构建**（已完成）
   ```bash
   npm run build
   ```

4. 🔄 **刷新页面**
   - 清除浏览器缓存
   - 重新加载页面
   - 验证"总标注数"显示正确

## 🔧 验证方法

1. 打开质检选择页面：`/inspection-select`
2. 查看"总标注数"列
3. 应该显示视频的实际句子总数（而不是当前标注的条数）
4. hover 到问号图标，tooltip 显示："视频上传时标注文件中的总句数（从 videos.total_sentences 读取）"

## 📝 注意事项

1. **字段含义**：
   - `total_sentences`：视频的总句子数（固定值，上传时确定）
   - `validAnnotations.length`：当前已标注的条数（动态值）

2. **回退逻辑**：
   ```typescript
   totalAnnotations: video.total_sentences || validAnnotations.length
   ```
   - 优先使用 `total_sentences`（推荐）
   - 如果为空则回退到实际标注数（兼容旧数据）

3. **其他页面**：
   - `ReviewSelectPage` 使用 `getVideos()` 获取数据，已自动修复
   - `InspectionManagePage` 也使用了 `getVideos()`，已自动修复
   - 所有使用 `database.ts` API 的页面都会受益

## 📌 相关文件

- ✅ `src/pages/InspectionSelectPage.tsx`
- ✅ `src/api/database.ts`
- ✅ `src/types/index.ts` (VideoInfo 接口已有 total_sentences 字段)
- ✅ `auto_update_sentences_standalone.js` (数据更新脚本)

---

**修复完成时间**: 2025-12-01  
**影响范围**: 质检选择、复检选择、视频管理等所有使用 `getVideos()` 的页面  
**测试状态**: ✅ 已构建成功，待部署验证

