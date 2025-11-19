import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('🔍 环境变量检查:');
console.log('VITE_SUPABASE_URL:', supabaseUrl ? `已设置 (${supabaseUrl.substring(0, 30)}...)` : '❌ 未设置');
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `已设置 (长度: ${supabaseAnonKey.length})` : '❌ 未设置');

// 验证环境变量
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 环境变量缺失！');
  console.error('请检查 .env.local 文件是否存在并包含：');
  console.error('VITE_SUPABASE_URL=your_url');
  console.error('VITE_SUPABASE_ANON_KEY=your_key');
}

// 创建 Supabase 客户端（使用占位符或真实值）
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: false
  }
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ 使用占位符创建了无效的 Supabase 客户端');
} else {
  console.log('✅ Supabase 客户端已初始化');
  console.log('📍 Supabase URL:', supabaseUrl);
}

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

