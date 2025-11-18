# 🚀 JSON Server 快速使用指南

## ✅ 已完成配置

我已经帮您：
1. ✅ 安装了 `json-server`
2. ✅ 创建了数据文件 `db.json`（包含示例数据）
3. ✅ 创建了API接口 `src/api/jsonServer.ts`
4. ✅ 添加了启动脚本 `npm run server`

---

## 🎯 快速启动（2步）

### 第1步：启动后端服务器

打开**第一个**终端，运行：

```bash
cd /Users/ailian/Downloads/annotation-platform
npm run server
```

✅ 看到以下提示表示成功：
```
  \{^_^}/ hi!

  Loading db.json
  Done

  Resources
  http://localhost:3001/videos
  http://localhost:3001/annotations
  http://localhost:3001/users

  Home
  http://localhost:3001
```

⚠️ **保持这个终端运行，不要关闭！**

---

### 第2步：启动前端项目

打开**第二个**终端，运行：

```bash
cd /Users/ailian/Downloads/annotation-platform
npm run dev
```

✅ 看到：
```
  VITE ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

---

## 🎉 验证效果

### 1. 打开浏览器
访问：http://localhost:3000

### 2. 测试功能

#### 测试1：查看数据
- 主页应该显示3个视频（数学、英语、物理）
- 数据来自 `db.json` 文件

#### 测试2：上传功能
1. 点击"上传视频和标注数据"
2. 上传一个视频 + Excel文件
3. 数据会自动保存到 `db.json`

#### 测试3：标注功能
1. 点击"教研标注"
2. 输入姓名开始标注
3. 修改文本、选择分类
4. 点击"提交标注"
5. 数据会保存到 `db.json`

#### 测试4：查看保存的数据
直接打开 `db.json` 文件，可以看到所有数据！

---

## 📊 API接口

JSON Server自动提供了RESTful API：

### 视频相关
```bash
# 获取所有视频
GET http://localhost:3001/videos

# 获取单个视频
GET http://localhost:3001/videos/video_1

# 添加视频
POST http://localhost:3001/videos

# 更新视频
PUT http://localhost:3001/videos/video_1

# 删除视频
DELETE http://localhost:3001/videos/video_1
```

### 标注数据
```bash
# 获取所有标注
GET http://localhost:3001/annotations

# 按视频ID筛选
GET http://localhost:3001/annotations?videoId=video_1

# 添加标注
POST http://localhost:3001/annotations

# 更新标注
PATCH http://localhost:3001/annotations/anno_1
```

---

## 🔍 查看和管理数据

### 方法1：编辑器查看
直接打开 `db.json` 文件，可以看到和编辑所有数据

### 方法2：浏览器查看
访问：http://localhost:3001

可以看到所有API端点

### 方法3：使用Postman
导入上面的API地址，可以手动测试

---

## 💾 数据说明

### 初始数据
`db.json` 包含：
- 3个示例视频
- 2条示例标注数据
- 1个示例用户

### 数据持久化
- ✅ 所有操作自动保存到 `db.json`
- ✅ 重启服务器数据不丢失
- ✅ 可以手动备份 `db.json`

### 重置数据
如果想重置到初始状态，删除 `db.json` 中的内容，我会重新生成示例数据。

---

## 🎯 测试建议

### 测试1：基本CRUD
1. 查看视频列表 ✓
2. 添加新视频 ✓
3. 修改标注数据 ✓
4. 删除数据 ✓

### 测试2：上传功能
1. 上传视频文件
2. 上传Excel数据
3. 查看是否自动保存到 `db.json`

### 测试3：标注流程
1. 进入教研标注
2. 编辑文本和分类
3. 提交保存
4. 刷新页面验证数据持久化

---

## 🐛 常见问题

### Q1: 端口被占用？
**A**: 修改端口号
```bash
# 在 package.json 中修改
"server": "json-server --watch db.json --port 3002"
```

### Q2: 数据没有保存？
**A**: 检查：
- JSON Server是否正在运行
- 浏览器控制台是否有错误
- `db.json` 文件权限

### Q3: CORS错误？
**A**: JSON Server默认支持CORS，不需要配置

### Q4: 数据格式错误？
**A**: 确保 `db.json` 是有效的JSON格式，可以用在线工具验证

---

## 📝 数据结构

### videos（视频表）
```json
{
  "id": "video_1",
  "name": "数学课程_01.mp4",
  "url": "视频URL",
  "subject": "数学",
  "duration": 300
}
```

### annotations（标注表）
```json
{
  "id": "anno_1",
  "videoId": "video_1",
  "sentenceNo": 1,
  "timeRange": "00:15 - 00:30",
  "startTime": 15,
  "endTime": 30,
  "originalText": "原文",
  "aiRewrittenText": "AI改写",
  "humanAnnotatedText": "人工标注",
  "majorCategory": "问题大类",
  "minorCategory": "问题小类",
  "remark": "备注",
  "status": true,
  "annotator": "标注人"
}
```

---

## 🎊 优势

### 开发优势
✅ **即时可用** - 无需配置数据库  
✅ **自动保存** - 数据持久化  
✅ **RESTful API** - 标准接口  
✅ **可视化数据** - 直接查看JSON  
✅ **零成本** - 完全免费  

### 后续迁移
当需要迁移到Supabase时：
- API接口结构相同
- 只需修改API地址
- 数据可以导入导出

---

## 🚀 立即开始

**终端1（后端）：**
```bash
npm run server
```

**终端2（前端）：**
```bash
npm run dev
```

**浏览器：**
http://localhost:3000

---

**就是这么简单！现在开始验证吧！** 🎈

