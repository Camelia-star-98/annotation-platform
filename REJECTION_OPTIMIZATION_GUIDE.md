# 打回逻辑优化说明

## 📋 优化目标

优化标注打回机制，实现：
1. ✅ **所有人可见**：任何标注人都能看到所有被打回的数据
2. ✅ **历史追踪**：重新提交时生成新记录，保留完整的修改历史
3. ✅ **独立记录**：打回数据单独存储在 `rejected_annotations` 表

---

## 🔄 优化前 vs 优化后

### 优化前的问题

```
质检打回 → 更新 annotations 表 (is_qualified=false)
                    ↓
          只有原标注人能在"被打回标注"看到
                    ↓
          重新提交 → 更新原记录 (覆盖历史数据)
                    ↓
                无法追踪修改历史
```

**问题清单**：
- ❌ 打回数据只有原标注人可见
- ❌ 重新提交覆盖原数据，无法追踪历史
- ❌ 无法统计打回率、重复打回次数等数据
- ❌ 无法查看同一条数据的多个版本

### 优化后的流程

```
质检打回 → 1. 更新 annotations 表 (is_qualified=false)
           2. 写入 rejected_annotations 表（新记录）
                    ↓
          所有标注人都能在"被打回标注"看到所有数据
                    ↓
          重新提交 → 1. 生成新的 annotation 记录（新ID）
                    2. 更新 rejected_annotations (is_resubmitted=true)
                    ↓
          保留完整的修改历史（可追踪）
```

**改进清单**：
- ✅ 所有标注人可见所有被打回数据（便于相互学习）
- ✅ 每次重新提交生成新记录，完整保留历史
- ✅ 可统计打回率、重复打回次数等质检指标
- ✅ 可查看同一条数据的所有版本（未来可扩展）

---

## 🗄️ 数据库变更

### 新表：`rejected_annotations`

**作用**：记录所有被质检打回的标注数据

**关键字段**：
- `annotation_id`: 原始 annotation 记录的ID
- `is_resubmitted`: 是否已重新提交（false=待修改，true=已提交）
- `new_annotation_id`: 重新提交后生成的新记录ID
- `rejection_count`: 第几次被打回
- `inspector`: 谁打回的（质检人）
- `annotator`: 被打回的标注人
- `rejected_at`: 打回时间
- `resubmitted_at`: 重新提交时间

**权限设置**：
```sql
-- 所有人都可以查看被打回数据（SELECT）
-- 质检人可以插入被打回数据（INSERT）
-- 系统可以更新重新提交状态（UPDATE）
```

**创建脚本**：`CREATE_REJECTED_ANNOTATIONS_TABLE.sql`

---

## 💻 代码变更

### 1. InspectionPage.tsx（质检页面）

**修改位置**：`handleSubmit` 函数

**新增逻辑**：
```typescript
// 质检不通过时，写入 rejected_annotations 表
if (item.isQualified === false) {
  // ... 原有的 rejection_count 逻辑
  
  // 🆕 写入 rejected_annotations 表
  await supabase
    .from('rejected_annotations')
    .insert({
      annotation_id: item.id,
      video_id: item.videoId,
      video_name: item.videoName,
      // ... 其他字段
      is_resubmitted: false
    });
}
```

**效果**：每次打回时，不仅更新 annotations 表，还会在 rejected_annotations 表中创建一条记录。

---

### 2. AnnotationTaskListPage.tsx（标注任务列表）

**修改位置**：`loadRejectedItems` 函数

**旧逻辑**：
```typescript
// 只查询当前标注人的被打回数据
.eq('annotator', annotatorName)
.eq('is_qualified', false)
```

**新逻辑**：
```typescript
// 🆕 查询所有人的被打回数据（从 rejected_annotations 表）
const { data } = await supabase
  .from('rejected_annotations')
  .select('*')
  .eq('is_resubmitted', false) // 只显示未重新提交的
  .order('rejected_at', { ascending: false });
```

**效果**：所有标注人都能看到所有被打回的数据，便于相互学习。

