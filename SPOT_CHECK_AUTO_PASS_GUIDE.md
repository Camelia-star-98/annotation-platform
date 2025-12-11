# 🎯 抽检自动通过功能 - 使用说明

## 📋 功能概述

**新功能**：质检时，如果抽检的句子全部通过，系统会自动将该视频的其他未抽检句子也标记为"质检通过"。

**解决的问题**：
- ❌ **旧逻辑**：抽检3条，只有这3条被标记，剩余句子仍显示"待质检"
- ✅ **新逻辑**：抽检3条全部通过 → 自动将剩余句子也标记为通过 → 整个视频从待质检列表消失

---

## 🎯 使用场景

### 场景1：抽检全部通过 ✅

**操作流程**：
1. 质检员选择一个视频（如：英语02.mp4，共82条句子）
2. 设置抽检比例：30%（系统随机抽取约25条）
3. 质检员逐条检查，全部标记为"通过" ✅
4. 点击"提交质检"

**系统行为**：
- ✅ 将抽检的25条标记为：`is_qualified = true`，`inspector = '质检员姓名'`
- ✅ **自动**将剩余57条也标记为：`is_qualified = true`，`inspector = '质检员姓名'`
- ✅ 显示消息："🎉 抽检完成！全部通过，整个视频已自动标记为质检通过（共82条）"
- ✅ 该视频从"待质检"列表中**消失**

---

### 场景2：抽检中有不通过 ❌

**操作流程**：
1. 质检员选择一个视频（如：数学02.mp4，共133条句子）
2. 设置抽检比例：30%（系统随机抽取约40条）
3. 质检员逐条检查，发现3条不通过 ❌，其余37条通过 ✅
4. 点击"提交质检"

**系统行为**：
- ✅ 将通过的37条标记为：`is_qualified = true`
- ❌ 将不通过的3条标记为：`is_qualified = false`，并记录到 `rejected_annotations` 表
- ⏸️ **不会**自动标记剩余93条（它们保持"待质检"状态）
- ⚠️ 显示消息："质检完成！错误率 7.5%，共提交 40 条数据"
- 📋 该视频**仍显示**在"待质检"列表中（因为还有93条未质检）

---

## 🔧 技术实现

### 修改的文件

1. **`src/pages/InspectionPage.tsx`**（核心修改）

**关键代码**（第106-232行）：

```typescript
// 提交质检
const handleSubmit = async () => {
  // ... 验证逻辑 ...
  
  const failedCount = inspectionData.filter(item => !item.isQualified).length;
  const allPassed = failedCount === 0; // 🆕 是否全部通过
  
  // 🆕 抽检逻辑优化：如果全部通过，自动将该视频的其他未抽检句子也标记为通过
  if (allPassed && inspectionData.length > 0) {
    const videoId = inspectionData[0].videoId;
    
    // 查询该视频的所有未质检的句子（排除当前已抽检的句子）
    const { data: uncheckedAnnotations } = await supabase
      .from('annotations')
      .select('id, sentence_no')
      .eq('video_id', videoId)
      .not('id', 'in', `(${annotationIds.join(',')})`)
      .or('inspector.is.null,inspector.eq.');
    
    // 批量更新未抽检的句子为"通过"
    await supabase
      .from('annotations')
      .update({
        is_qualified: true,
        inspector: inspectorName.trim()
      })
      .in('id', uncheckedAnnotations.map(item => item.id));
  }
  
  // ... 处理已抽检的句子 ...
};
```

---

## 📊 测试验证

### 步骤1：准备测试数据

运行 `TEST_spot_check_logic.sql` 查看测试视频的状态：

```sql
-- 查看郭其其的视频（用于测试）
SELECT 
    video_name,
    COUNT(*) as total_annotations,
    COUNT(CASE WHEN inspector IS NULL THEN 1 END) as pending_inspection
FROM annotations
WHERE annotator = '郭其其' AND status = true
GROUP BY video_name;
```

### 步骤2：进行抽检测试

1. 打开"选择视频进行质检"页面
2. 选择一个视频（如：英语02.mp4）
3. 设置抽检比例：30%
4. 进入质检页面
5. 将所有抽检的句子标记为"通过" ✅
6. 点击"提交质检"

### 步骤3：验证结果

运行验证SQL（在 `TEST_spot_check_logic.sql` 中）：

```sql
-- 验证：所有句子是否都已质检
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN inspector IS NOT NULL THEN 1 END) as inspected,
    CASE 
        WHEN COUNT(*) = COUNT(CASE WHEN inspector IS NOT NULL THEN 1 END)
        THEN '✅ 测试通过：所有句子都已质检'
        ELSE '❌ 测试失败：还有未质检的句子'
    END as test_result
FROM annotations
WHERE video_id = '您测试的视频ID';
```

**预期结果**：
- `total` = `inspected`
- `test_result` = '✅ 测试通过：所有句子都已质检'

---

## ⚠️ 注意事项

### 1. 只有"全部通过"才触发自动标记

- ✅ 抽检10条，全部通过 → 自动标记其他句子
- ❌ 抽检10条，9条通过1条不通过 → **不会**自动标记其他句子

