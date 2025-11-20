import { supabase } from '../api/supabase';

/**
 * 高性能视频上传（无分片，直接上传）
 * @param file 要上传的文件
 * @param onProgress 进度回调 (percentage)
 * @returns 上传后的公开URL
 */
export async function fastUploadVideo(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<string | null> {
  // 清理文件名
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop() || 'mp4';
  const fileName = `video_${timestamp}.${fileExt}`;
  
  console.log('🚀 开始快速上传');
  console.log('📝 文件名:', fileName);
  console.log('📦 文件大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  try {
    onProgress?.(10);
    
    // 直接上传到 Supabase Storage（不分片）
    console.log('📤 开始上传文件...');
    
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ 上传失败:', error);
      throw new Error(`上传失败: ${error.message}`);
    }

    if (!data || !data.path) {
      console.error('❌ 上传返回的数据无效:', data);
      throw new Error('上传返回的数据无效');
    }

    console.log('✅ 文件上传成功:', data.path);
    onProgress?.(90);

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);

    if (!urlData || !urlData.publicUrl) {
      console.error('❌ 获取公开URL失败:', urlData);
      throw new Error('获取公开URL失败');
    }

    console.log('✅ 获取公开URL成功:', urlData.publicUrl);
    onProgress?.(100);

    return urlData.publicUrl;
    
  } catch (error: any) {
    console.error('❌ 上传失败:', error);
    throw error;
  }
}

