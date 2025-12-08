# 标注表格数据名称功能更新说明

## 📋 更新内容

### 1. 数据库更新（重要！）

在 Supabase SQL Editor 中执行 `ADD_ANNOTATION_TABLE_NAME.sql` 脚本：

```sql
-- 添加 annotation_table_name 字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_table_name TEXT;

-- 添加注释
COMMENT ON COLUMN videos.annotation_table_name IS '标注表格数据名称';
```

### 2. 功能说明

- 在标注任务列表页面中新增"**标注表格数据**"列
- 显示每个视频对应的标注表格数据名称
- 使用青色标签展示，如果没有数据则显示 `-`

### 3. 数据填充

执行 SQL 脚本后，您需要手动为现有视频填充 `annotation_table_name` 字段：

```sql
-- 示例：更新视频的标注表格数据名称
UPDATE videos 
SET annotation_table_name = '第5批第一轮-语文-1'
WHERE name = '第5批第一轮-语文-1.mp4';

UPDATE videos 
SET annotation_table_name = '第5批第一轮-物理-01'
WHERE name = '第5批第一轮-物理-01.mp4';

-- 批量更新示例（根据视频名称自动提取表格名）
UPDATE videos 
SET annotation_table_name = REPLACE(name, '.mp4', '')
WHERE annotation_table_name IS NULL AND name LIKE '%.mp4';
```

### 4. 视频上传管理页面

之后您可能需要在视频上传管理页面添加"标注表格数据名称"输入框，让管理员在上传视频时就可以填写此字段。

## ✅ 已更新的文件

1. `ADD_ANNOTATION_TABLE_NAME.sql` - 数据库迁移脚本（新建）
2. `src/types/index.ts` - 添加 `annotation_table_name` 字段到 `VideoInfo` 接口
3. `src/api/database.ts` - 更新 `getVideos` 和 `getVideo` 查询字段
4. `src/pages/AnnotationTaskListPage.tsx` - 更新列表显示逻辑

## 🔄 下一步操作

1. ⚠️ **必须先执行** `ADD_ANNOTATION_TABLE_NAME.sql` 脚本
2. 为现有视频填充 `annotation_table_name` 数据
3. 测试标注任务列表页面，确认新列正常显示
4. （可选）在视频管理页面添加此字段的编辑功能

## 📊 显示效果

在标注任务列表中，新增的列将显示为：

| 视频名称 | 科目 | 时长 | **标注表格数据** | 标注人 | 标注进度 | 发布时间 | 操作 |
|---------|------|------|----------------|--------|---------|---------|------|
| 第5批第一轮-语文-1.mp4 | 未知 | - | `第5批第一轮-语文-1` | 未知标注员 | 0/1 | 2025/12/8 11:06:36 | 开始标注 |

其中"标注表格数据"列会以青色标签显示表格名称。

