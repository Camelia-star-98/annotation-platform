# 修复复检数据找不到的问题

## 问题描述

**症状：**
- 已经完成了7个视频的复检
- 但在数据分析页面找不到这些已复检的数据
- 控制台显示 `reviewStatus=null, included=false`
- 提示"以下视频暂无已复检数据"

**根本原因：**
数据库中已复检的数据的 `review_status` 字段值为 `null`，而不是 `true`。数据分析页面的过滤条件要求 `reviewStatus === true`，因此这些数据被过滤掉了。

## 解决方案

### 方法一：使用可视化修复工具（推荐 ⭐）

1. **打开修复工具**
   ```bash
   # 在浏览器中打开
   open fix_review_status.html
   ```

2. **配置 Supabase 连接**
   - 首次打开时会提示输入 Supabase URL 和 Key
   - 可以从 `.env.local` 文件中复制：
     ```
     VITE_SUPABASE_URL=你的URL
     VITE_SUPABASE_ANON_KEY=你的Key
     ```

3. **执行修复流程**
   - ① 点击"开始诊断"按钮 → 查看问题数据数量
   - ② 点击"执行修复"按钮 → 自动修复所有问题数据
   - ③ 点击"验证修复结果"按钮 → 确认修复成功

4. **返回数据分析页面**
   - 刷新页面，现在应该能看到所有已复检的数据了！

### 方法二：使用 SQL 脚本

1. **登录 Supabase 控制台**
   - 访问：https://supabase.com/dashboard
   - 进入你的项目
   - 点击左侧 "SQL Editor"

2. **运行诊断查询**
   ```sql
   -- 查看有多少条数据需要修复
   SELECT 
     COUNT(*) as affected_count,
     COUNT(DISTINCT video_id) as affected_videos
   FROM annotations
   WHERE reviewer IS NOT NULL 
     AND reviewer != ''
     AND review_status IS NULL;
   ```

3. **查看具体数据**
   ```sql
   -- 查看具体的受影响数据
   SELECT 
     id,
     video_id,
     sentence_no,
     annotator,
     reviewer,
     review_status
   FROM annotations
   WHERE reviewer IS NOT NULL 
     AND reviewer != ''
     AND review_status IS NULL
   LIMIT 20;
   ```

4. **执行修复**
   ```sql
   -- 修复数据
   UPDATE annotations
   SET review_status = true
   WHERE reviewer IS NOT NULL 
     AND reviewer != ''
     AND review_status IS NULL;
   ```

5. **验证修复结果**
   ```sql
   -- 验证：检查还有没有问题数据
   SELECT COUNT(*) as remaining_issues
   FROM annotations
   WHERE reviewer IS NOT NULL 
     AND reviewer != ''
     AND review_status IS NULL;
   -- 应该返回 0
   
   -- 查看已修复的数据统计
   SELECT 
     COUNT(*) as total_reviewed,
     COUNT(DISTINCT video_id) as reviewed_videos,
     COUNT(DISTINCT reviewer) as unique_reviewers
   FROM annotations
   WHERE review_status = true;
   ```

### 方法三：在代码中临时修复（仅用于测试）

如果您想快速测试，可以临时修改过滤条件：

**文件：** `src/pages/AnalysisPage.tsx`

**原代码（第95-97行）：**
```typescript
const filteredData = allAnnotations.filter(item => 
  selectedVideoIds.includes(item.videoId) && 
  item.reviewStatus === true
```

**临时修改为：**
```typescript
const filteredData = allAnnotations.filter(item => 
  selectedVideoIds.includes(item.videoId) && 
  (item.reviewStatus === true || (item.reviewer && item.reviewer.trim() !== ''))
  // ↑ 添加这个条件：只要有复检人就认为已复检
```

⚠️ **注意：** 这只是临时解决方案，建议还是使用方法一或方法二修复数据库！

## 预防措施

为了防止将来再次出现此问题，建议：

1. **检查 ReviewPage 的提交逻辑**
   - 确保第290行的 `review_status: true` 能正确执行
   - 查看控制台是否有更新失败的错误信息

2. **添加数据验证**
   - 在提交复检后立即验证数据是否正确保存
   - 可以在 `ReviewPage.tsx` 的 `confirmSubmit` 函数中添加验证逻辑

3. **添加更详细的日志**
   ```typescript
   // 在 ReviewPage.tsx 的 confirmSubmit 函数中添加
   console.log('✅ 更新成功，验证数据:', {
     id: reviewedItems[0].id,
     reviewer: reviewerName,
     review_status: true
   });
   
   // 验证更新
   const { data: verifyData } = await supabase
     .from('annotations')
     .select('review_status, reviewer')
     .eq('id', reviewedItems[0].id)
     .single();
   
   console.log('🔍 验证结果:', verifyData);
   ```

## 常见问题

**Q1: 修复后还是看不到数据？**
- 请刷新浏览器页面（Ctrl+R 或 Cmd+R）
- 清除浏览器缓存后重试
- 检查是否选择了正确的视频

**Q2: 只有部分数据被修复？**
- 重新运行修复脚本
- 检查是否有网络问题或权限问题
- 查看浏览器控制台的错误信息

**Q3: 担心修复操作会影响数据？**
- 修复操作只更新 `review_status` 字段
- 不会修改其他任何数据（文本、分类、备注等）
- 只影响有复检人（reviewer 不为空）的数据
- 可以先在测试环境运行

## 技术细节

### 数据结构
```typescript
interface AnnotationItem {
  id: string;
  videoId: string;
  reviewer: string;        // 复检人姓名
  reviewStatus: boolean;   // 复检状态（应该是 true）
  // ... 其他字段
}
```

### 过滤逻辑
```typescript
// AnalysisPage.tsx 第95-97行
const filteredData = allAnnotations.filter(item => 
  selectedVideoIds.includes(item.videoId) &&  // 选中的视频
  item.reviewStatus === true                   // 已复检（问题所在）
);
```

### 数据库字段
```sql
-- annotations 表
CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  reviewer TEXT,              -- 复检人
  review_status BOOLEAN,      -- 复检状态（应该是 true，但实际是 null）
  -- ... 其他字段
);
```

## 总结

1. ✅ 问题已确认：`review_status` 字段为 `null` 导致数据无法显示
2. ✅ 提供了三种修复方案（推荐使用可视化工具）
3. ✅ 修复操作安全，不会影响其他数据
4. ✅ 修复后立即生效，刷新页面即可看到数据

如有任何问题，请查看：
- 浏览器控制台的错误信息
- Supabase 控制台的日志
- 或重新运行诊断工具

