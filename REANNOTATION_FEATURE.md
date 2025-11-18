# 被打回重标功能说明

## 📋 功能概述

标注任务页面现在分为两个入口：
1. **待标注任务**：正常的标注任务列表
2. **被打回重标**：质检不通过需要重新标注的数据

## 🎯 功能详情

### 1️⃣ 标注任务列表页面

#### **Tab 1: 待标注任务**
- 显示所有已发布的标注任务
- 点击"开始标注"进入标注页面

#### **Tab 2: 被打回重标**
显示当前标注人被质检打回的数据，包含以下信息：

| 列名 | 说明 | 样式 |
|------|------|------|
| 视频名称 | 数据所属视频 | 文本 |
| 科目 | 视频科目 | 蓝色标签 |
| 原文 | 原始文本内容 | 省略显示 |
| 标注内容 | 标注的改写文本 | 省略显示 |
| 问题大类 | 多个问题大类 | 橙色标签（多个） |
| 问题小类 | 多个问题小类 | 金色标签（多个） |
| **质检人** | **谁打回的** | 🔴 **红色标签 + 用户图标** |
| 打回时间 | 质检时间 | 格式化日期 |
| 操作 | 重新标注按钮 | 红色主按钮 |

**筛选条件：**
- ✅ `annotator` = 当前标注人
- ✅ `isQualified` = `false` (质检不通过)
- ✅ `inspector` 不为空 (已被质检)

### 2️⃣ 标注页面增强

#### **重标聚焦模式**

当从"被打回重标"页面跳转到标注页面时：

**视觉效果：**
- 🟠 **橙色背景高亮**：被打回的数据行
- ✨ **脉动动画**：橙色背景以 2 秒周期脉动，引导标注人关注
- 🔶 **左边框标识**：橙色粗边框（3px）突出显示

**CSS 类：**
```css
.row-reannotation-focus {
  background-color: #fff7e6 !important;
  animation: highlight-pulse 2s ease-in-out infinite;
}
```

#### **现有功能保持：**
- 🔴 质检不通过的行：红色背景 `.row-failed-inspection`
- ✅ 质检通过的行：正常显示

## 🔄 数据流程

```
标注人标注
    ↓
质检人质检
    ↓
质检不通过 (isQualified = false)
    ↓
出现在"被打回重标"Tab
    ↓
标注人重新标注
    ↓
重新提交
    ↓
质检人再次质检
```

## 💡 使用场景

### 场景 1：标注人查看被打回的数据
1. 点击"教研标注"，输入姓名
2. 进入标注任务列表页面
3. 切换到"被打回重标"Tab
4. 查看质检人是谁打回的，以及具体的问题分类

### 场景 2：重新标注
1. 在"被打回重标"Tab 中
2. 点击某条数据的"重新标注"按钮
3. 跳转到标注页面
4. 该条数据以**橙色脉动背景**高亮显示
5. 修改标注内容后点击"提交"

### 场景 3：批量处理
1. 在"被打回重标"Tab 中查看所有被打回的数据
2. 按视频分组处理
3. 点击视频名称相同的数据，逐个重新标注

## 🎨 UI 设计

### 颜色系统
- **蓝色** (`#1890ff`)：正常标签（科目）
- **红色** (`#ff4d4f`)：
  - 质检人标签
  - 质检不通过的行背景 (`#fff1f0`)
  - 重新标注按钮
- **橙色** (`#fa8c16`)：
  - 重标聚焦行背景 (`#fff7e6`)
  - 问题大类标签
- **金色** (`#faad14`)：问题小类标签

### 动画效果
- **脉动动画**：橙色背景 2 秒周期，50% 时加深颜色
- **Hover 效果**：鼠标悬停时颜色加深

## 📊 统计信息

- "待标注任务"Tab 显示：`{tasks.length}` 个任务
- "被打回重标"Tab 显示：`{rejectedItems.length}` 条待重标数据

## 🚀 技术实现

### 状态管理
```typescript
const [tasks, setTasks] = useState<AnnotationTask[]>([]);
const [rejectedItems, setRejectedItems] = useState<RejectedAnnotation[]>([]);
const [activeTab, setActiveTab] = useState<string>('tasks');
```

### 数据加载
```typescript
// 加载被打回的数据
const loadRejectedItems = async () => {
  const rejected = allAnnotations
    .filter(item => 
      item.annotator === annotatorName &&
      item.isQualified === false &&
      item.inspector
    )
    .map(item => ({
      id: item.id,
      videoId: item.videoId,
      inspector: item.inspector, // 关键：质检人
      // ... 其他字段
    }));
};
```

### 路由传参
```typescript
// 跳转到标注页面（重标模式）
navigate('/annotation', {
  state: {
    videoId: item.videoId,
    videoName: item.videoName,
    annotatorName: annotatorName,
    isReannotation: true,    // 标记为重标模式
    focusItemId: item.id      // 聚焦的数据项ID
  }
});
```

## ✅ 完成的功能

1. ✅ 标注任务页面分为"待标注任务"和"被打回重标"两个 Tab
2. ✅ "被打回重标"显示质检人姓名（红色标签）
3. ✅ 显示标注人、原文、标注内容、问题分类
4. ✅ 支持"重新标注"按钮
5. ✅ 标注页面橙色高亮显示被打回的数据
6. ✅ 脉动动画引导标注人关注
7. ✅ 响应式设计，支持不同屏幕尺寸

## 🔮 未来优化

- [ ] 添加按视频分组的折叠面板
- [ ] 支持批量重新标注
- [ ] 添加质检人的反馈意见字段
- [ ] 统计每个标注人的打回率

