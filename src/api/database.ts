import { supabase } from './supabase';
import type { AnnotationItem, VideoInfo } from '../types';

// ========== 视频相关 ==========

// 获取所有视频
export async function getVideos(): Promise<VideoInfo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取视频列表失败:', error);
    return [];
  }

  console.log('🔍 数据库返回的原始视频数据:', data);
  console.log('🔍 第一条数据详细信息:', data?.[0]);

  return data || [];
}

// 添加视频
export async function addVideo(video: VideoInfo): Promise<VideoInfo | null> {
  console.log('🔵 addVideo 被调用');
  console.log('📦 接收到的参数:', video);
  console.log('📝 参数详情:');
  console.log('  - id:', video.id);
  console.log('  - name:', video.name);
  console.log('  - url:', video.url);
  console.log('  - subject:', video.subject);
  console.log('  - duration:', video.duration);
  console.log('  - required_annotators:', video.required_annotators);
  
  // 确保 URL 不为空
  if (!video.url) {
    console.error('❌ 视频URL为空，无法保存到数据库');
    throw new Error('视频URL不能为空');
  }
  
  // 明确指定要插入的字段
  const insertData = {
    id: video.id,
    name: video.name,
    url: video.url,
    subject: video.subject,
    duration: video.duration,
    required_annotators: video.required_annotators || 1 // 添加待标注数量字段
  };
  
  console.log('📤 准备插入数据库的数据:', insertData);
  
  const { data, error } = await supabase
    .from('videos')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('❌ 添加视频失败:', error);
    console.error('❌ 错误详情:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log('✅ 添加视频成功，数据库返回:', data);
  console.log('✅ 返回的 URL:', data?.url);
  return data;
}

// 上传视频文件到Supabase Storage
export async function uploadVideoFile(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    // 清理文件名：移除中文和特殊字符，保留扩展名
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop() || 'mp4';
    const fileName = `video_${timestamp}.${fileExt}`;
    
    const fileSizeMB = file.size / 1024 / 1024;
    console.log('📝 原始文件名:', file.name);
    console.log('📝 清理后文件名:', fileName);
    console.log('📦 文件大小:', fileSizeMB.toFixed(2), 'MB');
    console.log('⏰ 开始上传时间:', new Date().toLocaleTimeString());
    
    // 检查文件大小限制（1GB = 1024MB）
    const MAX_FILE_SIZE_MB = 1024;
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      console.error(`❌ 文件过大: ${fileSizeMB.toFixed(2)}MB，超过限制 ${MAX_FILE_SIZE_MB}MB`);
      throw new Error(`FILE_TOO_LARGE:${fileSizeMB.toFixed(2)}`);
    }
    
    // 上传文件到 Supabase Storage
    console.log('📤 开始上传文件到 Supabase Storage...');
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ 上传视频文件失败:', error);
      console.error('❌ 错误详情:', JSON.stringify(error, null, 2));
      throw new Error(`上传失败: ${error.message}`);
    }

    console.log('✅ 视频上传到Storage成功:', data);
    console.log('⏰ 上传结束时间:', new Date().toLocaleTimeString());
    onProgress?.(100);

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);

    console.log('✅ 视频公开URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ uploadVideoFile 异常:', error);
    if (error instanceof Error) {
      console.error('❌ 异常信息:', error.message);
      console.error('❌ 异常堆栈:', error.stack);
    }
    return null;
  }
}

// ========== 标注数据相关 ==========

// 获取所有标注数据
export async function getAllAnnotations(): Promise<AnnotationItem[]> {
  try {
    const { data, error } = await supabase
      .from('annotations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取所有标注数据失败:', error);
      return [];
    }

    // 转换数据格式（容错处理不存在的字段）
    return (data || []).map(item => ({
      id: item.id || '',
      videoId: item.video_id || '',
      sentenceNo: item.sentence_no || 0,
      timeRange: item.time_range || '',
      startTime: item.start_time,
      endTime: item.end_time,
      originalText: item.original_text || '',
      aiRewrittenText: item.ai_rewritten_text || '',
      humanAnnotatedText: item.human_annotated_text || '',
      majorCategory: item.major_category || '',
      minorCategory: item.minor_category || '',
      remark: item.remark || '',
      status: item.status || false,
      annotator: item.annotator || '',
      isQualified: item.is_qualified,
      inspector: item.inspector || '',
      reviewer: item.reviewer || '', // 添加复检人
      reviewStatus: item.review_status, // 添加复检状态
      videoName: item.video_name || '',
      videoUrl: item.video_url || '',
      subject: item.subject || ''
    }));
  } catch (error) {
    console.error('获取所有标注数据异常:', error);
    return [];
  }
}

// 获取指定视频的标注数据
export async function getAnnotations(videoId: string): Promise<AnnotationItem[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('video_id', videoId)
    .order('sentence_no', { ascending: true });

  if (error) {
    console.error('获取标注数据失败:', error);
    return [];
  }

  // 转换数据格式
  return (data || []).map(item => ({
    id: item.id,
    videoId: item.video_id,
    sentenceNo: item.sentence_no,
    timeRange: item.time_range,
    startTime: item.start_time,
    endTime: item.end_time,
    originalText: item.original_text,
    aiRewrittenText: item.ai_rewritten_text,
    humanAnnotatedText: item.human_annotated_text,
    majorCategory: item.major_category,
    minorCategory: item.minor_category,
    remark: item.remark,
    status: item.status,
    annotator: item.annotator,
    isQualified: item.is_qualified,
    inspector: item.inspector,
    reviewer: item.reviewer || '', // 添加复检人
    reviewStatus: item.review_status // 添加复检状态
  }));
}

