# 🐛 修复：质检抽样时出现未标注数据的问题

## 📋 问题描述

**现象：** 点击"质检"按钮，进行抽检时，出现了"未标注"的数据（标注人显示为空）。

**期望行为：** 抽检应该只从**已完成标注**的视频中随机抽取，不应该出现未标注的数据。

---

## 🔍 根本原因分析

### 问题代码位置
文件：`src/api/database.ts`  
函数：`getPendingInspectionAnnotations()`

### 原始代码（有 BUG）

```typescript
let query = supabase
  .from('annotations')
  .select('...', { count: 'exact' })
  .eq('video_id', videoId)
  // ❌ 只查询已标注的数据（有人工标注内容的）
  .not('human_annotated_text', 'is', null)
  .neq('human_annotated_text', '')
  .order('sentence_no', { ascending: true });
```

### 🐛 BUG 分析

原代码只检查了：
1. ✅ `human_annotated_text` 不为 null
2. ✅ `human_annotated_text` 不为空字符串

**但是缺失了最关键的检查：**
- ❌ **没有检查 `status = true`**

这导致：
- 即使标注未完成（status = false 或 null）
- 只要 `human_annotated_text` 有内容
- 就会被纳入质检抽样池

**结果：** 部分标注到一半就保存的数据（未勾选"标注状态"完成按钮），也被抽到了质检中。

---

## ✅ 解决方案

### 修复代码

```typescript
let query = supabase
  .from('annotations')
  .select('...', { count: 'exact' })
  .eq('video_id', videoId)
  // ✅ 只查询已完成标注的数据（status = true）
  .eq('status', true)
  // ✅ 只查询已标注的数据（有人工标注内容的）
  .not('human_annotated_text', 'is', null)
  .neq('human_annotated_text', '')
  .order('sentence_no', { ascending: true });
```

### 关键改动

添加了一行：
```typescript
.eq('status', true)
```

### 修复逻辑

现在查询条件变为：
1. ✅ 视频 ID 匹配
2. ✅ **status = true（已完成标注）** ← 新增
3. ✅ human_annotated_text 不为 null
4. ✅ human_annotated_text 不为空

---

## 🎯 修复效果

### 修复前
- ❌ 抽检数据中包含未完成标注的数据
- ❌ 显示"未标注"的行（标注人为空）
- ❌ 数据完成度可能只有 46%、70% 等

### 修复后
- ✅ 只从已完成标注的数据中抽样
- ✅ 所有抽检数据都有标注人信息
- ✅ 保证抽检数据质量（100% 完成度）

---

## 🔧 相关代码位置

### 1. 数据库查询函数
**文件：** `src/api/database.ts`  
**函数：** `getPendingInspectionAnnotations()`  
**行数：** 410-460

### 2. 质检管理页面
**文件：** `src/pages/InspectionManagePage.tsx`  
**调用位置：** 第 174 行

```typescript
const { data: pendingAnnotations, total } = await getPendingInspectionAnnotations(
  selectedVideoId,
  { limit: pageSize, offset }
);
```

### 3. 抽样算法
**文件：** `src/pages/InspectionManagePage.tsx`  
**行数：** 184-199（Fisher-Yates 随机洗牌算法）

---

## 📊 数据状态说明

### status 字段的含义

| status 值 | 含义 | 是否应该被质检 |
|-----------|------|----------------|
| `true` | 已完成标注 | ✅ 是 |
| `false` | 未完成标注 | ❌ 否 |
| `null` | 未完成标注 | ❌ 否 |

### 标注完成的判断标准

在标注页面（`AnnotationPage.tsx`），只有当标注员：
1. 填写了 `human_annotated_text`
2. 选择了 `major_category` 和 `minor_category`
3. **勾选了"标注状态"复选框**

才会在提交时将 `status` 设置为 `true`。

---

## 🧪 测试验证

### 测试步骤

1. **准备测试数据**
   - 创建一些完成的标注（status = true）
   - 创建一些未完成的标注（status = false，但有 human_annotated_text）

2. **进行质检抽样**
   - 进入质检管理页面
   - 选择一个视频
   - 点击"随机抽取"

3. **验证结果**
   - ✅ 所有抽取的数据都应该有标注人
   - ✅ 所有抽取的数据 status 都应该为 true
   - ❌ 不应该出现"未标注"的行

### SQL 验证查询

```sql
-- 检查待质检数据是否都是已完成的
SELECT 
  video_id,
  sentence_no,
  annotator,
  status,
  human_annotated_text,
  CASE 
    WHEN status = true THEN '✅ 已完成'
    WHEN status = false THEN '❌ 未完成'
    ELSE '⚠️ 状态为空'
  END as status_label
FROM annotations
WHERE video_id = 'YOUR_VIDEO_ID'
  AND human_annotated_text IS NOT NULL
  AND human_annotated_text != ''
ORDER BY sentence_no;

-- 修复后，只显示 status = true 的数据
SELECT 
  video_id,
  sentence_no,
  annotator,
  status,
  human_annotated_text
FROM annotations
WHERE video_id = 'YOUR_VIDEO_ID'
  AND status = true  -- 新增条件
  AND human_annotated_text IS NOT NULL
  AND human_annotated_text != ''
ORDER BY sentence_no;
```

---

## 📝 总结

### 问题本质
- 质检抽样的数据源不正确
- 混入了未完成的标注数据

### 解决方案
- 添加 `status = true` 过滤条件
- 确保只从已完成的标注中抽样

### 影响范围
- ✅ 质检管理页面（`InspectionManagePage`）
- ✅ 质检页面（`InspectionPage`）
- ✅ 所有依赖 `getPendingInspectionAnnotations` 的功能

### 修复时间
- 2024年12月11日

---

## 🎉 修复完成！

现在质检抽样功能会正确地只从**已完成标注**的数据中进行随机抽取，不会再出现"未标注"的数据了！