### 2. 已质检的句子不会被覆盖

自动标记逻辑会排除：
- 已抽检的句子（当前批次）
- 之前已质检过的句子（`inspector` 不为空）

### 3. 数据库查询优化

使用的SQL查询：
```sql
SELECT id FROM annotations
WHERE video_id = '视频ID'
  AND id NOT IN (已抽检的句子ID列表)
  AND (inspector IS NULL OR inspector = '')
```

### 4. 错误处理

如果批量更新失败：
- ⚠️ 显示警告消息："部分未抽检句子自动标记失败，请手动检查"
- 📝 控制台输出详细错误信息
- ✅ 已抽检的句子仍会正常保存

---

## 🔍 常见问题

### Q1: 如果抽检比例是100%，还会触发自动标记吗？

**答**：不会。因为抽检比例是100%时，所有句子都已经被抽检，没有"未抽检的句子"需要自动标记。

### Q2: 如果视频有多个标注人，会影响自动标记吗？

**答**：不会。自动标记逻辑基于 `video_id`，只要是同一个视频，所有句子（无论标注人是谁）都会被处理。

### Q3: 自动标记后，如果发现有问题，怎么撤销？

**答**：
1. 方法1：在数据库中手动修改（不推荐）
2. 方法2：重新进入质检页面，对有问题的句子重新质检并打回

### Q4: 抽检时能否跳过某些句子？

**答**：不能。前端要求"请完成所有质检项"，必须对所有抽检的句子进行标记（通过或不通过）。

---

## 📈 性能影响

### 数据库操作

**抽检10条（全部通过），视频共100条句子**：

| 操作 | 次数 | 说明 |
|------|------|------|
| SELECT（查询未抽检句子） | 1次 | 查询90条未抽检句子的ID |
| UPDATE（批量更新） | 1次 | 批量更新90条句子状态 |
| UPDATE（更新已抽检句子） | 10次 | 逐条更新抽检的10条句子 |

**总计**：约12次数据库操作，性能开销可忽略。

### 前端体验

- ⏱️ 提交时间：通常 < 2秒
- 📊 消息提示：实时反馈进度和结果
- 🔄 页面跳转：自动返回质检管理页面

---

## 🎉 总结

| 功能 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 抽检范围 | 只标记已抽检的句子 | 全部通过时自动标记所有句子 |
| 视频状态 | 仍显示"待质检" | 自动变为"已完成质检" |
| 用户体验 | 需要多次抽检 | 一次抽检即可完成 |
| 效率提升 | 基准 | 提升约70%（减少重复质检） |

✅ **新逻辑符合"抽检"的真实含义**：抽样检查通过，即认为整体合格！


## 📋 功能概述

**新功能**：质检时，如果抽检的句子全部通过，系统会自动将该视频的其他未抽检句子也标记为"质检通过"。

**解决的问题**：
- ❌ **旧逻辑**：抽检3条，只有这3条被标记，剩余句子仍显示"待质检"
- ✅ **新逻辑**：抽检3条全部通过 → 自动将剩余句子也标记为通过 → 整个视频从待质检列表消失

---

## 🎯 使用场景

### 场景1：抽检全部通过 ✅

**操作流程**：
1. 质检员选择一个视频（如：英语02.mp4，共82条句子）
2. 设置抽检比例：30%（系统随机抽取约25条）
3. 质检员逐条检查，全部标记为"通过" ✅
4. 点击"提交质检"

**系统行为**：
- ✅ 将抽检的25条标记为：`is_qualified = true`，`inspector = '质检员姓名'`
- ✅ **自动**将剩余57条也标记为：`is_qualified = true`，`inspector = '质检员姓名'`
- ✅ 显示消息："🎉 抽检完成！全部通过，整个视频已自动标记为质检通过（共82条）"
- ✅ 该视频从"待质检"列表中**消失**

---

### 场景2：抽检中有不通过 ❌

**操作流程**：
1. 质检员选择一个视频（如：数学02.mp4，共133条句子）
2. 设置抽检比例：30%（系统随机抽取约40条）
3. 质检员逐条检查，发现3条不通过 ❌，其余37条通过 ✅
4. 点击"提交质检"

**系统行为**：
- ✅ 将通过的37条标记为：`is_qualified = true`
- ❌ 将不通过的3条标记为：`is_qualified = false`，并记录到 `rejected_annotations` 表
- ⏸️ **不会**自动标记剩余93条（它们保持"待质检"状态）
- ⚠️ 显示消息："质检完成！错误率 7.5%，共提交 40 条数据"
- 📋 该视频**仍显示**在"待质检"列表中（因为还有93条未质检）

---

## 🔧 技术实现

### 修改的文件

1. **`src/pages/InspectionPage.tsx`**（核心修改）

**关键代码**（第106-232行）：

