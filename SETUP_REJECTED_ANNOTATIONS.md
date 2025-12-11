# 设置 rejected_annotations 表

## 问题说明

"被打回重标"功能需要 `rejected_annotations` 表来存储被质检打回的数据。如果该表不存在，会导致：
- ❌ 被打回重标标签页无法显示数据
- ❌ 标注人无法看到自己的标注
- ❌ Console 显示错误：`Could not find the table 'public.rejected_annotations'`

## 解决方案

### 方法1：使用 Supabase SQL Editor（推荐）

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目

2. **打开 SQL Editor**
   - 在左侧菜单点击 "SQL Editor"
   - 点击 "New Query"

3. **执行 SQL 脚本**
   - 打开项目文件：`CREATE_REJECTED_ANNOTATIONS_TABLE.sql`
   - 复制全部内容
   - 粘贴到 SQL Editor
   - 点击 "Run" 或按 `Ctrl/Cmd + Enter`

4. **验证结果**
   - 应该看到：`✅ rejected_annotations 表创建成功！`
   - 显示迁移的记录数量

### 方法2：使用辅助HTML页面

1. **打开检查页面**
   ```bash
   open create_rejected_annotations_table.html
   ```

2. **检查表状态**
   - 页面会自动检查表是否存在
   - 如果不存在，按照页面指引操作

3. **迁移数据**
   - 表创建成功后，点击"迁移现有数据"按钮
   - 将 `annotations` 表中的被打回数据迁移到新表

## 表结构说明

`rejected_annotations` 表包含以下关键字段：

- `annotation_id`: 原始标注记录ID
- `video_id`: 视频ID
- `video_name`: 视频名称
- `annotator`: **标注人姓名**（重要！）
- `inspector`: **质检人姓名**（重要！）
- `rejection_reason`: 打回原因
- `is_resubmitted`: 是否已重新提交
- `rejected_at`: 打回时间

## 验证步骤

执行SQL后，运行以下查询验证：

```sql
-- 1. 检查表是否存在
SELECT COUNT(*) as total_rejected FROM rejected_annotations;

-- 2. 查看标注人和质检人
SELECT 
  COUNT(*) as count,
  COUNT(DISTINCT annotator) as unique_annotators,
  COUNT(DISTINCT inspector) as unique_inspectors
FROM rejected_annotations;

-- 3. 查看样本数据
SELECT 
  video_name,
  annotator,
  inspector,
  rejected_at
FROM rejected_annotations
LIMIT 5;
```

## 预期结果

创建成功后，你应该能够：

✅ 在"被打回重标"标签页看到数据  
✅ 看到每个视频的标注人列表（紫色标签）  
✅ 看到每个视频的质检人列表（红色标签）  
✅ 看到被打回句子数量  
✅ 点击"开始修改"进入标注页面  

## 问题排查

### 如果标注人/质检人列表为空

1. 检查原始数据：
```sql
SELECT annotator, inspector 
FROM annotations 
WHERE is_qualified = false 
LIMIT 10;
```

2. 检查是否有空值：
```sql
SELECT 
  COUNT(*) as total,
  COUNT(annotator) as with_annotator,
  COUNT(inspector) as with_inspector
FROM rejected_annotations;
```

### 如果表已存在但数据不正确

重新迁移数据：
1. 打开 `create_rejected_annotations_table.html`
2. 点击"迁移现有数据"
3. 等待迁移完成

## 相关文件

- `CREATE_REJECTED_ANNOTATIONS_TABLE.sql` - 创建表的SQL脚本
- `create_rejected_annotations_table.html` - 辅助工具页面
- `src/pages/AnnotationTaskListPage.tsx` - 使用该表的主页面