**回退逻辑**：如果 `rejected_annotations` 表不存在，自动回退到旧逻辑（只查询当前标注人）。

---

### 3. AnnotationPage.tsx（标注页面）

**修改位置**：`handleSubmit` 函数

**新增逻辑**：
```typescript
// 🆕 检查是否是重新提交
const isResubmission = annotations.some(item => 
  item.rejectionCount && item.rejectionCount > 0
);

if (isResubmission) {
  // 1. 生成新的ID（添加时间戳）
  const timestamp = Date.now();
  const newId = `${videoId}_${sentenceNo}_${userName}_${timestamp}`;
  
  // 2. 保存新记录
  await saveAnnotations(videoId, annotationsWithNewIds);
  
  // 3. 更新 rejected_annotations 表
  await supabase
    .from('rejected_annotations')
    .update({
      is_resubmitted: true,
      new_annotation_id: newId,
      resubmitted_at: new Date().toISOString()
    })
    .eq('annotation_id', oldId)
    .eq('is_resubmitted', false);
}
```

**效果**：
- 重新提交时生成新记录（不覆盖旧记录）
- 在 rejected_annotations 表中标记为"已重新提交"
- 保留完整的修改历史

---

### 4. AnnotationHistoryModal.tsx（历史版本查看组件）

**新组件**：`src/components/AnnotationHistoryModal.tsx`

**功能**：
```typescript
// 递归查询所有历史版本
const findAllVersions = async (currentId, versions, visited) => {
  // 1. 查询当前记录（annotations 表）
  const annotation = await supabase
    .from('annotations')
    .select('*')
    .eq('id', currentId)
    .single();
  
  // 2. 查询被打回记录（rejected_annotations 表）
  const rejectedData = await supabase
    .from('rejected_annotations')
    .select('*')
    .eq('annotation_id', currentId);
  
  // 3. 递归查询新版本
  for (const rejected of rejectedData) {
    if (rejected.new_annotation_id) {
      await findAllVersions(rejected.new_annotation_id, versions, visited);
    }
  }
  
  // 4. 反向查询：看是否有其他记录指向当前记录
  const previousRejections = await supabase
    .from('rejected_annotations')
    .select('*')
    .eq('new_annotation_id', currentId);
};
```

**效果**：
- 时间线展示所有版本
- 详细展示每个版本的内容和状态
- 支持多次打回的完整历史追踪

**集成位置**：
- `AnnotationTaskListPage.tsx`（被打回列表的"历史"按钮）
- `InspectionPage.tsx`（质检页面的"历史"按钮）

---

## 📊 数据流程图

### 完整的标注 → 质检 → 打回 → 重新提交流程

