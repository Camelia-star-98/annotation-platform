# 🔧 质检列表问题修复报告

## 📋 问题描述

用户反馈了两个问题：

1. ❌ **质检列表显示异常**：视频质检通过了一部分数据，没有质检不通过的数据，但视频仍然出现在质检列表中
2. ❌ **缺少文件名显示**：质检管理页面的表格中没有显示标注任务的文件名

### 用户提供的例子

根据截图：
- **1027-英语-1.mp4**：78条总标注，78条待质检，0条通过，0条不通过
- **1104-数学-3.mp4**：123条总标注，98条待质检，25条通过，0条不通过
- **1027-物理-1.mp4**：68条总标注，54条待质检，14条通过，0条不通过

**预期行为**：
- 1027-英语-1.mp4 应该显示在列表中（全部待质检）✅
- 1104-数学-3.mp4 应该显示在列表中（还有98条待质检）✅
- 1027-物理-1.mp4 应该显示在列表中（还有54条待质检）✅

**实际问题**：质检管理页面可能显示了**已经质检过的句子**，导致用户看到已质检的数据

---

## 🔍 问题根因分析

### 根因1：数据查询逻辑缺陷

**文件**：`src/api/database.ts` - `getPendingInspectionAnnotations` 函数

**问题代码**（第410-428行）：

```typescript
export async function getPendingInspectionAnnotations(
  videoId: string, 
  options?: { limit?: number; offset?: number }
): Promise<{ data: AnnotationItem[]; total: number }> {
  try {
    let query = supabase
      .from('annotations')
      .select('...')
      .eq('video_id', videoId)
      .eq('status', true)
      .not('human_annotated_text', 'is', null)
      .neq('human_annotated_text', '')
      .not('annotator', 'is', null)
      .neq('annotator', '')
      // ❌ 缺少这一行：过滤待质检的数据
      .order('sentence_no', { ascending: true });
```

**问题**：查询条件中**没有过滤** `inspector` 字段，导致返回所有已标注的数据（包括已质检和未质检的）。

### 根因2：表格列显示不完整

**文件**：`src/pages/InspectionManagePage.tsx` - 表格列定义（第683-695行）

**问题代码**：

```typescript
{
  title: '标注文件名',
  dataIndex: 'annotationFileName',
  key: 'annotationFileName',
  width: 200,
  render: (text: string, record: any) => {
    if (record.isGroup) return null; // ❌ 视频行不显示文件名
    // ...
  }
}
```

**问题**：视频行（父行）不显示标注文件名，用户无法在质检列表中看到视频对应的文件名。

---

## ✅ 修复方案

### 修复1：添加待质检过滤条件

**文件**：`src/api/database.ts`

**修改位置**：第410-428行

**修改内容**：

```typescript
export async function getPendingInspectionAnnotations(
  videoId: string, 
  options?: { limit?: number; offset?: number }
): Promise<{ data: AnnotationItem[]; total: number }> {
  try {
    let query = supabase
      .from('annotations')
      .select('...')
      .eq('video_id', videoId)
      .eq('status', true)
      .not('human_annotated_text', 'is', null)
      .neq('human_annotated_text', '')
      .not('annotator', 'is', null)
      .neq('annotator', '')
      // 🆕 只查询待质检的数据（inspector 为空或 null）
      .or('inspector.is.null,inspector.eq.')
      .order('sentence_no', { ascending: true });
```

**效果**：
- ✅ 只返回 `inspector` 为 `null` 或空字符串的数据
- ✅ 已质检的数据不会出现在质检列表中
- ✅ 当视频所有句子都质检完成后，`getPendingInspectionAnnotations` 返回0条数据
- ✅ 视频自动从质检列表中消失

---

### 修复2：在视频行显示文件名

**文件**：`src/pages/InspectionManagePage.tsx`

**修改位置**：第683-695行

**修改内容**：

