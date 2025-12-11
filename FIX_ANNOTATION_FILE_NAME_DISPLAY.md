# ✅ 修复标注文件名显示问题

## 🎯 修复内容

已修复质检管理页面"标注文件名"列不显示的问题：

### 问题根因
1. **数据库有数据** ✅ （已通过 SQL 确认217个视频都有标注文件名）
2. **前端获取数据正确** ✅ （代码第218行和第347行正确获取）
3. **问题在分组函数** ❌ → **已修复**

### 修复点1：groupByVideo 函数
**文件**: `src/pages/InspectionManagePage.tsx` (第67-103行)

**问题**: 父级行（视频行）没有保存 `annotationFileName` 字段

**修复**: 
```typescript
// 在父级行中添加 annotationFileName
const annotationFileName = items[0]?.annotationFileName || '';
result.push({
  key: `video_${videoId}`,
  isGroup: true,
  videoId,
  videoName,
  annotationFileName, // ✅ 新增：在父级行保存标注文件名
  itemCount: items.length,
  totalAnnotated,
  children: items.map(item => ({
    ...item,
    key: item.id,
    isGroup: false
  }))
});
```

### 修复点2：渲染逻辑优化
**文件**: `src/pages/InspectionManagePage.tsx` (第682-717行)

**优化**: 优先从父级行获取 `annotationFileName`，兜底从子项获取

```typescript
render: (text: string, record: any) => {
  if (record.isGroup) {
    // ✅ 优先从 record.annotationFileName 获取
    const fileName = record.annotationFileName || 
      (record.children && record.children.length > 0 
        ? record.children[0].annotationFileName 
        : '');
    // ...
  }
}
```

---

## 🚀 测试步骤

### 1. 刷新页面并查看控制台
```bash
# 如果前端服务正在运行，直接刷新浏览器即可
# 打开浏览器开发者工具（F12）→ Console 标签
```

### 2. 查看调试日志
刷新质检管理页面后，控制台会显示：
```
📋 视频分组 - 语文02.mp4: {
  videoId: "upload_1765192794130",
  annotationFileName: "第七批第一次改写_语文-02.xlsx",
  itemCount: 5,
  firstItemFileName: "第七批第一次改写_语文-02.xlsx"
}

📋 渲染标注文件名: {
  videoName: "语文02.mp4",
  fileName: "第七批第一次改写_语文-02.xlsx",
  recordFileName: "第七批第一次改写_语文-02.xlsx",
  childFileName: "第七批第一次改写_语文-02.xlsx"
}
```

### 3. 验证显示效果
质检管理页面应该显示：
- ✅ "标注文件名"列有绿色标签
- ✅ 显示实际的文件名（如：第七批第一次改写_语文-02.xlsx）
- ✅ 展开视频行后，每个句子也显示标注文件名

---

## 🔧 如果还是不显示

### 方案1：强制刷新
```bash
# Mac: Cmd + Shift + R
# Windows/Linux: Ctrl + Shift + R
```

### 方案2：清除缓存
```bash
# Chrome/Edge: F12 → Application → Clear storage → Clear site data
# Firefox: F12 → Storage → Clear All
```

### 方案3：重启前端服务
```bash
# 在运行 npm run dev 的终端
# 按 Ctrl+C 停止
# 重新运行
npm run dev
```

---

## 📊 数据验证

如果想验证数据库中的数据，可以：

### 方法1：使用诊断页面
打开：`check_annotation_file_name_in_page.html`
点击"开始检查"按钮

