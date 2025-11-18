# 标注平台

大模型迭代case标注平台，用于教研标注、质检和产品复检。

## 功能特性

- 📝 **教研标注**: 视频文本标注、问题分类、备注管理
- 🔍 **抽样质检**: 标注质量检查，自动计算错误率
- ✅ **产品复检**: PM复检标注结果，支持新建问题类别
- 📊 **结果分析**: 问题占比统计、数据可视化、导出功能

## 技术栈

- React 18 + TypeScript
- Ant Design 5
- ECharts 5
- React Router 6
- Vite

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
  ├── components/      # 可复用组件
  ├── pages/          # 页面组件
  ├── types/          # TypeScript 类型定义
  ├── utils/          # 工具函数
  ├── mock/           # 模拟数据
  ├── App.tsx         # 应用入口
  └── main.tsx        # React 渲染入口
```

