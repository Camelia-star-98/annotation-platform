# 🎉 JSON Server 快速验证方案已就绪！

## ✅ 已完成配置

1. ✅ **安装依赖** - json-server已安装
2. ✅ **创建数据库** - db.json包含示例数据
3. ✅ **API接口** - src/api/jsonServer.ts
4. ✅ **启动脚本** - npm run server
5. ✅ **一键启动** - start.sh脚本

---

## 🚀 三种启动方式

### 方式1：一键启动（推荐）⭐️

```bash
cd /Users/ailian/Downloads/annotation-platform
./start.sh
```

会自动打开两个终端窗口！

---

### 方式2：手动启动（最可靠）

#### 终端1 - 启动后端：
```bash
cd /Users/ailian/Downloads/annotation-platform
npm run server
```

看到以下提示表示成功：
```
  \{^_^}/ hi!
  Loading db.json
  Done
  
  Resources
  http://localhost:3001/videos
  http://localhost:3001/annotations
  
  Home
  http://localhost:3001
```

⚠️ **保持这个终端运行！**

#### 终端2 - 启动前端：
```bash
cd /Users/ailian/Downloads/annotation-platform
npm run dev
```

看到：
```
  ➜  Local:   http://localhost:3000/
```

---

### 方式3：使用Cursor终端

1. 在Cursor中打开项目
2. 打开终端（Ctrl+`）
3. 分屏终端（点击终端右上角的+号）
4. 左边运行：`npm run server`
5. 右边运行：`npm run dev`

---

## 🎯 验证效果

### 1. 打开浏览器
访问：**http://localhost:3000**

### 2. 测试功能清单

#### ✅ 测试1：查看初始数据
- 主页应显示3个示例视频
- 点击"结果分析"可以看到2条示例标注

#### ✅ 测试2：上传视频和Excel
1. 点击"上传视频和标注数据"
2. 下载Excel模板
3. 准备一个短视频
4. 填写Excel数据
5. 上传两个文件
6. 查看是否自动进入标注页面

#### ✅ 测试3：标注功能
1. 点击"教研标注"
2. 输入姓名（如：测试员）
3. 修改人工标注文本
4. 选择问题分类
5. 填写备注
6. 勾选标注状态
7. 点击"提交标注"

#### ✅ 测试4：数据持久化
1. 提交标注后，打开 `db.json` 文件
2. 应该能看到刚才标注的数据
3. 刷新浏览器页面
4. 数据仍然存在 ✅

#### ✅ 测试5：查看统计
1. 主页勾选视频
2. 点击"结果分析"
3. 查看饼图和统计数据
4. 点击"下载分析报告"导出CSV

---

## 📊 后端API测试

### 浏览器直接访问

打开浏览器访问以下地址：

- **所有视频**：http://localhost:3001/videos
- **所有标注**：http://localhost:3001/annotations  
- **所有用户**：http://localhost:3001/users
- **API首页**：http://localhost:3001

### 使用curl测试

```bash
# 获取视频列表
curl http://localhost:3001/videos

# 获取标注数据
curl http://localhost:3001/annotations

# 添加新视频
curl -X POST http://localhost:3001/videos \
  -H "Content-Type: application/json" \
  -d '{"name":"测试视频.mp4","url":"test.mp4","subject":"数学","duration":0}'

# 更新标注
curl -X PATCH http://localhost:3001/annotations/anno_1 \
  -H "Content-Type: application/json" \
  -d '{"status":true}'
```

---

## 💾 数据管理

### 查看数据
直接打开 `db.json` 文件，使用文本编辑器或VSCode查看

### 备份数据
```bash
cp db.json db_backup.json
```

### 重置数据
删除 `db.json` 中除了结构外的所有数据，或重新创建：
```json
{
  "videos": [],
  "annotations": [],
  "users": []
}
```

### 导入数据
直接编辑 `db.json` 文件，粘贴数据即可

---

## 🐛 问题排查

### Q1: 启动失败？
```bash
# 检查端口是否被占用
lsof -i :3001
lsof -i :3000

# 杀死占用进程
kill -9 [PID]
```

### Q2: 数据没保存？
- 检查JSON Server是否在运行
- 查看终端是否有错误信息
- 确认 `db.json` 文件权限正确

### Q3: CORS错误？
- JSON Server默认支持CORS
- 如果仍有问题，重启JSON Server

### Q4: 看不到数据？
- 刷新浏览器（Ctrl+R）
- 清空缓存（Ctrl+Shift+R）
- 检查浏览器控制台错误

---

## 📁 文件说明

```
annotation-platform/
├── db.json              ← 数据库文件（所有数据存这里）
├── src/api/
│   └── jsonServer.ts    ← API接口代码
├── package.json         ← 包含启动脚本
├── start.sh            ← 一键启动脚本
└── JSON_SERVER_GUIDE.md ← 详细使用指南
```

---

## 🎊 优势总结

### 开发效率
✅ **1分钟启动** - 无需复杂配置  
✅ **自动保存** - 数据持久化  
✅ **RESTful API** - 标准接口  
✅ **实时生效** - 修改立即可见  

### 数据管理
✅ **可视化** - JSON格式易读  
✅ **可备份** - 复制文件即可  
✅ **可导入** - 直接编辑JSON  
✅ **可重置** - 删除文件重来  

### 后续迁移
✅ **API兼容** - 迁移到Supabase很简单  
✅ **数据迁移** - JSON可直接导入  
✅ **代码复用** - 只需修改API地址  

---

## 🔄 后续迁移到Supabase

当您验证完成，想要正式使用时：

1. 注册Supabase账号
2. 执行SQL创建表
3. 修改API调用地址
4. 导入 `db.json` 数据

**迁移时间**：只需10分钟！

---

## 📞 需要帮助？

- 启动问题：查看终端错误信息
- API问题：访问 http://localhost:3001 查看接口
- 数据问题：检查 `db.json` 文件
- 其他问题：查看浏览器控制台

---

## 🎯 现在开始！

### 立即启动
```bash
# 终端1
cd /Users/ailian/Downloads/annotation-platform
npm run server

# 终端2  
npm run dev
```

### 打开浏览器
http://localhost:3000

---

**就是这么简单！开始验证您的标注平台吧！** 🚀

