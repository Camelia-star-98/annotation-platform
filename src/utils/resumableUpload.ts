import { supabase } from '../api/supabase';

// 分片大小：5MB
const CHUNK_SIZE = 5 * 1024 * 1024;

// 上传状态接口
interface UploadState {
  fileName: string;
  fileSize: number;
  uploadedChunks: number[];
  totalChunks: number;
  uploadId?: string;
}

// 从 localStorage 获取上传状态
function getUploadState(fileId: string): UploadState | null {
  try {
    const stateStr = localStorage.getItem(`upload_state_${fileId}`);
    return stateStr ? JSON.parse(stateStr) : null;
  } catch (error) {
    console.error('读取上传状态失败:', error);
    return null;
  }
}

// 保存上传状态到 localStorage
function saveUploadState(fileId: string, state: UploadState): void {
  try {
    localStorage.setItem(`upload_state_${fileId}`, JSON.stringify(state));
  } catch (error) {
    console.error('保存上传状态失败:', error);
  }
}

// 删除上传状态
function clearUploadState(fileId: string): void {
  try {
    localStorage.removeItem(`upload_state_${fileId}`);
  } catch (error) {
    console.error('删除上传状态失败:', error);
  }
}

// 生成文件ID（用于识别同一个文件）
function generateFileId(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

// 将文件分片
function sliceFile(file: File): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    chunks.push(file.slice(offset, end));
    offset = end;
  }
  
  return chunks;
}

/**
 * 断点续传上传视频文件
 * @param file 要上传的文件
 * @param onProgress 进度回调 (uploadedBytes, totalBytes, percentage)
 * @param onChunkComplete 分片完成回调 (chunkIndex, totalChunks)
 * @returns 上传后的公开URL
 */
export async function resumableUploadVideo(
  file: File,
  onProgress?: (uploadedBytes: number, totalBytes: number, percentage: number) => void,
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
): Promise<string | null> {
  const fileId = generateFileId(file);
  
  // 清理文件名
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop() || 'mp4';
  const fileName = `video_${timestamp}.${fileExt}`;
  
  console.log('🚀 开始断点续传');
  console.log('📝 文件ID:', fileId);
  console.log('📝 文件名:', fileName);
  console.log('📦 文件大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  try {
    // 检查是否有未完成的上传
    let uploadState = getUploadState(fileId);
    
    // 将文件分片
    const chunks = sliceFile(file);
    const totalChunks = chunks.length;
    
    console.log('📦 总分片数:', totalChunks);
    console.log('📦 每片大小:', (CHUNK_SIZE / 1024 / 1024).toFixed(2), 'MB');
    
    // 如果没有上传状态或文件信息不匹配，创建新的上传状态
    if (!uploadState || uploadState.fileSize !== file.size) {
      uploadState = {
        fileName,
        fileSize: file.size,
        uploadedChunks: [],
        totalChunks
      };
      saveUploadState(fileId, uploadState);
      console.log('✨ 创建新的上传任务');
    } else {
      console.log('🔄 恢复之前的上传，已完成:', uploadState.uploadedChunks.length, '/', totalChunks);
    }
    
    // 上传每个分片
    const uploadedChunks: Blob[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      // 如果这个分片已经上传过，跳过
      if (uploadState.uploadedChunks.includes(i)) {
        console.log(`⏭️ 跳过已上传的分片 ${i + 1}/${totalChunks}`);
        uploadedChunks.push(chunks[i]);
        
        // 更新进度
        const uploadedBytes = (i + 1) * CHUNK_SIZE;
        const percentage = Math.min((uploadedBytes / file.size) * 100, 100);
        onProgress?.(uploadedBytes, file.size, percentage);
        onChunkComplete?.(i + 1, totalChunks);
        
        continue;
      }
      
      // 上传当前分片到临时位置（使用分片索引作为临时文件名）
      const chunkFileName = `${fileName}_chunk_${i}`;
      
      try {
        console.log(`📤 上传分片 ${i + 1}/${totalChunks}...`);
        
        const { data: chunkData, error: chunkError } = await supabase.storage
          .from('videos')
          .upload(chunkFileName, chunks[i], {
            cacheControl: '3600',
            upsert: true // 允许覆盖，支持重试
          });
        
        if (chunkError) {
          console.error(`❌ 分片 ${i + 1} 上传失败:`, chunkError);
          throw new Error(`分片 ${i + 1} 上传失败: ${chunkError.message}`);
        }
        
        console.log(`✅ 分片 ${i + 1}/${totalChunks} 上传成功`);
        
        // 标记这个分片已上传
        uploadState.uploadedChunks.push(i);
        saveUploadState(fileId, uploadState);
        
        uploadedChunks.push(chunks[i]);
        
        // 更新进度
        const uploadedBytes = (i + 1) * CHUNK_SIZE;
        const percentage = Math.min((uploadedBytes / file.size) * 100, 100);
        onProgress?.(uploadedBytes, file.size, percentage);
        onChunkComplete?.(i + 1, totalChunks);
        
      } catch (error) {
        console.error(`❌ 上传分片 ${i + 1} 时出错:`, error);
        throw error; // 抛出错误，让用户可以重试
      }
    }
    
    console.log('✅ 所有分片上传完成，开始合并...');
    
    // 合并所有分片为完整文件
    const completeFile = new Blob(uploadedChunks, { type: file.type });
    
    console.log('📤 上传完整文件...');
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, completeFile, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error('❌ 上传完整文件失败:', error);
      throw new Error(`上传失败: ${error.message}`);
    }
    
    if (!data || !data.path) {
      console.error('❌ 上传返回的数据无效:', data);
      throw new Error('上传返回的数据无效');
    }
    
    console.log('✅ 完整文件上传成功:', data.path);
    
    // 删除临时分片文件
    console.log('🧹 清理临时分片文件...');
    for (let i = 0; i < totalChunks; i++) {
      const chunkFileName = `${fileName}_chunk_${i}`;
      try {
        await supabase.storage.from('videos').remove([chunkFileName]);
      } catch (error) {
        console.warn(`清理分片 ${i} 失败:`, error);
        // 忽略清理错误，不影响主流程
      }
    }
    
    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);
    
    if (!urlData || !urlData.publicUrl) {
      console.error('❌ 获取公开URL失败:', urlData);
      throw new Error('获取公开URL失败');
    }
    
    console.log('✅ 获取公开URL成功:', urlData.publicUrl);
    
    // 清理上传状态
    clearUploadState(fileId);
    
    onProgress?.(file.size, file.size, 100);
    
    return urlData.publicUrl;
    
  } catch (error: any) {
    console.error('❌ 断点续传失败:', error);
    // 不清理上传状态，下次可以继续
    throw error;
  }
}

/**
 * 取消上传并清理状态
 */
export function cancelResumableUpload(file: File): void {
  const fileId = generateFileId(file);
  clearUploadState(fileId);
  console.log('❌ 已取消上传并清理状态');
}

/**
 * 获取上传进度（如果有未完成的上传）
 */
export function getUploadProgress(file: File): number {
  const fileId = generateFileId(file);
  const state = getUploadState(fileId);
  
  if (!state) return 0;
  
  return (state.uploadedChunks.length / state.totalChunks) * 100;
}