```typescript
{
  title: '标注文件名',
  dataIndex: 'annotationFileName',
  key: 'annotationFileName',
  width: 200,
  ellipsis: { showTitle: false },
  render: (text: string, record: any) => {
    if (record.isGroup) {
      // 🆕 在视频行显示视频文件名（从第一个子项获取）
      const fileName = record.children && record.children.length > 0 
        ? record.children[0].annotationFileName 
        : '';
      if (!fileName || fileName.trim() === '') {
        return <span style={{ color: '#999' }}>未上传标注文件</span>;
      }
      return <Tag color="green">{fileName}</Tag>;
    }
    // 在句子行显示标注文件名
    if (!text || text.trim() === '') {
      return <span style={{ color: '#999' }}>未上传</span>;
    }
    return text;
  }
}
```

**效果**：
- ✅ 视频行（父行）显示标注文件名（绿色标签）
- ✅ 句子行（子行）显示标注文件名（纯文本）
- ✅ 如果没有上传标注文件，显示灰色提示

---

## 🧪 测试验证

### 测试工具

已创建测试页面：`test_inspection_list_fix.html`

**测试内容**：

1. **测试1：验证查询逻辑**
   - 随机选择一个视频
   - 调用新的查询逻辑（带 `inspector.is.null` 过滤）
   - 验证返回的数据是否全部为待质检状态

2. **测试2：检查视频可见性**
   - 查询所有视频的质检统计
   - 判断哪些视频应该显示/隐藏
   - 显示决策依据：`pending > 0` 则显示

3. **测试3：检查用户提到的具体视频**
   - 1027-英语-1.mp4
   - 1104-数学-3.mp4
   - 1027-物理-1.mp4
   - 显示每个视频的详细统计和分析

### 测试步骤

1. 在浏览器中打开 `test_inspection_list_fix.html`
2. 依次点击"运行测试1"、"运行测试2"、"运行测试3"
3. 查看测试结果，验证修复是否成功

**预期结果**：

- ✅ 测试1应该显示：所有返回的数据都是待质检的
- ✅ 测试2应该显示：只有 `pending > 0` 的视频标记为"应显示"
- ✅ 测试3应该显示：用户提到的视频都有待质检的句子，应继续显示在列表

---

## 📊 修复前后对比

### 修复前

| 场景 | 旧逻辑 | 问题 |
|------|--------|------|
| 查询待质检数据 | 返回所有已标注的数据 | ❌ 包含已质检的数据 |
| 视频列表显示 | 即使全部质检完成，仍显示在列表 | ❌ 用户困惑 |
| 文件名显示 | 视频行不显示文件名 | ❌ 缺少关键信息 |

### 修复后

| 场景 | 新逻辑 | 效果 |
|------|--------|------|
| 查询待质检数据 | 只返回 `inspector IS NULL` 的数据 | ✅ 精确过滤 |
| 视频列表显示 | 全部质检完成后自动从列表消失 | ✅ 符合预期 |
| 文件名显示 | 视频行显示文件名（绿色标签） | ✅ 信息完整 |

---

## 🎯 用户场景验证

### 场景1：1104-数学-3.mp4（25条通过，98条待质检）

**修复前**：
- 查询返回：123条（包括25条已质检的）
- 用户看到：25条已通过的句子也在列表中
- 用户困惑："为什么已经通过的句子还在列表里？"

**修复后**：
- 查询返回：98条（只有待质检的）
- 用户看到：98条待质检的句子
- 用户体验：✅ 清晰明了

### 场景2：某视频全部质检完成

**修复前**：
- 查询返回：所有句子（虽然都已质检）
- 视频仍显示在列表中
- 用户困惑："这个视频我已经全部质检完了，为什么还在列表里？"

**修复后**：
- 查询返回：0条（没有待质检的）
- 视频从列表中消失
- 用户体验：✅ 符合预期

---

## 🔍 数据库查询优化

### 查询性能

修改后的查询：

```sql
SELECT * FROM annotations
WHERE video_id = 'xxx'
  AND status = true
  AND human_annotated_text IS NOT NULL
  AND human_annotated_text != ''
  AND annotator IS NOT NULL
  AND annotator != ''
  AND (inspector IS NULL OR inspector = '') -- 🆕 新增过滤条件
ORDER BY sentence_no ASC
LIMIT 100 OFFSET 0;
```

**性能影响**：
- ✅ 查询条件更精确，返回的数据量更少
- ✅ 减少前端的数据处理负担
- ✅ 提升用户体验（加载速度更快）