```
┌─────────────────────────────────────────────────────────────┐
│                    1. 标注人提交标注                         │
│                    annotations 表                            │
│  id: video1_1_张三, annotator: 张三, is_qualified: null    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. 质检人质检                             │
│                 质检结果：不通过                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              3. 系统执行（InspectionPage）                   │
│                                                               │
│  A. 更新 annotations 表：                                    │
│     is_qualified: false, rejection_count: 1                 │
│                                                               │
│  B. 写入 rejected_annotations 表：🆕                        │
│     annotation_id: video1_1_张三                            │
│     annotator: 张三                                          │
│     inspector: 李四（质检人）                                 │
│     is_resubmitted: false                                    │
│     rejection_count: 1                                       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          4. 所有标注人可见（AnnotationTaskListPage）         │
│                "被打回标注" 列表                              │
│                                                               │
│  📋 显示所有未重新提交的打回数据：                           │
│     - 张三的数据（自己）                                      │
│     - 王五的数据（其他人）                                    │
│     - 赵六的数据（其他人）                                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              5. 张三修改后重新提交                            │
│                 （AnnotationPage）                           │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              6. 系统执行（AnnotationPage）                   │
│                                                               │
│  A. 生成新记录到 annotations 表：🆕                         │
│     id: video1_1_张三_1733097600000                         │
│     annotator: 张三                                          │
│     is_qualified: null                                       │
│     rejection_count: 1 （保留次数）                          │
│                                                               │
│  B. 更新 rejected_annotations 表：🆕                        │
│     annotation_id: video1_1_张三                            │
│     is_resubmitted: true                                     │
│     new_annotation_id: video1_1_张三_1733097600000          │
│     resubmitted_at: 2025-12-01 10:00:00                     │
│                                                               │
│  C. 旧记录 (video1_1_张三) 保留不变                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              7. 新记录重新进入质检队列                        │
│                                                               │
│  质检人看到的是新记录：video1_1_张三_1733097600000          │
│  可以查看历史记录（通过 rejected_annotations）              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 使用说明

### 部署步骤

1. **执行数据库迁移**
   ```bash
   # 在 Supabase SQL Editor 中运行
   CREATE_REJECTED_ANNOTATIONS_TABLE.sql
   ```

2. **部署前端代码**
   ```bash
   git add .
   git commit -m "优化打回逻辑：所有人可见 & 生成新记录"
   git push
   ```

3. **验证功能**
   - 质检人打回数据 → 检查 rejected_annotations 表是否有新记录
   - 标注人查看被打回列表 → 能看到所有人的打回数据
   - 标注人重新提交 → 检查是否生成新记录（新ID）

### 对现有数据的影响

- ✅ **向后兼容**：如果 `rejected_annotations` 表不存在，自动回退到旧逻辑
- ✅ **数据迁移**：SQL 脚本会自动迁移现有的被打回数据
- ✅ **无需清空数据**：可以直接在生产环境部署

---

## 📈 未来扩展

### 已实现的功能 ✅

1. **历史版本查看** ✅
   - 在标注任务列表的"被打回列表"中，点击"历史"按钮查看
   - 在质检页面，点击"历史"按钮查看标注的完整历史
   - 递归查询 `rejected_annotations` 和 `annotations` 表
   - 时间线展示，最新版本在上，原始版本在下
   - 显示每个版本的详细信息：标注内容、质检状态、打回时间、重新提交时间等
   - 支持多次打回的完整历史追踪

### 可以继续添加的功能

1. **版本对比功能**
   - 在历史版本查看中，选择两个版本进行对比
   - 高亮显示差异部分（使用 diff 算法）
   - 快速看到每次修改的变化

2. **质检统计面板**
   ```sql
   -- 打回率统计
   SELECT 
     annotator,
     COUNT(*) as total_rejections,
     AVG(rejection_count) as avg_rejection_count
   FROM rejected_annotations
   GROUP BY annotator;
   
   -- 最常见的打回原因
   SELECT 
     major_category,
     COUNT(*) as count
   FROM rejected_annotations
   GROUP BY major_category
   ORDER BY count DESC;
   ```

3. **打回原因分析**
   - 在质检页面添加"打回原因"输入框
   - 存储到 `rejected_annotations.rejection_reason`
   - 生成打回原因分析报告

3. **自动提醒**
   - 标注人有被打回数据时显示通知
   - 邮件/消息提醒标注人及时修改

---

## 🎨 历史版本查看功能说明

### 功能入口

1. **标注任务列表页面**（AnnotationTaskListPage）
   - 在"被打回重标"标签页
   - 每条被打回数据右侧有"历史"按钮
   - 点击查看该数据的完整历史版本

2. **质检页面**（InspectionPage）
   - 在质检表格的最右侧"操作"列
   - 每条数据都有"历史"按钮
   - 方便质检人员查看标注的历史记录

### 界面展示

历史版本模态框包含：
- **时间线展示**：清晰展示从原始版本到最新版本的演变
- **版本标记**：
  - 🆕 当前版本（最新）
  - 📝 原始版本（第一次提交）
  - 被打回 X 次（如果有多次打回）
- **状态标签**：
  - 🔵 待质检
  - ✅ 质检通过
  - ❌ 被打回
  - 🟠 已重新提交
- **详细信息**：
  - 标注人、质检人
  - 原文、标注结果、大类/小类、备注
  - 创建时间、打回时间、重新提交时间
- **版本链接**：显示每个版本与下一版本的关系

### 数据查询逻辑

```typescript
// 递归查询所有版本
1. 从当前 annotation_id 开始
2. 查询 annotations 表获取详细信息
3. 查询 rejected_annotations 表：
   - 看是否被打回过（annotation_id = 当前ID）
   - 看是否是某个版本的新版本（new_annotation_id = 当前ID）
