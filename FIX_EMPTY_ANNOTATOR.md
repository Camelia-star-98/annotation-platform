# 修复待质检数量过高问题

## 问题诊断

通过查询发现，**每个句子都有多个标注人的记录，其中包括 annotator 为空值的记录**。

例如"测试2"视频：
- 句子编号 1：有 5 个标注人（**空值**、"1"、"你"、"你好"、"王曦禾"）
- 句子编号 2：有 5 个标注人（**空值**、"1"、"你"、"你好"、"王曦禾"）
- 句子编号 3：有 5 个标注人（**空值**、"1"、"你"、"你好"、"王曦禾"）

这导致：
- 总标注数 = 句子数 × 5（因为每个句子有5个标注人）
- 待质检数异常高（376条中有337条待质检）

## 修复方案

### 1. 前端代码修改

#### InspectionSelectPage.tsx
1. **数据库查询层面**：在查询时过滤掉空值标注人
   ```typescript
   const { data: allAnnotations, error: annotationsError } = await supabase
     .from('annotations')
     .select('...')
     .in('video_id', videoIds)
     .not('annotator', 'is', null)  // 🔧 新增
     .neq('annotator', '');          // 🔧 新增
   ```

2. **去重逻辑层面**：在处理数据时也过滤掉空值
   ```typescript
   annotations.forEach(ann => {
     // 🔧 过滤掉 annotator 为空的记录
     if (!ann.annotator || ann.annotator.trim() === '') {
       return;
     }
     // ... 去重逻辑
   });
   ```

#### AnnotationTaskListPage.tsx
1. **查询视频标注统计时过滤空值**：
   ```typescript
   const { data: allSentences, error: statsError } = await supabase
     .from('annotations')
     .select('video_id, sentence_no, annotator, human_annotated_text')
     .in('video_id', videoIds)
     .not('annotator', 'is', null)  // 🔧 新增
     .neq('annotator', '');          // 🔧 新增
   ```

2. **统计逻辑层面过滤空值**：
   ```typescript
   validAnnotations.forEach(item => {
     // 🔧 过滤掉 annotator 为空的记录
     if (!item.annotator || item.annotator.trim() === '') {
       return;
     }
     // ... 统计逻辑
   });
   ```

#### ReviewSelectPage.tsx
- ✅ 已经在数据库查询时过滤了空值：
  ```typescript
  .not('annotator', 'is', null)
  .neq('annotator', '')
  .neq('annotator', 'unknown')
  ```

### 2. 数据库 RPC 函数创建

创建 `get_all_annotations()` RPC 函数（用于任务列表页面）：

```sql
CREATE OR REPLACE FUNCTION get_all_annotations()
RETURNS TABLE (...)
LANGUAGE sql
AS $$
  SELECT *
  FROM annotations
  WHERE annotator IS NOT NULL
    AND annotator != ''
    AND annotator != 'unknown'
  ORDER BY created_at DESC;
$$;
```

**执行脚本**：`CREATE_GET_ALL_ANNOTATIONS_RPC.sql`

## 测试步骤

### 1. 在 Supabase SQL Editor 中运行：
```bash
# 1. 诊断查询
check_empty_annotator.sql

# 2. 创建 RPC 函数
CREATE_GET_ALL_ANNOTATIONS_RPC.sql
```

### 2. 重新部署前端代码：
```bash
npm run build
# 或部署到服务器
```

### 3. 验证修复结果：
- 打开"质检选择页面"（InspectionSelectPage）
- 查看"测试2"视频的统计数据：
  - **修复前**：总标注数 376，待质检 337
  - **修复后**：总标注数应该大幅减少（去掉空值标注人后）
  
- 打开"任务列表页面"（AnnotationTaskListPage）
- 查看"已标注任务"tab 的数据是否正常

## 预期效果

修复后，统计逻辑将：
1. **过滤掉所有 annotator 为空的记录**
2. **只统计有效的标注人的数据**
3. **每个句子每个标注人只统计一次**（去重）

这样：
- 总标注数 = 唯一句子数 × 实际标注人数（不包括空值）
- 待质检数 = 有标注人但未质检的记录数

## 诊断查询脚本

### check_empty_annotator.sql
检查空值标注人的情况：
- 空值记录总数
- 各视频的空值数量
- 测试2 的空值详情
- 对比统计（包含空值 vs 排除空值）
- 空值创建时间分布

### diagnose_high_inspection_count.sql
诊断为什么待质检数量这么高：
- 测试2 的详细情况
- 按句子分组统计
- 重复标注检查
- 标注人数量分布

## 其他需要清理的数据

从查询结果看，还有一些奇怪的标注人：
- "1"
- "你"
- "你好"

这些看起来也是测试数据，如果需要清理，可以运行：

```sql
-- 删除测试标注人的数据（慎用！）
DELETE FROM annotations
WHERE annotator IN ('1', '你', '你好', '')
  OR annotator IS NULL;
```

**注意**：执行前请先备份数据库！

## 文件清单

修改的文件：
- ✅ src/pages/InspectionSelectPage.tsx
- ✅ src/pages/AnnotationTaskListPage.tsx
- ✅ src/pages/ReviewSelectPage.tsx（已经有过滤，无需修改）

新增的文件：
- ✅ check_empty_annotator.sql（诊断查询）
- ✅ CREATE_GET_ALL_ANNOTATIONS_RPC.sql（创建 RPC 函数）
- ✅ FIX_EMPTY_ANNOTATOR.md（本文档）