**索引建议**（如果性能仍有问题）：

```sql
-- 创建复合索引优化查询
CREATE INDEX idx_annotations_pending_inspection 
ON annotations(video_id, status, inspector) 
WHERE status = true AND (inspector IS NULL OR inspector = '');
```

---

## 📝 注意事项

### 1. 抽检逻辑的影响

如果用户使用抽检功能（抽检30%），修复后的行为：

- **抽检前**：显示所有待质检的句子数量（100条）
- **选择抽检30%**：随机抽取30条进入质检
- **抽检后**（假设全部通过）：
  - ✅ 抽检的30条 → 标记为"通过"
  - ✅ **自动**将剩余70条也标记为"通过"（抽检自动通过功能）
  - ✅ 视频从质检列表中消失

### 2. 分批质检的场景

如果用户分多次质检同一个视频：

- **第一次质检**：质检10条，全部通过 → 自动标记剩余90条
- **结果**：视频从列表消失
- **如果有问题句子**：后续可以通过"重新质检"功能进入

### 3. 数据一致性

修复后的逻辑保证：

- ✅ 质检列表只显示待质检的数据
- ✅ 已质检的数据不会重复出现
- ✅ 视频状态（待质检/已完成）与实际数据一致

---

## ✅ 总结

### 修复内容

1. ✅ **数据查询过滤**：`getPendingInspectionAnnotations` 只返回待质检的数据
2. ✅ **文件名显示**：质检管理页面的视频行显示标注文件名

### 修复效果

1. ✅ 质检列表不再显示已质检的句子
2. ✅ 视频全部质检完成后自动从列表消失
3. ✅ 用户可以在列表中看到视频对应的标注文件名
4. ✅ 数据显示更加精确，用户体验提升

### 测试工具

- 📄 `test_inspection_list_fix.html` - 可视化测试页面
- 📄 `DIAGNOSE_inspection_list_issue.sql` - SQL诊断脚本

---

**修复完成日期**：2025-12-11  
**版本**：v1.1  
**状态**：✅ 已完成，待测试验证


## 📋 问题描述

用户反馈了两个问题：

1. ❌ **质检列表显示异常**：视频质检通过了一部分数据，没有质检不通过的数据，但视频仍然出现在质检列表中
2. ❌ **缺少文件名显示**：质检管理页面的表格中没有显示标注任务的文件名

### 用户提供的例子

根据截图：
- **1027-英语-1.mp4**：78条总标注，78条待质检，0条通过，0条不通过
- **1104-数学-3.mp4**：123条总标注，98条待质检，25条通过，0条不通过
- **1027-物理-1.mp4**：68条总标注，54条待质检，14条通过，0条不通过

**预期行为**：
- 1027-英语-1.mp4 应该显示在列表中（全部待质检）✅
- 1104-数学-3.mp4 应该显示在列表中（还有98条待质检）✅
- 1027-物理-1.mp4 应该显示在列表中（还有54条待质检）✅

**实际问题**：质检管理页面可能显示了**已经质检过的句子**，导致用户看到已质检的数据

---

## 🔍 问题根因分析

### 根因1：数据查询逻辑缺陷

**文件**：`src/api/database.ts` - `getPendingInspectionAnnotations` 函数

**问题代码**（第410-428行）：

```typescript
export async function getPendingInspectionAnnotations(
  videoId: string, 
  options?: { limit?: number; offset?: number }
): Promise<{ data: AnnotationItem[]; total: number }> {
  try {
    let query = supabase
      .from('annotations')
      .select('...')
      .eq('video_id', videoId)
      .eq('status', true)
      .not('human_annotated_text', 'is', null)
      .neq('human_annotated_text', '')
      .not('annotator', 'is', null)
      .neq('annotator', '')
      // ❌ 缺少这一行：过滤待质检的数据
      .order('sentence_no', { ascending: true });
```

**问题**：查询条件中**没有过滤** `inspector` 字段，导致返回所有已标注的数据（包括已质检和未质检的）。

### 根因2：表格列显示不完整

**文件**：`src/pages/InspectionManagePage.tsx` - 表格列定义（第683-695行）

