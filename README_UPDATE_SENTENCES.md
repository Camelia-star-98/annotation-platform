# 更新 videos.total_sentences 字段

## 📋 概述

这个工具集用于为 `videos` 表添加 `total_sentences` 字段，并自动计算和更新每个视频的总句数。

## 🚀 快速开始

### 方法一：使用引导页面（推荐）

1. 打开 `add_total_sentences_field.html` 文件
2. 按照页面上的 4 个步骤操作：
   - ✅ SQL 会自动复制
   - 🔗 点击按钮打开 Supabase SQL Editor
   - 📝 粘贴并执行 SQL
   - ⚡ 运行更新脚本

### 方法二：手动执行

#### 步骤 1：添加字段

在 Supabase SQL Editor 中执行：

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0;
```

SQL Editor 链接：
https://supabase.com/dashboard/project/dcqwxvekgxgjujurpipg/sql

#### 步骤 2：更新数据

运行自动更新脚本：

```bash
node auto_update_sentences_standalone.js
```

或者在浏览器中打开：
```bash
open auto_update_total_sentences.html
```

## 📁 文件说明

### HTML 文件

- **add_total_sentences_field.html** - 🎯 一键引导页面（推荐使用）
  - 自动复制 SQL 语句
  - 一键打开 SQL Editor
  - 提供完整的操作引导

- **auto_update_total_sentences.html** - 🔧 手动分步操作页面
  - 步骤1：检查表结构
  - 步骤2：添加字段（显示 SQL）
  - 步骤3：更新数据
  - 步骤4：验证结果

- **update_total_sentences.html** - 📊 原始手动操作页面
  - 需要逐步点击按钮
  - 适合了解每一步详细过程

### JavaScript 文件

- **auto_update_sentences_standalone.js** - 🌟 独立自动化脚本（推荐）
  - 使用原生 Node.js，无需安装依赖
  - 自动检测字段是否存在
  - 自动更新所有视频数据
  - 自动验证结果

- **auto_update_sentences.js** - 📦 需要 @supabase/supabase-js 依赖
  - 功能同上
  - 需要先运行 `npm install @supabase/supabase-js`

## 🔄 工作流程

```
1. 检查表结构
   ↓
2. 添加 total_sentences 字段（如不存在）
   ↓
3. 遍历所有视频
   ↓
4. 对每个视频：
   - 查询所有标注的句子编号
   - 去重计算总句数
   - 更新到 total_sentences 字段
   ↓
5. 验证结果
```

## 📊 字段说明

### total_sentences

- **类型**: INTEGER
- **默认值**: 0
- **含义**: 该视频中不同句子的总数
- **计算方式**: 从 `annotations` 表中查询该视频的所有 `sentence_no`，去重后计数

## ✅ 验证

更新完成后，脚本会自动验证最近的 10-20 个视频，对比 `total_sentences` 字段值与实际标注的句子数是否一致。

## ⚠️ 注意事项

1. **权限要求**：Supabase 的 anon key 无法执行 DDL 语句（ALTER TABLE），必须通过 SQL Editor 手动执行
2. **数据一致性**：脚本会跳过已经正确的数据，只更新需要更新的记录
3. **执行时间**：取决于视频数量，每个视频需要查询一次 annotations 表
4. **网络要求**：需要能访问 Supabase API

## 🎯 使用场景

- 首次为现有视频添加总句数统计
- 数据修复：当 total_sentences 不准确时重新计算
- 定期维护：确保数据一致性

## 📞 问题排查

### 问题 1：字段已存在但数据为空

**解决方案**：直接运行更新脚本
```bash
node auto_update_sentences_standalone.js
```

### 问题 2：无法执行 SQL

**解决方案**：
1. 确认已登录 Supabase Dashboard
2. 使用 SQL Editor 而不是 API
3. 检查项目 URL 是否正确

### 问题 3：更新脚本报错

**解决方案**：
1. 检查网络连接
2. 确认 Supabase URL 和 API Key 正确
3. 查看具体错误信息

## 🔗 相关链接

- Supabase Dashboard: https://supabase.com/dashboard
- SQL Editor: https://supabase.com/dashboard/project/dcqwxvekgxgjujurpipg/sql
- Table Editor: https://supabase.com/dashboard/project/dcqwxvekgxgjujurpipg/editor

---

**最后更新**: 2025-12-01
**版本**: 1.0