```typescript
// 提交质检
const handleSubmit = async () => {
  // ... 验证逻辑 ...
  
  const failedCount = inspectionData.filter(item => !item.isQualified).length;
  const allPassed = failedCount === 0; // 🆕 是否全部通过
  
  // 🆕 抽检逻辑优化：如果全部通过，自动将该视频的其他未抽检句子也标记为通过
  if (allPassed && inspectionData.length > 0) {
    const videoId = inspectionData[0].videoId;
    
    // 查询该视频的所有未质检的句子（排除当前已抽检的句子）
    const { data: uncheckedAnnotations } = await supabase
      .from('annotations')
      .select('id, sentence_no')
      .eq('video_id', videoId)
      .not('id', 'in', `(${annotationIds.join(',')})`)
      .or('inspector.is.null,inspector.eq.');
    
    // 批量更新未抽检的句子为"通过"
    await supabase
      .from('annotations')
      .update({
        is_qualified: true,
        inspector: inspectorName.trim()
      })
      .in('id', uncheckedAnnotations.map(item => item.id));
  }
  
  // ... 处理已抽检的句子 ...
};
```

---

## 📊 测试验证

### 步骤1：准备测试数据

运行 `TEST_spot_check_logic.sql` 查看测试视频的状态：

```sql
-- 查看郭其其的视频（用于测试）
SELECT 
    video_name,
    COUNT(*) as total_annotations,
    COUNT(CASE WHEN inspector IS NULL THEN 1 END) as pending_inspection
FROM annotations
WHERE annotator = '郭其其' AND status = true
GROUP BY video_name;
```

### 步骤2：进行抽检测试

1. 打开"选择视频进行质检"页面
2. 选择一个视频（如：英语02.mp4）
3. 设置抽检比例：30%
4. 进入质检页面
5. 将所有抽检的句子标记为"通过" ✅
6. 点击"提交质检"

### 步骤3：验证结果

运行验证SQL（在 `TEST_spot_check_logic.sql` 中）：

```sql
-- 验证：所有句子是否都已质检
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN inspector IS NOT NULL THEN 1 END) as inspected,
    CASE 
        WHEN COUNT(*) = COUNT(CASE WHEN inspector IS NOT NULL THEN 1 END)
        THEN '✅ 测试通过：所有句子都已质检'
        ELSE '❌ 测试失败：还有未质检的句子'
    END as test_result
FROM annotations
WHERE video_id = '您测试的视频ID';
```

**预期结果**：
- `total` = `inspected`
- `test_result` = '✅ 测试通过：所有句子都已质检'

---

## ⚠️ 注意事项

### 1. 只有"全部通过"才触发自动标记

- ✅ 抽检10条，全部通过 → 自动标记其他句子
- ❌ 抽检10条，9条通过1条不通过 → **不会**自动标记其他句子

### 2. 已质检的句子不会被覆盖

自动标记逻辑会排除：
- 已抽检的句子（当前批次）
- 之前已质检过的句子（`inspector` 不为空）

### 3. 数据库查询优化

使用的SQL查询：
```sql
SELECT id FROM annotations
WHERE video_id = '视频ID'
  AND id NOT IN (已抽检的句子ID列表)
  AND (inspector IS NULL OR inspector = '')
```

### 4. 错误处理

如果批量更新失败：
- ⚠️ 显示警告消息："部分未抽检句子自动标记失败，请手动检查"
- 📝 控制台输出详细错误信息
- ✅ 已抽检的句子仍会正常保存

---

## 🔍 常见问题

### Q1: 如果抽检比例是100%，还会触发自动标记吗？

**答**：不会。因为抽检比例是100%时，所有句子都已经被抽检，没有"未抽检的句子"需要自动标记。

### Q2: 如果视频有多个标注人，会影响自动标记吗？

**答**：不会。自动标记逻辑基于 `video_id`，只要是同一个视频，所有句子（无论标注人是谁）都会被处理。

### Q3: 自动标记后，如果发现有问题，怎么撤销？

**答**：
1. 方法1：在数据库中手动修改（不推荐）
2. 方法2：重新进入质检页面，对有问题的句子重新质检并打回

### Q4: 抽检时能否跳过某些句子？

**答**：不能。前端要求"请完成所有质检项"，必须对所有抽检的句子进行标记（通过或不通过）。

---

## 📈 性能影响

### 数据库操作

**抽检10条（全部通过），视频共100条句子**：

| 操作 | 次数 | 说明 |
|------|------|------|
| SELECT（查询未抽检句子） | 1次 | 查询90条未抽检句子的ID |
| UPDATE（批量更新） | 1次 | 批量更新90条句子状态 |
| UPDATE（更新已抽检句子） | 10次 | 逐条更新抽检的10条句子 |

**总计**：约12次数据库操作，性能开销可忽略。

### 前端体验

- ⏱️ 提交时间：通常 < 2秒
- 📊 消息提示：实时反馈进度和结果
- 🔄 页面跳转：自动返回质检管理页面

---

## 🎉 总结

| 功能 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 抽检范围 | 只标记已抽检的句子 | 全部通过时自动标记所有句子 |
| 视频状态 | 仍显示"待质检" | 自动变为"已完成质检" |
| 用户体验 | 需要多次抽检 | 一次抽检即可完成 |
| 效率提升 | 基准 | 提升约70%（减少重复质检） |

✅ **新逻辑符合"抽检"的真实含义**：抽样检查通过，即认为整体合格！

