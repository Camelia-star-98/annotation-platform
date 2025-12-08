# 添加标注数据文件名显示功能

## 📋 功能说明

在标注任务列表页面显示上传的标注数据文件名，方便查看和管理。

## 🔧 实施步骤

### 步骤1：在 Supabase 添加字段

在 Supabase Dashboard 的 SQL Editor 中执行 `ADD_ANNOTATION_FILE_NAME.sql`：

```sql
-- 添加 annotation_file_name 字段到 videos 表
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotation_file_name TEXT;

-- 添加注释
COMMENT ON COLUMN videos.annotation_file_name IS '标注数据文件名（上传的Excel文件名）';
```

### 步骤2：刷新应用

在 Supabase 执行完 SQL 后，刷新前端页面即可看到效果。

## 📝 修改的文件

1. **类型定义** (`src/types/index.ts`)
   - 在 `VideoInfo` 接口添加 `annotation_file_name?: string;` 字段

2. **上传代码** (`src/pages/VideoManagePage.tsx`)
   - 在上传标注数据时保存文件名：`annotation_file_name: excelFile.name`

3. **数据库查询** (`src/api/database.ts`)
   - 查询时包含 `annotation_file_name` 字段

4. **列表展示** (`src/pages/AnnotationTaskListPage.tsx`)
   - 添加"标注文件名"列显示文件名

## ✅ 效果

在"待标注任务"和"所有已标注任务"列表中，会显示一个新列"标注文件名"，展示上传时的Excel文件名。

## 🎨 示例

| 视频名称 | 科目 | 标注文件名 | 时长 | 标注人数 |
|---------|------|-----------|------|---------|
| 数学第一课 | 数学 | 数学_标注数据.xlsx | 10:30 | 3/5 |
| 英语阅读 | 英语 | english_annotations.xlsx | 08:15 | 2/3 |