4. 递归查询所有相关版本
5. 按时间排序，最新的在前
```

### 使用场景

1. **标注人**：
   - 查看自己被打回数据的修改历史
   - 了解每次打回的原因
   - 对比不同版本的改进

2. **质检人**：
   - 查看标注人的修改历史
   - 判断问题是否真正解决
   - 避免重复打回相同问题

3. **管理员**：
   - 审计标注质量
   - 分析常见问题
   - 培训和改进依据

---

## ⚠️ 注意事项

1. **ID 命名规则**
   - 首次提交：`{videoId}_{sentenceNo}_{annotator}`
   - 重新提交：`{videoId}_{sentenceNo}_{annotator}_{timestamp}_{index}`
   - 确保 ID 唯一性

2. **权限控制**
   - `rejected_annotations` 表所有人可读
   - 但建议添加"只能修改自己的数据"的权限控制

3. **性能优化**
   - `rejected_annotations` 表已添加索引
   - 如果数据量很大，考虑定期归档已重新提交的记录

4. **数据一致性**
   - 确保 `rejected_annotations` 和 `annotations` 表的数据同步
   - 建议添加定期检查脚本

---

## 🐛 故障排查

### 问题1：看不到被打回数据

**原因**：`rejected_annotations` 表不存在或未迁移数据

**解决**：
```bash
# 检查表是否存在
SELECT * FROM rejected_annotations LIMIT 1;

# 如果不存在，执行迁移脚本
CREATE_REJECTED_ANNOTATIONS_TABLE.sql
```

### 问题2：重新提交后仍显示在被打回列表

**原因**：`rejected_annotations` 表未正确更新 `is_resubmitted`

**解决**：
```sql
-- 手动标记为已重新提交
UPDATE rejected_annotations
SET is_resubmitted = true,
    resubmitted_at = NOW()
WHERE annotation_id = '问题记录的ID';
```

### 问题3：重新提交后 ID 冲突

**原因**：时间戳相同（极少见）

**解决**：
- 代码已添加 `index` 后缀确保唯一性
- 如果仍有问题，可以改用 UUID

---

## 📝 变更日志

### v2.0.0 (2025-12-01)

**新增功能**：
- ✅ 创建 `rejected_annotations` 表
- ✅ 质检打回时自动记录到 `rejected_annotations`
- ✅ 所有人可查看所有被打回数据
- ✅ 重新提交时生成新记录，保留历史
- ✅ 历史版本查看功能（时间线展示）

**改进**：
- ✅ 向后兼容旧逻辑（回退机制）
- ✅ 自动迁移现有被打回数据
- ✅ 添加索引优化查询性能
- ✅ 递归查询支持多次打回的完整历史

**新增组件**：
- ✅ `AnnotationHistoryModal`：历史版本查看模态框

**测试**：
- ✅ 质检打回功能测试
- ✅ 被打回列表展示测试
- ✅ 重新提交功能测试
- ✅ 数据迁移测试
- ✅ 历史版本查看测试

---

## 📞 技术支持

如有问题，请联系开发团队或查看：
- 数据库迁移脚本：`CREATE_REJECTED_ANNOTATIONS_TABLE.sql`
- 相关代码文件：
  - `src/pages/InspectionPage.tsx`（质检页面）
  - `src/pages/AnnotationTaskListPage.tsx`（标注任务列表）
  - `src/pages/AnnotationPage.tsx`（标注页面）
  - `src/components/AnnotationHistoryModal.tsx`（历史版本查看组件）

