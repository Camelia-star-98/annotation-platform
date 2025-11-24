import { supabase } from './supabase';
import type { AnnotationItem, VideoInfo } from '../types';

// ========== 视频相关 ==========

// 获取所有视频（优化：只查询必要字段，移除日志）
export async function getVideos(): Promise<VideoInfo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, name, url, subject, duration, required_annotators, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取视频列表失败:', error);
    return [];
  }

  return data || [];
}

// 获取单个视频（优化：避免查询所有视频）
export async function getVideo(videoId: string): Promise<VideoInfo | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, name, url, subject, duration, required_annotators, created_at')
    .eq('id', videoId)
    .single();

  if (error) {
    console.error('获取视频失败:', error);
    return null;
  }

  return data;
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
  
  // 允许空URL（用于只上传标注数据的场景）
  if (!video.url) {
    console.log('⚠️ 视频URL为空，将创建无视频的数据集');
  }
  
  // 明确指定要插入的字段
  const insertData = {
    id: video.id,
    name: video.name,
    url: video.url || '', // 允许空URL
    subject: video.subject,
    duration: video.duration || 0,
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
    
    // 检查上传返回的数据
    if (!data || !data.path) {
      console.error('❌ 上传返回的数据无效:', data);
      throw new Error('上传返回的数据无效，缺少 path 字段');
    }
    
    console.log('📝 上传文件的 path:', data.path);
    onProgress?.(100);

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);

    console.log('📝 getPublicUrl 返回的数据:', urlData);
    
    if (!urlData || !urlData.publicUrl) {
      console.error('❌ 无法获取公开URL:', urlData);
      throw new Error('无法获取视频的公开URL，请检查 Supabase Storage 配置');
    }

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
    // 分批加载所有数据，避免limit限制
    let allData: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('获取标注数据失败:', error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      allData = allData.concat(data);
      offset += batchSize;

      // 如果返回的数据少于batchSize，说明已经是最后一批
      if (data.length < batchSize) {
        hasMore = false;
      }
    }

    console.log(`📊 getAllAnnotations 加载了 ${allData.length} 条数据`);

    // 转换数据格式（容错处理不存在的字段）
    return allData.map(item => ({
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

// 获取已复检的标注数据（用于数据分析）
export async function getReviewedAnnotations(videoIds?: string[]): Promise<AnnotationItem[]> {
  try {
    let query = supabase
      .from('annotations')
      .select('*')
      .eq('review_status', true) // 只查询已复检的数据
      .order('created_at', { ascending: false });

    // 如果指定了视频ID，则只查询这些视频的数据
    if (videoIds && videoIds.length > 0) {
      query = query.in('video_id', videoIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取已复检标注数据失败:', error);
      return [];
    }

    console.log('📊 getReviewedAnnotations 返回数据量:', data?.length || 0);

    // 转换数据格式
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
      reviewer: item.reviewer || '',
      reviewStatus: item.review_status,
      videoName: item.video_name || '',
      videoUrl: item.video_url || '',
      subject: item.subject || ''
    }));
  } catch (error) {
    console.error('获取已复检标注数据异常:', error);
    return [];
  }
}

// 获取指定视频的标注数据
export async function getAnnotations(videoId: string): Promise<AnnotationItem[]> {
  // 优化：只查询必要字段，不查询大文本字段（如 ai_rewritten_text）
  const { data, error } = await supabase
    .from('annotations')
    .select('id, video_id, sentence_no, time_range, start_time, end_time, original_text, human_annotated_text, major_category, minor_category, remark, status, annotator, is_qualified, inspector, reviewer, review_status')
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
    aiRewrittenText: '', // 不查询，节省带宽
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
    // 每个标注人有独立的数据副本，ID包含标注人姓名
    // 如果标注人为空字符串，保持为空字符串（不上传的数据），不要设置为 'unknown'
    const annotatorName = annotations[0]?.annotator || '';
    // 生成ID时，如果标注人为空，使用 'template' 作为占位符
    const idAnnotatorName = annotatorName || 'template';
    
    const data = annotations.map((item, index) => ({
      id: item.id || `${videoId}_${item.sentenceNo || index + 1}_${idAnnotatorName}`, // ID包含标注人，实现数据隔离
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
      annotator: annotatorName, // 保持原始值，如果为空字符串则保持为空
      // 质检相关字段（重新提交时会被清除）
      is_qualified: item.isQualified ?? null,
      inspector: item.inspector || null,
      // 复检相关字段
      reviewer: item.reviewer || null,
      review_status: item.reviewStatus ?? null
    }));

    console.log('📝 标注人:', annotatorName);
    console.log('📝 生成的ID示例:', data[0]?.id);
    console.log('📝 质检状态:', data[0]?.is_qualified, '质检人:', data[0]?.inspector);
    console.log('📝 第一条数据的 human_annotated_text:', data[0]?.human_annotated_text);
    console.log('📝 原始 annotations[0].humanAnnotatedText:', annotations[0]?.humanAnnotatedText);

    // 🚀 优化：分批保存，避免超时
    const BATCH_SIZE = 50; // 每批50条
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    
    console.log(`📦 分批保存：总计 ${data.length} 条，分 ${totalBatches} 批，每批 ${BATCH_SIZE} 条`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, data.length);
      const batch = data.slice(start, end);
      
      console.log(`📤 正在保存第 ${i + 1}/${totalBatches} 批 (${batch.length} 条)...`);
      
      // 使用upsert（如果存在则更新，不存在则插入）
      const { error } = await supabase
        .from('annotations')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ 第 ${i + 1} 批保存失败:`, error);
        throw new Error(`保存第 ${i + 1} 批数据失败: ${error.message}`);
      }
      
      console.log(`✅ 第 ${i + 1}/${totalBatches} 批保存成功`);
    }

    console.log('✅ 所有标注数据保存成功，共', data.length, '条');
    
    // 第3步：记录标注完成状态
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
    // 简化查询：只查询必要字段，条件在前端过滤
    const { data, error } = await supabase
      .from('annotations')
      .select('video_id, annotator, human_annotated_text')
      .in('video_id', videoIds);

    if (error) {
      console.error('批量获取完成人数失败:', error);
      return {};
    }

    // 统计每个视频的已标注人数（去重）
    const videoAnnotatorMap = new Map<string, Set<string>>();
    
    data?.forEach(item => {
      // 前端过滤：有标注人、不是unknown、有人工标注文本
      const hasValidAnnotator = item.annotator && 
                                item.annotator.trim() !== '' && 
                                item.annotator !== 'unknown';
      const hasHumanText = item.human_annotated_text && 
                          item.human_annotated_text.trim() !== '';
      
      if (hasValidAnnotator && hasHumanText) {
        if (!videoAnnotatorMap.has(item.video_id)) {
          videoAnnotatorMap.set(item.video_id, new Set());
        }
        videoAnnotatorMap.get(item.video_id)!.add(item.annotator);
      }
    });

    // 转换为计数对象
    const countMap: Record<string, number> = {};
    videoIds.forEach(id => {
      countMap[id] = videoAnnotatorMap.has(id) ? videoAnnotatorMap.get(id)!.size : 0;
    });

    return countMap;
  } catch (error) {
    console.error('批量获取完成人数失败:', error);
    return {};
  }
}

// ========== 问题分类相关 ==========

// 获取所有问题分类
export async function getProblemCategories(): Promise<{ majorCategory: string; minorCategories: string[] }[]> {
  try {
    const { data, error } = await supabase
      .from('problem_categories')
      .select('*')
      .order('major_category', { ascending: true })
      .order('minor_category', { ascending: true });

    if (error) {
      console.error('获取问题分类失败:', error);
      return [];
    }

    // 按大类分组
    const grouped = new Map<string, string[]>();
    data?.forEach(item => {
      if (!grouped.has(item.major_category)) {
        grouped.set(item.major_category, []);
      }
      grouped.get(item.major_category)!.push(item.minor_category);
    });

    // 转换为数组格式
    return Array.from(grouped.entries()).map(([majorCategory, minorCategories]) => ({
      majorCategory,
      minorCategories
    }));
  } catch (error) {
    console.error('获取问题分类失败:', error);
    return [];
  }
}

// 添加新的问题分类
export async function addProblemCategory(majorCategory: string, minorCategory: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('problem_categories')
      .insert({
        major_category: majorCategory,
        minor_category: minorCategory
      });

    if (error) {
      // 如果是唯一键冲突，说明分类已存在
      if (error.code === '23505') {
        console.warn('分类已存在:', majorCategory, minorCategory);
        return true;
      }
      console.error('添加问题分类失败:', error);
      return false;
    }

    console.log('✅ 成功添加问题分类:', majorCategory, '-', minorCategory);
    return true;
  } catch (error) {
    console.error('添加问题分类失败:', error);
    return false;
  }
}

// 删除问题分类
export async function deleteProblemCategory(majorCategory: string, minorCategory: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('problem_categories')
      .delete()
      .eq('major_category', majorCategory)
      .eq('minor_category', minorCategory);

    if (error) {
      console.error('删除问题分类失败:', error);
      return false;
    }

    console.log('✅ 成功删除问题分类:', majorCategory, '-', minorCategory);
    return true;
  } catch (error) {
    console.error('删除问题分类失败:', error);
    return false;
  }
}

