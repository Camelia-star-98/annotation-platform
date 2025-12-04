# 添加标注人姓名列功能

## 更改日期
2025年12月1日

## 修改内容

### 1. 质检数据管理页面 - 添加标注人列

在 `src/pages/InspectionSelectPage.tsx` 中添加了标注人信息显示功能。

#### 修改的文件
- `src/pages/InspectionSelectPage.tsx`

#### 具体更改

##### 1.1 更新数据接口
在 `VideoInspectionData` 接口中添加了 `annotators` 字段：

```typescript
interface VideoInspectionData {
  id: string;
  videoName: string;
  subject: string;
  totalAnnotations: number;
  pendingInspection: number;
  passedInspection: number;
  failedInspection: number;
  uploadTime: string;
  annotators: string[]; // 新增：标注人列表
}
```

##### 1.2 收集标注人信息
在数据加载逻辑中，添加了收集和去重标注人姓名的代码：

```typescript
// 收集所有标注人姓名（去重）
const annotatorsSet = new Set<string>();
deduplicatedAnnotations.forEach(item => {
  if (item.annotator && item.annotator.trim() !== '' && item.annotator !== 'unknown') {
    annotatorsSet.add(item.annotator.trim());
  }
});
const annotators = Array.from(annotatorsSet).sort(); // 按字母排序
```

##### 1.3 添加表格列
在表格定义中，在"科目"列后添加了"标注人"列：

```typescript
{
  title: '标注人',
  dataIndex: 'annotators',
  key: 'annotators',
  width: 150,
  render: (annotators: string[]) => {
    if (!annotators || annotators.length === 0) {
      return <Tag color="default">无标注人</Tag>;
    }
    // 如果标注人较多，只显示前2个，其余用省略号表示
    if (annotators.length <= 2) {
      return (
        <Space size={4} wrap>
          {annotators.map(name => (
            <Tag key={name} color="green">{name}</Tag>
          ))}
        </Space>
      );
    }
    return (
      <Tooltip title={annotators.join(', ')}>
        <Space size={4}>
          <Tag color="green">{annotators[0]}</Tag>
          <Tag color="green">{annotators[1]}</Tag>
          <Tag color="default">+{annotators.length - 2}</Tag>
        </Space>
      </Tooltip>
    );
  }
}
```

## 功能说明

### 显示逻辑
- **无标注人**：显示灰色标签"无标注人"
- **1-2个标注人**：直接显示所有标注人姓名（绿色标签）
- **3个或更多标注人**：
  - 显示前2个标注人姓名
  - 显示"+N"表示还有N个标注人
  - 鼠标悬停时显示完整标注人列表

### 数据处理
- 自动过滤空值、'unknown' 等无效标注人
- 自动去重（同一个标注人只显示一次）
- 按字母顺序排序

## 测试建议

1. 访问"质检数据管理"页面
2. 检查"标注人"列是否正确显示
3. 测试以下场景：
   - 视频没有标注人
   - 视频有1个标注人
   - 视频有2个标注人
   - 视频有3个或更多标注人（检查Tooltip是否正常工作）
4. 验证标注人姓名是否正确去重

## 相关修复

同时修复了待质检数量统计的问题：
- 待质检数量现在包括所有未质检的数据（不限制是否有标注文本）
- 这与质检管理页面的逻辑保持一致