**问题代码**：

```typescript
{
  title: '标注文件名',
  dataIndex: 'annotationFileName',
  key: 'annotationFileName',
  width: 200,
  render: (text: string, record: any) => {
    if (record.isGroup) return null; // ❌ 视频行不显示文件名
    // ...
  }
}
```

**问题**：视频行（父行）不显示标注文件名，用户无法在质检列表中看到视频对应的文件名。

---

## ✅ 修复方案

### 修复1：添加待质检过滤条件

**文件**：`src/api/database.ts`

**修改位置**：第410-428行

**修改内容**：

```typescript
export async function getPendingInspectionAnnotations(
  videoId: string, 
  options?: { limit?: number; offset?: number }
): Promise<{ data: AnnotationItem[]; total: number }> {
  try {
    let query = supabase
      .from('annotations')
      .select('...')
      .eq('video_id', videoId)
      .eq('status', true)
      .not('human_annotated_text', 'is', null)
      .neq('human_annotated_text', '')
      .not('annotator', 'is', null)
      .neq('annotator', '')
      // 🆕 只查询待质检的数据（inspector 为空或 null）
      .or('inspector.is.null,inspector.eq.')
      .order('sentence_no', { ascending: true });
```

**效果**：
- ✅ 只返回 `inspector` 为 `null` 或空字符串的数据
- ✅ 已质检的数据不会出现在质检列表中
- ✅ 当视频所有句子都质检完成后，`getPendingInspectionAnnotations` 返回0条数据
- ✅ 视频自动从质检列表中消失

---

### 修复2：在视频行显示文件名

**文件**：`src/pages/InspectionManagePage.tsx`

**修改位置**：第683-695行

**修改内容**：

```typescript
{
  title: '标注文件名',
  dataIndex: 'annotationFileName',
  key: 'annotationFileName',
  width: 200,
  ellipsis: { showTitle: false },
  render: (text: string, record: any) => {
    if (record.isGroup) {
      // 🆕 在视频行显示视频文件名（从第一个子项获取）
      const fileName = record.children && record.children.length > 0 
        ? record.children[0].annotationFileName 
        : '';
      if (!fileName || fileName.trim() === '') {
        return <span style={{ color: '#999' }}>未上传标注文件</span>;
      }
      return <Tag color="green">{fileName}</Tag>;
    }
    // 在句子行显示标注文件名
    if (!text || text.trim() === '') {
      return <span style={{ color: '#999' }}>未上传</span>;
    }
    return text;
  }
}
```

**效果**：
- ✅ 视频行（父行）显示标注文件名（绿色标签）
- ✅ 句子行（子行）显示标注文件名（纯文本）
- ✅ 如果没有上传标注文件，显示灰色提示

---

## 🧪 测试验证

### 测试工具

已创建测试页面：`test_inspection_list_fix.html`

**测试内容**：

1. **测试1：验证查询逻辑**
   - 随机选择一个视频
   - 调用新的查询逻辑（带 `inspector.is.null` 过滤）
   - 验证返回的数据是否全部为待质检状态

2. **测试2：检查视频可见性**
   - 查询所有视频的质检统计
   - 判断哪些视频应该显示/隐藏
   - 显示决策依据：`pending > 0` 则显示

3. **测试3：检查用户提到的具体视频**
   - 1027-英语-1.mp4
   - 1104-数学-3.mp4
   - 1027-物理-1.mp4
   - 显示每个视频的详细统计和分析

### 测试步骤

1. 在浏览器中打开 `test_inspection_list_fix.html`
2. 依次点击"运行测试1"、"运行测试2"、"运行测试3"
3. 查看测试结果，验证修复是否成功

**预期结果**：

- ✅ 测试1应该显示：所有返回的数据都是待质检的
- ✅ 测试2应该显示：只有 `pending > 0` 的视频标记为"应显示"
- ✅ 测试3应该显示：用户提到的视频都有待质检的句子，应继续显示在列表

---

## 📊 修复前后对比

### 修复前

