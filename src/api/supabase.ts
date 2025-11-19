import { createClient } from '@supabase/supabase-js';

// Supabase配置
// 请替换为你的Supabase项目信息
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 验证环境变量
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.error('❌ Supabase 环境变量缺失或未配置！');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '已设置' : '未设置');
  console.error('请检查 Vercel 环境变量配置或 .env.local 文件');
}

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // 禁用会话持久化，避免潜在问题
  }
});

console.log('✅ Supabase 客户端已初始化');
console.log('📍 Supabase URL:', supabaseUrl);

// 检查连接状态
export async function checkConnection() {
  try {
    const { error } = await supabase.from('videos').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('✅ Supabase 连接成功');
    return true;
  } catch (error) {
    console.error('❌ Supabase 连接失败:', error);
    return false;
  }
}

