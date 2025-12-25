# 团队协作指南

欢迎加入**标注平台**开发团队！本文档将帮助你了解我们的协作流程。

---

## 📋 目录

- [开发流程](#开发流程)
- [分支管理](#分支管理)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [Code Review 标准](#code-review-标准)
- [测试要求](#测试要求)
- [常见问题](#常见问题)

---

## 🔄 开发流程

### 1. 接到任务后

```bash
# 1. 确保在最新的 main 分支
git checkout main
git pull origin main

# 2. 创建功能分支
git checkout -b feature/your-feature-name
# 或修复bug
git checkout -b fix/bug-description
```

### 2. 开发过程中

- ✅ 经常提交代码，每次提交做一件事
- ✅ 保持提交信息清晰明了
- ✅ 定期拉取 main 分支的最新代码

```bash
# 定期同步主分支（推荐每天一次）
git fetch origin
git rebase origin/main
```

### 3. 完成开发后

- ✅ 自测功能是否正常
- ✅ 检查是否有 lint 错误
- ✅ 检查是否有冲突
- ✅ 提交 Pull Request

---

## 🌿 分支管理

### 主分支

- **`main`**: 生产环境分支，受保护
  - ❌ 禁止直接推送
  - ✅ 只能通过 Pull Request 合并
  - ✅ 需要至少 1 人审核通过

### 功能分支命名规范

```
feature/功能名称      # 新功能开发
fix/问题描述         # Bug 修复
refactor/重构内容    # 代码重构
docs/文档说明        # 文档更新
style/样式调整       # 样式/UI 调整
```

**示例：**
```bash
feature/add-export-function        # 添加导出功能
fix/annotation-save-bug           # 修复标注保存问题
refactor/video-player-component   # 重构视频播放器组件
docs/update-api-guide             # 更新 API 文档
style/improve-inspection-page-ui  # 改进复检页面 UI
```

---

## 📝 代码规范

### TypeScript 规范

1. **类型定义**
   - ✅ 为所有函数参数和返回值添加类型
   - ✅ 避免使用 `any`，使用 `unknown` 替代
   - ✅ 使用接口（interface）定义数据结构

2. **命名规范**
   - 组件：大驼峰 `VideoPlayer.tsx`
   - 函数：小驼峰 `handleSubmit()`
   - 常量：大写下划线 `MAX_UPLOAD_SIZE`
   - 私有变量：下划线前缀 `_internalState`

3. **文件组织**
   ```
   src/
   ├── components/    # 可复用组件
   ├── pages/         # 页面组件
   ├── types/         # 类型定义
   ├── utils/         # 工具函数
   ├── api/           # API 接口
   └── hooks/         # 自定义 Hooks
   ```

### React 规范

```typescript
// ✅ 推荐写法
import React, { useState, useEffect } from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  onPlayEnd?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  onPlayEnd 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    // 副作用逻辑
  }, [videoUrl]);
  
  return (
    <div className="video-player">
      {/* 组件内容 */}
    </div>
  );
};

// ❌ 避免的写法
export default function VideoPlayer(props: any) {
  // 缺少类型定义
  // 使用 any 类型
}
```

---

## 💬 提交规范

### Commit Message 格式

```
<type>: <subject>

<body>（可选）
```

### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加批量导出功能` |
| `fix` | Bug 修复 | `fix: 修复视频上传失败问题` |
| `refactor` | 重构 | `refactor: 优化标注数据加载逻辑` |
| `style` | 样式调整 | `style: 调整复检页面布局` |
| `docs` | 文档更新 | `docs: 更新部署指南` |
| `test` | 测试相关 | `test: 添加标注保存单元测试` |
| `chore` | 构建/工具 | `chore: 更新依赖包版本` |

### 示例

```bash
# 好的提交信息 ✅
git commit -m "feat: 添加标注完成度统计功能"
git commit -m "fix: 修复复检页面数据加载异常"
git commit -m "refactor: 重构视频播放器组件提高性能"

# 不好的提交信息 ❌
git commit -m "更新代码"
git commit -m "fix bug"
git commit -m "修改"
```

---

## 🔀 Pull Request 流程

### 1. 创建 PR

在 GitHub 上创建 Pull Request，填写以下信息：

```markdown
## 📝 变更说明
<!-- 简要描述本次改动的内容和目的 -->

## 🎯 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 代码重构
- [ ] 样式调整
- [ ] 文档更新

## ✅ 测试情况
<!-- 描述如何测试这些改动 -->
- [ ] 本地测试通过
- [ ] 无 lint 错误
- [ ] 无 TypeScript 错误

## 📸 截图（如适用）
<!-- 如果是 UI 相关改动，请提供截图 -->

## 🔗 相关 Issue
<!-- 关联的 Issue 编号，如 #123 -->
```

### 2. 自检清单

提交 PR 前请确认：

- [ ] 代码已经过本地测试
- [ ] 运行 `npm run lint` 无错误
- [ ] 运行 `npm run build` 构建成功
- [ ] 已更新相关文档
- [ ] Commit 信息符合规范
- [ ] 没有包含不必要的文件（如 `.env.local`）

### 3. Code Review

- PR 提交后，会自动通知团队成员
- 至少需要 1 人审核通过
- 根据审核意见修改代码
- 审核通过后会自动合并

---

## 👀 Code Review 标准

### 审核者需要检查

#### 功能性
- ✅ 功能是否符合需求
- ✅ 是否有潜在的 bug
- ✅ 边界情况是否处理

#### 代码质量
- ✅ 代码是否易读易维护
- ✅ 是否遵循项目规范
- ✅ 是否有重复代码
- ✅ 变量/函数命名是否清晰

#### 性能
- ✅ 是否有性能问题
- ✅ 是否有不必要的渲染
- ✅ 数据加载是否优化

#### 安全性
- ✅ 是否有安全隐患
- ✅ 敏感信息是否泄露
- ✅ 输入是否有验证

### 提供反馈的原则

#### 建设性反馈 ✅

```
💡 建议：这里可以使用 useMemo 缓存计算结果，避免重复计算
🤔 疑问：这个状态是否可以合并到上层组件？
👍 优点：错误处理做得很好！
```

#### 避免的反馈 ❌

```
❌ "这代码写得不好"
❌ "为什么不用 XXX"（未说明理由）
❌ 只指出问题不提供建议
```

---

## 🧪 测试要求

### 手动测试

每次提交 PR 前必须完成的测试：

1. **功能测试**
   - [ ] 新功能按预期工作
   - [ ] 不影响现有功能
   - [ ] 边界情况正常处理

2. **浏览器兼容性**
   - [ ] Chrome 测试通过
   - [ ] Safari 测试通过（Mac 用户）
   - [ ] 移动端适配（如适用）

3. **数据测试**
   - [ ] 正常数据处理正确
   - [ ] 空数据不报错
   - [ ] 异常数据有提示

### Lint 检查

```bash
# 运行 lint 检查
npm run lint

# 自动修复部分问题
npm run lint -- --fix
```

---

## ❓ 常见问题

### Q1: 如何解决代码冲突？

```bash
# 方法1: Rebase（推荐）
git fetch origin
git rebase origin/main

# 如果有冲突，解决后：
git add .
git rebase --continue

# 方法2: Merge
git fetch origin
git merge origin/main
```

### Q2: 提交了错误的代码怎么办？

```bash
# 撤销最近一次提交（保留更改）
git reset HEAD~1

# 撤销最近一次提交（删除更改）
git reset --hard HEAD~1

# 修改最近一次提交信息
git commit --amend -m "新的提交信息"
```

### Q3: PR 被拒绝了怎么办？

1. 仔细阅读审核意见
2. 在原分支上修改代码
3. 提交新的 commit
4. PR 会自动更新
5. 请求重新审核

### Q4: 忘记切分支就开发了？

```bash
# 创建新分支（保留当前更改）
git checkout -b feature/your-feature

# 提交更改
git add .
git commit -m "feat: your feature"

# 推送到远程
git push origin feature/your-feature
```

### Q5: 如何配置 Supabase 环境？

参考 [SUPABASE_GUIDE.md](./SUPABASE_GUIDE.md) 文档。

创建 `.env.local` 文件：
```env
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的anon key
```

---

## 🆘 需要帮助？

- 📖 查看项目文档：[README.md](./README.md)
- 🔧 环境配置：[SUPABASE_GUIDE.md](./SUPABASE_GUIDE.md)
- 💬 联系项目负责人
- 🐛 提交 Issue

---

## 📚 推荐资源

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Ant Design 组件库](https://ant.design/)
- [Git 使用指南](https://git-scm.com/doc)

---

**记住：**
- 💡 有问题就提出来，没有愚蠢的问题
- 🤝 互相帮助，共同进步
- 📝 遇到问题记得更新文档
- ⚡ 小步快跑，频繁提交

祝你编码愉快！🚀

