# 🔍 Supabase保存失败 - 诊断指南

## 方法1：直接在浏览器控制台测试（最简单）

请按照以下步骤操作：

### 第1步：打开浏览器控制台
1. 访问 http://localhost:3000
2. 按 **F12** 打开开发者工具
3. 切换到 **Console** 标签

### 第2步：复制并粘贴以下代码到控制台

```javascript
// 测试Supabase连接
(async function testSupabase() {
  console.log('🔍 开始测试...');
  
  // 1. 检查环境变量
  console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('Key 前20位:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20));
  
  // 2. 测试REST API
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('❌ 环境变量未配置！');
    return;
  }
  
  try {
    // 测试读取
    const response = await fetch(`${url}/rest/v1/annotations?limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    console.log('📖 读取测试状态:', response.status);
    const data = await response.json();
    console.log('📖 读取测试结果:', data);
    
    // 测试写入
    const testData = {
      id: 'test_' + Date.now(),
      video_id: 'test',
      sentence_no: 1,
      original_text: '测试',
      status: false
    };
    
    const writeResponse = await fetch(`${url}/rest/v1/annotations`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('✍️ 写入测试状态:', writeResponse.status);
    if (writeResponse.ok) {
      const result = await writeResponse.json();
      console.log('✅ 写入成功！', result);
      
      // 清理测试数据
      await fetch(`${url}/rest/v1/annotations?id=eq.${testData.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      console.log('🧹 清理完成');
    } else {
      const error = await writeResponse.json();
      console.error('❌ 写入失败:', error);
    }
  } catch (err) {
    console.error('❌ 测试异常:', err);
  }
})();
```

### 第3步：查看结果

**如果成功，会看到：**
- ✅ 写入成功！
- 显示测试数据

**如果失败，会看到错误信息，请完整复制给我！**

---

## 方法2：检查Supabase RLS设置

### 在Supabase控制台操作：

1. 登录 https://supabase.com
2. 选择项目：annotation-platform
3. 点击 **Table Editor**
4. 点击 **annotations** 表
5. 查看表名右侧是否有 **RLS** 标记

### 如果RLS是启用的，请执行以下SQL：

1. 点击 **SQL Editor**
2. 新建查询
3. 复制以下SQL：

```sql
-- 禁用所有表的RLS
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 验证RLS状态
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

4. 点击 **Run**
5. 应该看到所有表的 `rowsecurity` 都是 `false`

---

## 方法3：查看完整错误

### 在标注页面操作：

1. 访问 http://localhost:3000
2. 按 **F12** 打开控制台
3. 点击"教研标注"
4. 标注一些数据
5. 点击"提交标注"
6. **立即查看Console标签的错误信息**

### 需要关注的信息：

- 红色的错误文字
- `保存标注数据失败:` 后面的内容
- 任何 `401`、`403`、`500` 等状态码

---

## 常见错误及解决方案

### 错误1：401 Unauthorized
**原因**：API密钥无效或未配置
**解决**：
```bash
# 检查.env.local文件
cat /Users/ailian/Downloads/annotation-platform/.env.local

# 重启服务器
# Ctrl+C 停止，然后：
npm run dev
```

### 错误2：403 Forbidden
**原因**：RLS（行级安全）启用了
**解决**：执行上面的SQL禁用RLS

### 错误3：new row violates check constraint
**原因**：数据不符合表的约束
**解决**：需要调整数据格式或表结构

### 错误4：column "xxx" does not exist
**原因**：表结构与代码不匹配
**解决**：需要查看具体缺少哪个字段

---

## 快速检查清单

- [ ] 打开浏览器控制台（F12）
- [ ] 执行方法1的测试代码
- [ ] 查看是否有错误信息
- [ ] 检查Supabase的RLS设置
- [ ] 确认环境变量已配置
- [ ] 重启了服务器

---

## 💡 临时解决方案

如果Supabase一直有问题，可以暂时切换回JSON Server：

```bash
# 1. 重命名.env.local（禁用Supabase）
mv /Users/ailian/Downloads/annotation-platform/.env.local /Users/ailian/Downloads/annotation-platform/.env.local.backup

# 2. 启动JSON Server
cd /Users/ailian/Downloads/annotation-platform
npm run server

# 3. 在另一个终端启动前端
npm run dev
```

这样可以先让功能正常使用，之后再慢慢解决Supabase的问题。

---

**现在请执行方法1的测试代码，把控制台的输出完整复制给我！** 🔍

特别是：
- 读取测试状态是多少？（200、401、403？）
- 写入测试状态是多少？
- 有什么错误信息？