// 批量保存标注数据
export async function saveAnnotations(
  videoId: string,
  annotations: AnnotationItem[]
): Promise<boolean> {
  try {
    console.log('🔵 saveAnnotations 被调用');
    console.log('📦 videoId:', videoId);
    console.log('📦 标注数量:', annotations.length);
    
    // ✅ 移除了 upsert 视频的逻辑！
    // 因为 addVideo() 已经正确保存了视频信息（包括 URL）
    // 这里重复 upsert 会用 annotations[0].videoUrl（空值）覆盖正确的 URL

    // 第2步：转换并保存标注数据
    const data = annotations.map((item, index) => ({
      id: item.id || `${videoId}_${index + 1}`, // 如果没有ID，自动生成
      video_id: videoId,
      sentence_no: item.sentenceNo,
      time_range: item.timeRange,
      start_time: item.startTime,
      end_time: item.endTime,
      original_text: item.originalText || '',
      ai_rewritten_text: item.aiRewrittenText || '',
      human_annotated_text: item.humanAnnotatedText || '',
      major_category: item.majorCategory || '',
      minor_category: item.minorCategory || '',
      remark: item.remark || '',
      status: item.status || false,
      annotator: item.annotator || ''
    }));

    // 使用upsert（如果存在则更新，不存在则插入）
    const { error } = await supabase
      .from('annotations')
      .upsert(data, { onConflict: 'id' });

    if (error) {
      console.error('保存标注数据失败:', error);
      return false;
    }

    console.log('✅ 成功保存到 Supabase:', data.length, '条数据');
    
    // 第3步：记录标注完成状态
    const annotatorName = annotations[0]?.annotator;
    if (annotatorName && videoId) {
      await recordAnnotationCompletion(videoId, annotatorName, annotations.length);
    }
    
    return true;
  } catch (error) {
    console.error('保存标注数据异常:', error);
    return false;
  }
}

// 更新单条标注
export async function updateAnnotation(
  id: string,
  updates: Partial<AnnotationItem>
): Promise<boolean> {
  try {
    // 构建更新对象
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.humanAnnotatedText !== undefined) {
      updateData.human_annotated_text = updates.humanAnnotatedText;
    }
    if (updates.majorCategory !== undefined) {
      updateData.major_category = updates.majorCategory;
    }
    if (updates.minorCategory !== undefined) {
      updateData.minor_category = updates.minorCategory;
    }
    if (updates.remark !== undefined) {
      updateData.remark = updates.remark;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.isQualified !== undefined) {
      updateData.is_qualified = updates.isQualified;
    }
    if (updates.inspector !== undefined) {
      updateData.inspector = updates.inspector;
    }

    const { error } = await supabase
      .from('annotations')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('更新标注失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('更新标注异常:', error);
    return false;
  }
}

// ========== 用户相关 ==========

// 添加用户
export async function addUser(name: string, role: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .insert([{ name, role }]);

  if (error) {
    console.error('添加用户失败:', error);
    return false;
  }

  return true;
}

// 获取用户列表
export async function getUsers(): Promise<any[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }

  return data || [];
}

// ========== 统计相关 ==========

// 获取标注统计
export async function getAnnotationStats(videoId?: string) {
  let query = supabase.from('annotations').select('*');
  
  if (videoId) {
    query = query.eq('video_id', videoId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取统计数据失败:', error);
    return null;
  }

  const total = data.length;
  const completed = data.filter(item => item.status).length;
  const withCategory = data.filter(item => item.major_category).length;

  return {
    total,
    completed,
    withCategory,
    completionRate: total > 0 ? (completed / total * 100).toFixed(1) : 0
  };
}

// ========== 标注完成跟踪 ==========

// 记录标注完成状态
export async function recordAnnotationCompletion(
  videoId: string,
  annotatorName: string,
  annotationCount: number
): Promise<boolean> {
  try {
    console.log('🔵 recordAnnotationCompletion 被调用');
    console.log('📦 videoId:', videoId);
    console.log('📦 annotatorName:', annotatorName);
    console.log('📦 annotationCount:', annotationCount);
    
    // 使用 upsert 更新或插入完成记录
    const { error } = await supabase
      .from('annotation_completions')
      .upsert({
        video_id: videoId,
        annotator_name: annotatorName,
        annotation_count: annotationCount,
        completed_at: new Date().toISOString()
      }, { 
        onConflict: 'video_id,annotator_name' 
      });

    if (error) {
      console.error('❌ 记录完成状态失败:', error);
      return false;
    }

    console.log('✅ 记录完成状态成功');
    return true;
  } catch (error) {
    console.error('记录完成状态失败:', error);
    return false;
  }
}

// 获取视频的已完成标注人数
export async function getCompletedAnnotatorsCount(videoId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('annotation_completions')
      .select('annotator_name')
      .eq('video_id', videoId);

    if (error) {
      console.error('获取完成人数失败:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('获取完成人数失败:', error);
    return 0;
  }
}

// 批量获取多个视频的完成人数
export async function getBatchCompletedAnnotatorsCount(
  videoIds: string[]
): Promise<Record<string, number>> {
  if (videoIds.length === 0) return {};
  
  try {
    const { data, error } = await supabase
      .from('annotation_completions')
      .select('video_id, annotator_name')
      .in('video_id', videoIds);

    if (error) {
      console.error('批量获取完成人数失败:', error);
      return {};
    }

    // 统计每个视频的完成人数
    const countMap: Record<string, number> = {};
    videoIds.forEach(id => {
      countMap[id] = 0;
    });

    data?.forEach(item => {
      if (item.video_id) {
        countMap[item.video_id] = (countMap[item.video_id] || 0) + 1;
      }
    });

    return countMap;
  } catch (error) {
    console.error('批量获取完成人数失败:', error);
    return {};
  }
}

