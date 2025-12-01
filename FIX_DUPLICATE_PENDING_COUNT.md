# 🐛 修复待质检数量翻倍问题

## 问题描述

在"质检数据管理"页面，待质检数据的数量显示异常，比实际上传的数量多一倍。

### 问题表现

- **总标注数**：212 条
- **界面显示待质检**：可能显示为 400+ 条（翻倍）
- **实际待质检**：应该是 212 条（去重后）

## 问题原因

### 1️⃣ 数据库存在重复记录

数据库中存在同一个 `video_id + sentence_no + annotator` 的多条记录，原因可能是：

- 标注人重新提交了相同的句子
- 质检打回后重新标注，生成了新记录
- 系统异常导致的重复插入

### 2️⃣ 统计查询没有正确过滤

`loadStatistics` 函数在查询统计数据时：

```typescript
// ❌ 原来的代码（有bug）
const loadStatistics = useCallback(async () => {
  // 查询所有视频的待质检和已质检数据
  const { data, error } = await supabase
    .from('annotations')
    .select('...')
    .not('human_annotated_text', 'is', null)
    .neq('human_annotated_text', '')
    .is('review_status', null)
    // 🔴 问题：没有根据 selectedVideoId 过滤！
    .range(page * pageSize, (page + 1) * pageSize - 1);
  
  // ... 后续去重逻辑
}, []); // 🔴 问题：依赖数组为空，不会随 selectedVideoId 变化而更新
```

**问题点：**

1. 查询时没有判断 `selectedVideoId`，导致查询了**所有视频**的数据
2. 即使代码里有去重逻辑，但统计的是全局数据，不是当前视频的数据
3. `useCallback` 的依赖数组为空 `[]`，不会随 `selectedVideoId` 变化而重新执行

### 3️⃣ 去重逻辑虽然存在，但作用域错误

代码中虽然有去重逻辑：

```typescript
// 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
const deduplicatedMap = new Map<string, any>();

allAnnotationsForStats.forEach(ann => {
  const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
  const existing = deduplicatedMap.get(key);
  
  if (!existing) {
    deduplicatedMap.set(key, ann);
  } else {
    // 优先保留有质检状态的数据
    // ...
  }
});
```

但是这个去重逻辑是对**全局数据**去重的，而不是对当前选中视频的数据去重。

## 修复方案

### ✅ 方案：在统计查询时根据 selectedVideoId 过滤

修改 `loadStatistics` 函数：

```typescript
// ✅ 修复后的代码
const loadStatistics = useCallback(async () => {
  try {
    let allAnnotationsForStats: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from('annotations')
        .select('id, video_id, sentence_no, annotator, human_annotated_text, inspector, is_qualified, review_status, updated_at, created_at')
        .not('human_annotated_text', 'is', null)
        .neq('human_annotated_text', '')
        .is('review_status', null);
      
      // 🟢 修复：如果指定了视频ID，只查询该视频的数据
      if (selectedVideoId) {
        query = query.eq('video_id', selectedVideoId);
      }
      
      const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('查询统计数据失败:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allAnnotationsForStats = allAnnotationsForStats.concat(data);
      }
      
      hasMore = data && data.length === pageSize;
      page++;
    }
    
    // ... 后续去重逻辑（保持不变）
    
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}, [selectedVideoId]); // 🟢 修复：添加 selectedVideoId 依赖
```

### 修改要点

1. **添加视频ID过滤条件**：
   ```typescript
   if (selectedVideoId) {
     query = query.eq('video_id', selectedVideoId);
   }
   ```

2. **更新依赖数组**：
   ```typescript
   }, [selectedVideoId]); // 当 selectedVideoId 变化时重新执行
   ```

3. **增强日志输出**：
   ```typescript
   console.log('📊 统计数据（去重后）' + (selectedVideoId ? `（仅视频 ${selectedVideoId}）` : '（全部视频）') + ':', {
     原始数量: allAnnotationsForStats.length,
     去重后数量: deduplicatedAnnotations.length,
     待质检: pendingCount,
     已质检: inspectedCount,
     通过: passedCount,
     不通过: failedCount
   });
   ```

## 验证方法

### 1. 使用诊断脚本

在浏览器中打开 `diagnose_duplicate_pending.html`：

```bash
# 启动本地服务器
npx serve /Users/ailian/Downloads/annotation-platform
```

然后访问：`http://localhost:3000/diagnose_duplicate_pending.html`

诊断脚本会显示：
- 数据库总数
- 原始待质检数量（包含重复）
- 去重后待质检数量（正确数量）
- 重复组数
- 重复数据详情

### 2. 查看浏览器控制台

修复后，在质检管理页面打开浏览器控制台（F12），查看日志：

```
📊 统计数据（去重后）（仅视频 xxx）: {
  原始数量: 424,
  去重后数量: 212,
  待质检: 212,
  已质检: 0,
  通过: 0,
  不通过: 0
}
```

如果看到：
- `原始数量` 是 `去重后数量` 的 2 倍 → 说明数据库确实有重复
- `待质检` 等于 `去重后数量` → 说明去重逻辑工作正常
- 日志中显示 `（仅视频 xxx）` → 说明已正确过滤到当前视频

### 3. 检查界面显示

修复后，界面上的统计卡片应该显示：

- **待质检数据**：212 条（与你上传的数量一致）
- **已质检数据**：0 条
- **质检通过**：0 条
- **质检不通过**：0 条

## 预防措施

### 1. 避免数据重复

在重新提交标注时，应该：

- **更新现有记录**，而不是插入新记录
- 或者在插入前检查是否已存在相同的 `video_id + sentence_no + annotator`

### 2. 统一去重逻辑

所有查询统计数据的地方都应该：

1. 先查询原始数据
2. 按 `video_id + sentence_no + annotator` 去重
3. 对去重后的数据进行统计

### 3. 添加数据库约束

可以考虑在数据库层面添加唯一约束（如果业务逻辑允许）：

```sql
-- 示例（需要根据实际业务逻辑调整）
CREATE UNIQUE INDEX unique_annotation 
ON annotations (video_id, sentence_no, annotator)
WHERE review_status IS NULL;
```

## 相关文件

- `/src/pages/InspectionManagePage.tsx` - 质检管理页面（已修复）
- `/src/pages/InspectionSelectPage.tsx` - 质检选择页面（已有去重逻辑）
- `/src/pages/ReviewSelectPage.tsx` - 复检选择页面（已有去重逻辑）
- `/diagnose_duplicate_pending.html` - 诊断工具

## 修复时间

- **修复日期**：2025年12月1日
- **修复内容**：`InspectionManagePage.tsx` 的 `loadStatistics` 函数
- **影响范围**：质检数据管理页面的统计卡片显示

## 总结

问题的根本原因是：
1. 数据库存在重复记录（业务逻辑导致）
2. 统计查询时没有正确过滤到当前视频

修复后：
- ✅ 统计只针对当前选中的视频
- ✅ 去重逻辑正确应用
- ✅ 界面显示的数量与实际上传数量一致

