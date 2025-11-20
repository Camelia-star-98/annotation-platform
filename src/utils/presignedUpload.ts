import { supabase } from '../api/supabase';

/**
 * 使用预签名 URL 上传视频（最快的上传方式）
 * @param file 要上传的文件
 * @param onProgress 进度回调 (percentage)
 * @returns 上传后的公开URL
 */
export async function presignedUploadVideo(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<string | null> {
  // 清理文件名
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop() || 'mp4';
  const fileName = `video_${timestamp}.${fileExt}`;
  
  console.log('🚀 开始预签名直传');
  console.log('📝 文件名:', fileName);
  console.log('📦 文件大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  try {
    onProgress?.(5);
    
    // 步骤1: 获取预签名上传 URL
    console.log('📝 正在获取预签名 URL...');
    
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('videos')
      .createSignedUploadUrl(fileName);
    
    if (signedUrlError) {
      console.error('❌ 获取预签名 URL 失败:', signedUrlError);
      throw new Error(`获取预签名 URL 失败: ${signedUrlError.message}`);
    }
    
    if (!signedUrlData || !signedUrlData.signedUrl) {
      console.error('❌ 预签名 URL 无效:', signedUrlData);
      throw new Error('预签名 URL 无效');
    }
    
    console.log('✅ 获取预签名 URL 成功');
    console.log('🔗 Token:', signedUrlData.token);
    onProgress?.(10);
    
    // 步骤2: 使用预签名 URL 直接上传到 Supabase Storage（绕过服务器）
    console.log('📤 开始直传到 Supabase Storage...');
    
    const uploadStartTime = Date.now();
    
    // 使用 XMLHttpRequest 以便监听上传进度
    const uploadResult = await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          console.log(`📊 上传进度: ${percentComplete.toFixed(1)}%`);
          // 将进度映射到 10-90%
          onProgress?.(10 + percentComplete * 0.8);
        }
      });
      
      // 上传完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;
          const speedMBs = (file.size / 1024 / 1024) / elapsedSeconds;
          console.log(`✅ 上传完成！耗时: ${elapsedSeconds.toFixed(1)}秒, 速度: ${speedMBs.toFixed(2)} MB/s`);
          resolve();
        } else {
          console.error('❌ 上传失败:', xhr.status, xhr.statusText);
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
        }
      });
      
      // 上传错误
      xhr.addEventListener('error', () => {
        console.error('❌ 网络错误');
        reject(new Error('网络错误，上传失败'));
      });
      
      // 上传超时
      xhr.addEventListener('timeout', () => {
        console.error('❌ 上传超时');
        reject(new Error('上传超时，请检查网络连接'));
      });
      
      // 配置请求
      xhr.open('PUT', signedUrlData.signedUrl, true);
      xhr.timeout = 10 * 60 * 1000; // 10分钟超时
      
      // 设置请求头
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.setRequestHeader('x-upsert', 'false'); // 不覆盖已存在的文件
      
      // 发送文件
      xhr.send(file);
    });
    
    onProgress?.(90);
    
    // 步骤3: 获取公开 URL
    console.log('🔗 正在获取公开 URL...');
    
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);
    
    if (!urlData || !urlData.publicUrl) {
      console.error('❌ 获取公开 URL 失败:', urlData);
      throw new Error('获取公开 URL 失败');
    }
    
    console.log('✅ 获取公开 URL 成功:', urlData.publicUrl);
    onProgress?.(100);
    
    return urlData.publicUrl;
    
  } catch (error: any) {
    console.error('❌ 预签名直传失败:', error);
    throw error;
  }
}

/**
 * 批量创建预签名 URL（用于多文件上传）
 */
export async function createBatchSignedUrls(
  fileNames: string[]
): Promise<{ fileName: string; signedUrl: string; token: string }[]> {
  const results = [];
  
  for (const fileName of fileNames) {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUploadUrl(fileName);
    
    if (error || !data) {
      console.error(`获取 ${fileName} 的预签名 URL 失败:`, error);
      continue;
    }
    
    results.push({
      fileName,
      signedUrl: data.signedUrl,
      token: data.token
    });
  }
  
  return results;
}

