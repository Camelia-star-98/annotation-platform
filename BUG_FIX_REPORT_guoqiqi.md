# 🐛 Bug修复报告：郭其其看不到被打回的记录

## 📊 问题诊断结果

### 问题表现
- 郭其其在"被打回的数据"页面看不到她被打回的6条记录
- 视频：`第七批第一次改写_语文-01.xlsx`
- 句子号：9, 16, 26, 27, 30, 32

### 根本原因
在 `rejected_annotations` 表中，这6条被打回的记录的 **`annotator` 字段是空的**！

#### 数据库状态对比：

**❌ rejected_annotations 表：**
```
句子号  | 标注人   | 质检人 | 是否重新提交
--------|---------|--------|------------
9       | (空)    | 单     | false
16      | (空)    | 单     | false
26      | (空)    | 单     | false
27      | (空)    | 单     | false
30      | (空)    | 单     | false
32      | (空)    | 单     | false
```

**✅ annotations 表：**
```
句子号  | 标注人   | 质检人 | is_qualified
--------|---------|--------|-------------
9       | 郭其其   | 单     | false
16      | 郭其其   | 单     | false
26      | 郭其其   | 单     | false
27      | 郭其其   | 单     | false
30      | 郭其其   | 单     | false
32      | 郭其其   | 单     | false
```

### 为什么会出现这个问题？

#### Bug位置 1：`InspectionPage.tsx` 第 178 行

```typescript
// 🐛 Bug：如果 item.annotator 是空字符串，就会插入空值
annotator: item.annotator || '',
```

#### Bug位置 2：数据源头

质检页面接收的数据来自 `InspectionManagePage.tsx`，数据映射时：

```typescript
annotator: item.annotator || '',  // 如果数据库中为空，就传递空字符串
```

如果 `annotations` 表中某些记录的 `annotator` 字段为空，就会传递到质检页面，最终插入空值到 `rejected_annotations`。

---

## 🔧 修复方案

### 1. 修复现有数据（SQL脚本）

执行 `FIX_ALL_missing_annotators.sql` 脚本：

```sql
-- 从 annotations 表中补充正确的标注人信息
UPDATE rejected_annotations ra
SET 
  annotator = a.annotator,
  updated_at = NOW()
FROM annotations a
WHERE ra.video_id = a.video_id 
  AND ra.sentence_no = a.sentence_no
  AND (ra.annotator IS NULL OR ra.annotator = '')
  AND a.annotator IS NOT NULL 
  AND a.annotator != '';
```

**预期结果**：将6条空记录的 `annotator` 字段更新为 `郭其其`

### 2. 修复前端代码（防止重复发生）

#### 修复 1：`InspectionPage.tsx`

```typescript
// 🔧 在插入前验证 annotator 不为空
if (!item.annotator || item.annotator.trim() === '') {
  console.error('❌ 错误：标注人为空，无法插入 rejected_annotations 表', item);
  message.error(`句子 ${item.sentenceNo} 的标注人信息缺失，请检查数据`);
  continue; // 跳过这条记录
}

// 插入时使用 trim() 确保干净
annotator: item.annotator.trim(),
```

#### 修复 2：`InspectionManagePage.tsx`

```typescript
// 🔧 在数据映射时添加警告
if (!item.annotator || item.annotator.trim() === '') {
  console.warn('⚠️ 警告：发现标注人为空的记录', { 
    id: item.id, 
    video_id: item.video_id, 
    sentence_no: item.sentence_no 
  });
}
```

---

## ✅ 修复步骤

1. **执行数据库修复**
   - 运行 `FIX_ALL_missing_annotators.sql` 的诊断部分（查看影响范围）
   - 确认无误后，取消注释执行修复部分
   - 验证修复结果

2. **验证修复结果**
   ```sql
   -- 查询郭其其的被打回记录
   SELECT * FROM rejected_annotations
   WHERE annotator = '郭其其'
   ORDER BY rejected_at DESC;
   ```
   应该能看到6条记录

3. **前端代码已修复**
   - `InspectionPage.tsx` - 已添加空值验证
   - `InspectionManagePage.tsx` - 已添加警告日志

4. **用户验证**
   - 郭其其登录系统
   - 进入"被打回的数据"页面
   - 应该能看到"第七批第一次改写_语文-01.xlsx"的6条被打回记录

---

## 📝 预防措施

### 数据库层面
可以考虑添加 NOT NULL 约束：

```sql
-- 确保以后插入时 annotator 必须有值
ALTER TABLE rejected_annotations 
  ALTER COLUMN annotator SET NOT NULL;

-- 添加检查约束确保不是空字符串
ALTER TABLE rejected_annotations 
  ADD CONSTRAINT annotator_not_empty 
  CHECK (annotator != '');
```

### 应用层面
1. ✅ 已在 `InspectionPage.tsx` 添加插入前验证
2. ✅ 已在 `InspectionManagePage.tsx` 添加警告日志
3. 建议在 `annotations` 表的数据录入时也添加验证

---

## 📊 修复文件清单

### SQL 脚本
- ✅ `FIX_ALL_missing_annotators.sql` - 修复所有缺失的标注人信息
- ✅ `step1_check_rejected_annotations.sql` - 诊断脚本
- ✅ `step1.5_check_empty_records_detail.sql` - 详细检查脚本

### 前端代码
- ✅ `src/pages/InspectionPage.tsx` - 添加空值验证
- ✅ `src/pages/InspectionManagePage.tsx` - 添加警告日志

---

## 🎯 总结

**问题**：质检打回时，如果 `annotator` 字段为空，会插入空值到 `rejected_annotations` 表

**影响**：标注人查询不到自己被打回的记录

**修复**：
1. 补充现有数据的标注人信息（SQL）
2. 添加前端验证防止再次发生（TypeScript）

**状态**：✅ 代码已修复，等待执行 SQL 脚本