| 场景 | 旧逻辑 | 问题 |
|------|--------|------|
| 查询待质检数据 | 返回所有已标注的数据 | ❌ 包含已质检的数据 |
| 视频列表显示 | 即使全部质检完成，仍显示在列表 | ❌ 用户困惑 |
| 文件名显示 | 视频行不显示文件名 | ❌ 缺少关键信息 |

### 修复后

| 场景 | 新逻辑 | 效果 |
|------|--------|------|
| 查询待质检数据 | 只返回 `inspector IS NULL` 的数据 | ✅ 精确过滤 |
| 视频列表显示 | 全部质检完成后自动从列表消失 | ✅ 符合预期 |
| 文件名显示 | 视频行显示文件名（绿色标签） | ✅ 信息完整 |

---

## 🎯 用户场景验证

### 场景1：1104-数学-3.mp4（25条通过，98条待质检）

**修复前**：
- 查询返回：123条（包括25条已质检的）
- 用户看到：25条已通过的句子也在列表中
- 用户困惑："为什么已经通过的句子还在列表里？"

**修复后**：
- 查询返回：98条（只有待质检的）
- 用户看到：98条待质检的句子
- 用户体验：✅ 清晰明了

### 场景2：某视频全部质检完成

**修复前**：
- 查询返回：所有句子（虽然都已质检）
- 视频仍显示在列表中
- 用户困惑："这个视频我已经全部质检完了，为什么还在列表里？"

**修复后**：
- 查询返回：0条（没有待质检的）
- 视频从列表中消失
- 用户体验：✅ 符合预期

---

## 🔍 数据库查询优化

### 查询性能

修改后的查询：

```sql
SELECT * FROM annotations
WHERE video_id = 'xxx'
  AND status = true
  AND human_annotated_text IS NOT NULL
  AND human_annotated_text != ''
  AND annotator IS NOT NULL
  AND annotator != ''
  AND (inspector IS NULL OR inspector = '') -- 🆕 新增过滤条件
ORDER BY sentence_no ASC
LIMIT 100 OFFSET 0;
```

**性能影响**：
- ✅ 查询条件更精确，返回的数据量更少
- ✅ 减少前端的数据处理负担
- ✅ 提升用户体验（加载速度更快）

**索引建议**（如果性能仍有问题）：

```sql
-- 创建复合索引优化查询
CREATE INDEX idx_annotations_pending_inspection 
ON annotations(video_id, status, inspector) 
WHERE status = true AND (inspector IS NULL OR inspector = '');
```

---

## 📝 注意事项

### 1. 抽检逻辑的影响

如果用户使用抽检功能（抽检30%），修复后的行为：

- **抽检前**：显示所有待质检的句子数量（100条）
- **选择抽检30%**：随机抽取30条进入质检
- **抽检后**（假设全部通过）：
  - ✅ 抽检的30条 → 标记为"通过"
  - ✅ **自动**将剩余70条也标记为"通过"（抽检自动通过功能）
  - ✅ 视频从质检列表中消失

### 2. 分批质检的场景

如果用户分多次质检同一个视频：

- **第一次质检**：质检10条，全部通过 → 自动标记剩余90条
- **结果**：视频从列表消失
- **如果有问题句子**：后续可以通过"重新质检"功能进入

### 3. 数据一致性

修复后的逻辑保证：

- ✅ 质检列表只显示待质检的数据
- ✅ 已质检的数据不会重复出现
- ✅ 视频状态（待质检/已完成）与实际数据一致

---

## ✅ 总结

### 修复内容

1. ✅ **数据查询过滤**：`getPendingInspectionAnnotations` 只返回待质检的数据
2. ✅ **文件名显示**：质检管理页面的视频行显示标注文件名

### 修复效果

1. ✅ 质检列表不再显示已质检的句子
2. ✅ 视频全部质检完成后自动从列表消失
3. ✅ 用户可以在列表中看到视频对应的标注文件名
4. ✅ 数据显示更加精确，用户体验提升

### 测试工具

- 📄 `test_inspection_list_fix.html` - 可视化测试页面
- 📄 `DIAGNOSE_inspection_list_issue.sql` - SQL诊断脚本

---

**修复完成日期**：2025-12-11  
**版本**：v1.1  
**状态**：✅ 已完成，待测试验证

