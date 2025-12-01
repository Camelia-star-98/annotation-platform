# 打回逻辑优化 - 快速部署清单

## ✅ 优化完成

本次优化已完成以下功能：

1. ✅ **所有人可见所有被打回数据**
2. ✅ **重新提交生成新记录，保留历史**
3. ✅ **历史版本查看功能（时间线展示）**
4. ✅ **向后兼容旧逻辑**

---

## 🚀 部署步骤（3 步完成）

### 第 1 步：执行数据库迁移（5分钟）

```bash
# 在 Supabase SQL Editor 中运行
CREATE_REJECTED_ANNOTATIONS_TABLE.sql
```

**说明**：
- 创建 `rejected_annotations` 表
- 自动迁移现有被打回数据
- 添加索引优化性能
- 设置权限（所有人可读）

**验证**：
```sql
-- 检查表是否创建成功
SELECT * FROM rejected_annotations LIMIT 5;

-- 检查数据是否迁移
SELECT COUNT(*) FROM rejected_annotations;
```

---

### 第 2 步：部署前端代码（2分钟）

```bash
cd /Users/ailian/Downloads/annotation-platform

# 提交代码
git add .
git commit -m "优化打回逻辑：所有人可见 & 历史版本查看"
git push

# 如果使用自动部署，等待部署完成
# 如果手动部署，执行：
npm run build
# 然后部署 dist 目录
```

---

### 第 3 步：验证功能（3分钟）

#### 1. 验证打回功能
- 质检人打回一条数据
- 检查 `rejected_annotations` 表是否有新记录
- 检查 `annotations` 表的 `is_qualified` 是否为 `false`

#### 2. 验证被打回列表
- 任意标注人登录
- 查看"被打回重标"标签页
- 应该能看到所有人的被打回数据（不只是自己的）

#### 3. 验证重新提交
- 标注人修改后重新提交
- 检查是否生成了新记录（新ID，包含时间戳）
- 检查 `rejected_annotations` 表的 `is_resubmitted` 是否为 `true`
- 检查新旧记录是否都存在（历史完整）

#### 4. 验证历史版本查看
- 在"被打回重标"列表，点击"历史"按钮
- 在质检页面，点击"历史"按钮
- 检查是否显示完整的历史版本时间线
- 检查版本信息是否正确

---

## 📋 文件清单

### 新增文件
- `CREATE_REJECTED_ANNOTATIONS_TABLE.sql`：数据库迁移脚本
- `REJECTION_OPTIMIZATION_GUIDE.md`：详细优化说明
- `DEPLOYMENT_CHECKLIST.md`：本文件
- `src/components/AnnotationHistoryModal.tsx`：历史版本查看组件

### 修改文件
- `src/pages/InspectionPage.tsx`：质检打回 + 历史查看
- `src/pages/AnnotationTaskListPage.tsx`：所有人可见 + 历史查看
- `src/pages/AnnotationPage.tsx`：重新提交生成新记录

---

## 🎯 关键变化

### 数据库
```
新表：rejected_annotations
- 记录所有被打回的数据
- 所有人都可以查询（SELECT）
- 支持历史版本追踪
```

### 打回流程
```
旧：质检打回 → 更新 annotations 表 → 只有原标注人可见
新：质检打回 → 更新 annotations 表 + 写入 rejected_annotations 表 → 所有人可见
```

### 重新提交流程
```
旧：重新提交 → 更新原记录 → 覆盖历史
新：重新提交 → 生成新记录（新ID） + 更新 rejected_annotations → 保留历史
```

### 历史查看
```
新：点击"历史"按钮 → 递归查询所有版本 → 时间线展示
- 支持多次打回的完整历史
- 显示每个版本的详细信息
- 标记状态和时间
```

---

## ⚠️ 注意事项

### 1. 数据一致性
- 确保先部署数据库，再部署前端
- 如果前端先部署，功能会自动回退到旧逻辑（兼容设计）

### 2. 权限设置
- `rejected_annotations` 表默认所有人可读
- 建议检查 Supabase RLS 策略是否正确

### 3. 性能优化
- 已添加索引：`video_id`, `annotator`, `is_resubmitted`
- 历史查询使用递归，数据量大时注意性能

### 4. 数据迁移
- SQL 脚本会自动迁移现有被打回数据
- 迁移后可以删除 `annotations` 表中 `is_qualified=false` 的旧记录（可选）

---

## 🐛 故障排查

### 问题1：看不到其他人的被打回数据
**原因**：`rejected_annotations` 表不存在或权限设置错误

**解决**：
```sql
-- 检查表是否存在
SELECT * FROM rejected_annotations LIMIT 1;

-- 检查权限
SELECT * FROM information_schema.table_privileges 
WHERE table_name = 'rejected_annotations';
```

### 问题2：历史版本查看报错
**原因**：`rejected_annotations` 表字段不完整

**解决**：
```sql
-- 检查字段
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'rejected_annotations';

-- 确保包含：annotation_id, new_annotation_id, is_resubmitted 等
```

### 问题3：重新提交后ID冲突
**原因**：时间戳相同（极少见）

**解决**：代码已添加 `index` 后缀确保唯一性，一般不会发生

---

## 📞 支持

如有问题，请查看：
- 详细文档：`REJECTION_OPTIMIZATION_GUIDE.md`
- 数据库脚本：`CREATE_REJECTED_ANNOTATIONS_TABLE.sql`
- 代码文件：
  - `src/pages/InspectionPage.tsx`
  - `src/pages/AnnotationTaskListPage.tsx`
  - `src/pages/AnnotationPage.tsx`
  - `src/components/AnnotationHistoryModal.tsx`

---

## ✨ 下一步（可选）

完成基础部署后，可以考虑：
1. 添加版本对比功能（diff 差异高亮）
2. 添加质检统计面板（打回率、常见问题等）
3. 添加自动提醒功能（邮件/消息通知）
4. 优化历史查询性能（缓存、分页等）

---

**部署完成后记得验证所有功能！** 🎉