### 方法2：SQL查询
在 Supabase Dashboard → SQL Editor 中运行：
```sql
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' 
        THEN '❌ 无数据' 
        ELSE '✅ 有数据' 
    END AS "状态"
FROM videos
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ 修复完成

现在质检管理页面应该能正常显示"标注文件名"列了！

如果还有问题，请：
1. 截图控制台日志
2. 截图质检管理页面
3. 告诉我具体看到了什么

我会继续帮您排查！


## 🎯 修复内容

已修复质检管理页面"标注文件名"列不显示的问题：

### 问题根因
1. **数据库有数据** ✅ （已通过 SQL 确认217个视频都有标注文件名）
2. **前端获取数据正确** ✅ （代码第218行和第347行正确获取）
3. **问题在分组函数** ❌ → **已修复**

### 修复点1：groupByVideo 函数
**文件**: `src/pages/InspectionManagePage.tsx` (第67-103行)

**问题**: 父级行（视频行）没有保存 `annotationFileName` 字段

**修复**: 
```typescript
// 在父级行中添加 annotationFileName
const annotationFileName = items[0]?.annotationFileName || '';
result.push({
  key: `video_${videoId}`,
  isGroup: true,
  videoId,
  videoName,
  annotationFileName, // ✅ 新增：在父级行保存标注文件名
  itemCount: items.length,
  totalAnnotated,
  children: items.map(item => ({
    ...item,
    key: item.id,
    isGroup: false
  }))
});
```

### 修复点2：渲染逻辑优化
**文件**: `src/pages/InspectionManagePage.tsx` (第682-717行)

**优化**: 优先从父级行获取 `annotationFileName`，兜底从子项获取

```typescript
render: (text: string, record: any) => {
  if (record.isGroup) {
    // ✅ 优先从 record.annotationFileName 获取
    const fileName = record.annotationFileName || 
      (record.children && record.children.length > 0 
        ? record.children[0].annotationFileName 
        : '');
    // ...
  }
}
```

---

## 🚀 测试步骤

### 1. 刷新页面并查看控制台
```bash
# 如果前端服务正在运行，直接刷新浏览器即可
# 打开浏览器开发者工具（F12）→ Console 标签
```

### 2. 查看调试日志
刷新质检管理页面后，控制台会显示：
```
📋 视频分组 - 语文02.mp4: {
  videoId: "upload_1765192794130",
  annotationFileName: "第七批第一次改写_语文-02.xlsx",
  itemCount: 5,
  firstItemFileName: "第七批第一次改写_语文-02.xlsx"
}

📋 渲染标注文件名: {
  videoName: "语文02.mp4",
  fileName: "第七批第一次改写_语文-02.xlsx",
  recordFileName: "第七批第一次改写_语文-02.xlsx",
  childFileName: "第七批第一次改写_语文-02.xlsx"
}
```

### 3. 验证显示效果
质检管理页面应该显示：
- ✅ "标注文件名"列有绿色标签
- ✅ 显示实际的文件名（如：第七批第一次改写_语文-02.xlsx）
- ✅ 展开视频行后，每个句子也显示标注文件名

---

## 🔧 如果还是不显示

### 方案1：强制刷新
```bash
# Mac: Cmd + Shift + R
# Windows/Linux: Ctrl + Shift + R
```

### 方案2：清除缓存
```bash
# Chrome/Edge: F12 → Application → Clear storage → Clear site data
# Firefox: F12 → Storage → Clear All
```

### 方案3：重启前端服务
```bash
# 在运行 npm run dev 的终端
# 按 Ctrl+C 停止
# 重新运行
npm run dev
```

---

## 📊 数据验证

如果想验证数据库中的数据，可以：

### 方法1：使用诊断页面
打开：`check_annotation_file_name_in_page.html`
点击"开始检查"按钮

### 方法2：SQL查询
在 Supabase Dashboard → SQL Editor 中运行：
```sql
SELECT 
    id,
    name AS "视频名称",
    annotation_file_name AS "标注文件名",
    CASE 
        WHEN annotation_file_name IS NULL OR annotation_file_name = '' 
        THEN '❌ 无数据' 
        ELSE '✅ 有数据' 
    END AS "状态"
FROM videos
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ 修复完成

现在质检管理页面应该能正常显示"标注文件名"列了！

如果还有问题，请：
1. 截图控制台日志
2. 截图质检管理页面
3. 告诉我具体看到了什么

我会继续帮您排查！

