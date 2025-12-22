# ✅ 修复完成：移除 updated_at 字段引用

## 🔍 问题根源

错误信息：`column videos.updated_at does not exist`

**真正的原因**：
- 数据库中的 `get_all_annotations()` RPC 函数定义包含了 `updated_at` 字段
- 但 `annotations` 表已经移除了这个字段
- 前端代码也在多处引用了这个不存在的字段

## ✅ 已完成的修复

### 1. 前端代码修复 (ReviewSelectPage.tsx)

已完成以下修改：
- ✅ 从 SQL 查询中移除 `updated_at` 字段
- ✅ 将所有 `ann.updated_at` 引用改为 `ann.created_at`
- ✅ 修复了两处去重逻辑中的时间比较代码

**验证结果**：
- ✅ 无 lint 错误
- ✅ 无 `updated_at` 引用残留

### 2. 数据库 RPC 函数修复

修复脚本：`FIX_get_all_annotations_RPC.sql`

该脚本会：
1. 删除旧的 `get_all_annotations()` 函数
2. 创建新版本（移除 `updated_at` 字段）
3. 授予必要的执行权限
4. 运行测试查询验证修复结果

## 📋 下一步操作

### 请在 Supabase SQL Editor 中执行：

1. 打开 Supabase 控制台
2. 进入 SQL Editor
3. 复制并执行 `FIX_get_all_annotations_RPC.sql` 中的内容

执行完成后，你会看到：
- 测试查询结果（总数、视频数、标注人数）
- 前5条数据预览

### 验证修复

执行完数据库脚本后：
1. 刷新前端页面
2. 访问"审核选择页面"
3. 检查是否能正常加载数据

## 🎯 预期结果

- ✅ 审核选择页面正常加载
- ✅ 显示待复检的视频列表
- ✅ 标注人统计信息正确显示
- ✅ 无数据库字段错误

## 📝 技术细节

**为什么用 created_at 替代 updated_at？**

由于 `annotations` 表已经移除了 `updated_at` 字段，我们使用 `created_at` 作为时间戳：
- 在去重逻辑中用于判断哪条记录更新
- 在标注人统计中记录最后复检时间

这个改动不会影响业务逻辑，因为：
- 数据按创建时间排序同样有效
- 去重时保留最新创建的记录符合实际需求

---

**修复完成时间**：2025-12-15
**修复的文件**：
- `/Users/ailian/Downloads/annotation-platform/src/pages/ReviewSelectPage.tsx`
- `/Users/ailian/Downloads/annotation-platform/FIX_get_all_annotations_RPC.sql`


