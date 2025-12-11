# 🚀 郭其其问题修复 - 操作指南

## 📋 问题概述
郭其其在"被打回的数据"页面看不到她的6条被打回记录，原因是 `rejected_annotations` 表中这些记录的 `annotator` 字段为空。

---

## ✅ 修复步骤（按顺序执行）

### Step 1: 运行诊断脚本（了解问题范围）

打开并执行 `FIX_ALL_missing_annotators.sql` 的**前3个查询**（不包括修复部分）：

1. 查看缺失标注人的记录总数
2. 查看按视频分组的统计
3. 查看修复预览（前20条）

**预期结果**：
- 应该看到有一定数量的记录缺失标注人
- "第七批第一次改写_语文-01.xlsx"应该有6条

---

### Step 2: 执行数据修复

在 `FIX_ALL_missing_annotators.sql` 中：

1. **取消注释** Step 4 的修复代码（删除开头的 `/*` 和结尾的 `*/`）
2. **执行整个脚本**

**修复代码**：
```sql
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 执行修复
  WITH to_update AS (
    SELECT 
      ra.id AS rejected_id,
      a.annotator AS correct_annotator
    FROM rejected_annotations ra
    JOIN annotations a ON a.video_id = ra.video_id AND a.sentence_no = ra.sentence_no
    WHERE (ra.annotator IS NULL OR ra.annotator = '')
      AND a.annotator IS NOT NULL 
      AND a.annotator != ''
  )
  UPDATE rejected_annotations ra
  SET 
    annotator = tu.correct_annotator,
    updated_at = NOW()
  FROM to_update tu
  WHERE ra.id = tu.rejected_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 成功修复 % 条记录', updated_count;
END $$;
```

**预期结果**：
- 看到消息：`✅ 成功修复 X 条记录`（X应该 ≥ 6）

---

### Step 3: 验证修复结果

执行 `VERIFY_fix_result.sql` 脚本，检查5个验证步骤：

✅ **步骤1**：郭其其的被打回记录数 ≥ 6
✅ **步骤2**：能看到详细记录（包含"第七批第一次改写_语文-01.xlsx"的6条）
✅ **步骤3**：没有空记录
✅ **步骤4**：特定视频的记录完整性
✅ **步骤5**：数据一致性检查

**预期结果**：所有验证步骤都显示 ✅ 通过

---

### Step 4: 用户验证

**让郭其其登录系统验证**：

1. 登录标注平台
2. 进入"被打回的数据"页面
3. 查找"第七批第一次改写_语文-01.xlsx"
4. 应该能看到6条被打回的记录（句子号：9, 16, 26, 27, 30, 32）

---

## 🔧 技术细节

### 前端代码修复（已完成）

✅ **InspectionPage.tsx**
- 添加空值验证，防止插入空的 annotator
- 如果发现空值，会显示错误并跳过

✅ **InspectionManagePage.tsx**
- 添加警告日志，发现空值时输出到控制台
- 帮助及时发现数据问题

### 数据库修复（待执行）

- 从 `annotations` 表中获取正确的 annotator
- 更新 `rejected_annotations` 表中的空记录
- 只修复能找到对应 annotator 的记录

---

## 📁 相关文件

### SQL 脚本（按执行顺序）
1. `step1_check_rejected_annotations.sql` - 第一次诊断
2. `step1.5_check_empty_records_detail.sql` - 详细分析
3. `step2_check_guoqiqi_status.sql` - 郭其其状态检查
4. ⭐ `FIX_ALL_missing_annotators.sql` - **修复脚本**
5. ⭐ `VERIFY_fix_result.sql` - **验证脚本**

### 前端代码（已修复）
- `src/pages/InspectionPage.tsx`
- `src/pages/InspectionManagePage.tsx`

### 文档
- `BUG_FIX_REPORT_guoqiqi.md` - 完整的bug分析报告

---

## ❓ 常见问题

### Q1: 修复后郭其其还是看不到记录？
A: 
1. 确认执行了修复脚本（Step 2）
2. 运行验证脚本检查数据
3. 让郭其其清除浏览器缓存后重新登录

### Q2: 为什么会出现这个问题？
A: 
- 数据库中 `annotations` 表的某些记录 `annotator` 字段为空
- 质检打回时，这个空值被传递到 `rejected_annotations` 表
- 前端代码使用了 `item.annotator || ''`，没有拦截空值

### Q3: 以后还会出现这个问题吗？
A: 
- ✅ 不会！前端代码已添加验证
- ✅ 空值会被拦截，并显示错误提示
- ✅ 控制台会输出警告，帮助及时发现问题

### Q4: 如果还有其他人遇到同样的问题？
A: 
- 执行 `FIX_ALL_missing_annotators.sql` 会修复**所有**缺失的记录
- 不仅限于郭其其，所有标注人的记录都会被修复

---

## 🎯 执行清单

- [ ] Step 1: 运行诊断脚本，了解问题范围
- [ ] Step 2: 执行修复脚本（取消注释后执行）
- [ ] Step 3: 运行验证脚本，确认修复成功
- [ ] Step 4: 让郭其其登录验证
- [ ] ✅ 问题解决！

---

## 📞 需要帮助？

如果遇到任何问题，请检查：
1. 数据库连接是否正常
2. 是否有足够的权限执行 UPDATE 操作
3. 控制台是否有错误信息

祝修复顺利！🎉

