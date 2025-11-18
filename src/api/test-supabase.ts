import { supabase } from './supabase';

// 测试连接和表结构
export async function testSupabaseConnection() {
  console.log('🔍 开始测试Supabase连接...');
  
  // 1. 测试基本连接
  try {
    const { data, error } = await supabase.from('annotations').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('❌ 连接失败:', error);
      return { success: false, error: error.message };
    }
    console.log('✅ 连接成功！');
  } catch (err) {
    console.error('❌ 连接异常:', err);
    return { success: false, error: String(err) };
  }

  // 2. 测试插入数据
  try {
    const testData = {
      id: 'test_' + Date.now(),
      video_id: 'test_video',
      sentence_no: 1,
      time_range: '00:00-00:05',
      original_text: '测试文本',
      ai_rewritten_text: '测试AI改写',
      human_annotated_text: '测试人工标注',
      status: true,
      annotator: '测试用户'
    };

    console.log('📝 测试插入数据:', testData);
    
    const { data, error } = await supabase
      .from('annotations')
      .insert([testData])
      .select();

    if (error) {
      console.error('❌ 插入失败:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message, details: error };
    }

    console.log('✅ 插入成功！', data);

    // 3. 清理测试数据
    await supabase.from('annotations').delete().eq('id', testData.id);
    console.log('🧹 清理测试数据完成');

    return { success: true };
  } catch (err: any) {
    console.error('❌ 测试异常:', err);
    return { success: false, error: String(err) };
  }
}

// 获取表结构信息
export async function getTableSchema() {
  try {
    // 查询一条数据看看表结构
    const { data, error } = await supabase
      .from('annotations')
      .select('*')
      .limit(1);

    if (error) {
      console.error('获取表结构失败:', error);
      return null;
    }

    console.log('📋 表结构示例:', data);
    return data;
  } catch (err) {
    console.error('获取表结构异常:', err);
    return null;
  }
}

