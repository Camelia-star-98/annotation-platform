import { supabase } from './supabase';
import type { AnnotationItem, VideoInfo } from '../types';

// ========== 工具函数 ==========

// 超时包装器：为 Promise 添加超时控制
function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 30000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
    )
  ]);
}

// 重试包装器：为 Promise 添加重试机制
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNetworkError = error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('网络') ||
        error.message.includes('timeout') ||
        error.message.includes('超时')
      );
      
      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`⚠️ 请求失败 (尝试 ${attempt}/${maxRetries})，${delayMs}ms 后重试...`, error);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt)); // 指数退避
    }
  }
  
  throw lastError;
}

// ========== 视频相关 ==========

// 获取所有视频（优化：只查询必要字段，移除日志）
export async function getVideos(): Promise<VideoInfo[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, name, url, subject, duration, required_annotators, total_sentences, annotation_file_name, created_at, is_published, is_completed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取视频列表失败:', error);
    return [];
  }

  return data || [];
}

// 获取单个视频（优化：避免查询所有视频，添加超时控制）
export async function getVideo(videoId: string): Promise<VideoInfo | null> {
  try {
    const query = supabase
      .from('videos')
      .select('id, name, url, subject, duration, required_annotators, total_sentences, created_at, is_published, is_completed')
      .eq('id', videoId)
      .single();
    
    const { data, error } = await withTimeout(query, 10000); // 10秒超时

    if (error) {
      console.error('获取视频失败:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('获取视频超时或失败:', error);
    return null;
  }
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
  console.log('  - annotation_file_name:', video.annotation_file_name);
  
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
    required_annotators: video.required_annotators || 1, // 添加待标注数量字段
    total_sentences: video.total_sentences || 0, // 添加视频总句数字段
    annotation_file_name: video.annotation_file_name || '' // 添加标注数据文件名
    // is_published 默认为 false（数据库默认值），需要手动发布
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
      subject: item.subject || '',
      rejectionCount: item.rejection_count || 0 // 添加被打回次数
    }));
  } catch (error) {
    console.error('获取所有标注数据异常:', error);
    return [];
  }
}

// 获取已复检的标注数据（用于数据分析）
export async function getReviewedAnnotations(videoIds?: string[]): Promise<AnnotationItem[]> {
  try {
    // 分页获取所有数据，避免 Supabase 默认 1000 条限制
    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    console.log('📊 开始分页查询已复检数据...');

    while (hasMore) {
      let query = supabase
        .from('annotations')
        .select('*')
        .eq('review_status', true) // 只查询已复检的数据
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // 如果指定了视频ID，则只查询这些视频的数据
      if (videoIds && videoIds.length > 0) {
        query = query.in('video_id', videoIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('获取已复检标注数据失败:', error);
        return allData.length > 0 ? allData : [];
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += data.length;
        hasMore = data.length === limit;
        console.log(`  - 已加载 ${allData.length} 条数据...`);
      } else {
        hasMore = false;
      }
    }

    console.log('📊 getReviewedAnnotations 返回数据总量:', allData.length);

    // 转换数据格式（保留 created_at 字段用于排序）
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
      reviewer: item.reviewer || '',
      reviewStatus: item.review_status,
      videoName: item.video_name || '',
      videoUrl: item.video_url || '',
      subject: item.subject || '',
      created_at: item.created_at || '' // 保留创建时间字段
    }));
  } catch (error) {
    console.error('获取已复检标注数据异常:', error);
    return [];
  }
}

// 获取指定视频的标注数据（添加超时控制、重试机制和错误处理）
export async function getAnnotations(videoId: string): Promise<AnnotationItem[]> {
  try {
    return await withRetry(async () => {
  // 优化：只查询必要字段，关联视频表获取视频信息
      const query = supabase
    .from('annotations')
    .select('id, video_id, sentence_no, time_range, start_time, end_time, original_text, ai_rewritten_text, human_annotated_text, major_category, minor_category, remark, status, annotator, is_qualified, inspector, reviewer, review_status, videos!inner(url, name, subject)')
    .eq('video_id', videoId)
    .order('sentence_no', { ascending: true });

      const { data, error } = await withTimeout(query, 15000); // 15秒超时

  if (error) {
    console.error('获取标注数据失败:', error);
        throw error; // 抛出错误以便重试机制处理
  }

  // 转换数据格式
  return (data || []).map(item => {
    const video = Array.isArray(item.videos) ? item.videos[0] : item.videos;
    return {
      id: item.id,
      videoId: item.video_id,
      sentenceNo: item.sentence_no,
      timeRange: item.time_range,
      startTime: item.start_time,
      endTime: item.end_time,
      originalText: item.original_text,
      aiRewrittenText: item.ai_rewritten_text || '', // 修复：查询并返回大模型改写文本
      humanAnnotatedText: item.human_annotated_text,
      majorCategory: item.major_category,
      minorCategory: item.minor_category,
      remark: item.remark,
      status: item.status,
      annotator: item.annotator,
      isQualified: item.is_qualified,
      inspector: item.inspector,
      reviewer: item.reviewer || '', // 添加复检人
      reviewStatus: item.review_status, // 添加复检状态
      videoUrl: video?.url || '',
      videoName: video?.name || '',
      subject: video?.subject || ''
    };
  });
    }, 3, 1000); // 最多重试3次，每次间隔1秒
  } catch (error) {
    console.error('获取标注数据超时或失败（已重试）:', error);
    return [];
  }
}

// 获取指定视频的待质检数据（优化：在数据库层面直接过滤，支持分页，添加超时控制）
export async function getPendingInspectionAnnotations(
  videoId: string, 
  options?: { limit?: number; offset?: number }
): Promise<{ data: AnnotationItem[]; total: number }> {
  try {
    // 构建查询 - 只质检已标注的句子
    let query = supabase
      .from('annotations')
      .select('id, video_id, sentence_no, time_range, start_time, end_time, original_text, ai_rewritten_text, human_annotated_text, major_category, minor_category, remark, status, annotator, is_qualified, inspector, reviewer, review_status', { count: 'exact' })
      .eq('video_id', videoId)
      // ✅ 只查询已完成标注的数据（status = true）
      .eq('status', true)
      // ✅ 只查询已标注的数据（有人工标注内容的）
      .not('human_annotated_text', 'is', null)
      .neq('human_annotated_text', '')
      // ✅ 只查询有标注人的数据（排除未标注的数据）
      .not('annotator', 'is', null)
      .neq('annotator', '')
      .order('sentence_no', { ascending: true });

    // 应用分页
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 1000) - 1);
    }

    const { data, error, count } = await withTimeout(query, 15000); // 15秒超时

    if (error) {
      console.error('获取待质检数据失败:', error);
      return { data: [], total: 0 };
    }

    // 转换数据格式
    const annotations = (data || []).map(item => ({
      id: item.id,
      videoId: item.video_id,
      sentenceNo: item.sentence_no,
      timeRange: item.time_range,
      startTime: item.start_time,
      endTime: item.end_time,
      originalText: item.original_text,
      aiRewrittenText: item.ai_rewritten_text || '', // 修复：查询并返回大模型改写文本
      humanAnnotatedText: item.human_annotated_text,
      majorCategory: item.major_category,
      minorCategory: item.minor_category,
      remark: item.remark,
      status: item.status,
      annotator: item.annotator,
      isQualified: item.is_qualified,
      inspector: item.inspector,
      reviewer: item.reviewer || '',
      reviewStatus: item.review_status,
      // 添加缺少的字段
      videoUrl: '',
      videoName: '',
      subject: ''
    }));

    return { data: annotations, total: count || 0 };
  } catch (error) {
    console.error('获取待质检数据超时或失败:', error);
    return { data: [], total: 0 };
  }
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
      review_status: item.reviewStatus ?? null,
      // 被打回次数（保留原有值，如果重新提交则不清除）
      rejection_count: item.rejectionCount ?? undefined
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
      let batch = data.slice(start, end);
      
      console.log(`📤 正在保存第 ${i + 1}/${totalBatches} 批 (${batch.length} 条)...`);
      
      // 使用upsert（如果存在则更新，不存在则插入）
      let { error } = await supabase
        .from('annotations')
        .upsert(batch, { onConflict: 'id' });

      // 如果失败且错误信息包含 'rejection_count'，说明字段不存在，移除该字段后重试
      if (error && error.message?.includes('rejection_count')) {
        console.log('⚠️ rejection_count 字段不存在，移除该字段后重试...');
        // 移除 rejection_count 字段
        batch = batch.map(({ rejection_count, ...rest }) => rest);
        const { error: retryError } = await supabase
          .from('annotations')
          .upsert(batch, { onConflict: 'id' });
        
        if (retryError) {
          console.error(`❌ 第 ${i + 1} 批保存失败（重试后）:`, retryError);
          throw new Error(`保存第 ${i + 1} 批数据失败: ${retryError.message}`);
        }
      } else if (error) {
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
      // 确保 inspector 字段被正确更新，即使是空字符串也要更新
      updateData.inspector = updates.inspector || null;
      console.log('📝 更新 inspector 字段:', {
        id,
        inspector: updates.inspector,
        willUpdateTo: updateData.inspector
      });
    }
    if (updates.rejectionCount !== undefined) {
      updateData.rejection_count = updates.rejectionCount;
    }

    let { error } = await supabase
      .from('annotations')
      .update(updateData)
      .eq('id', id);

    // 如果失败且错误信息包含 'rejection_count'，说明字段不存在，移除该字段后重试
    if (error && error.message?.includes('rejection_count')) {
      console.log('⚠️ rejection_count 字段不存在，移除该字段后重试...');
      const { rejection_count, ...updateDataWithoutRejectionCount } = updateData;
      const { error: retryError } = await supabase
        .from('annotations')
        .update(updateDataWithoutRejectionCount)
        .eq('id', id);
      
      if (retryError) {
        console.error('更新标注失败（重试后）:', retryError);
        return false;
      }
    } else if (error) {
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
      .select('video_id, annotator, status')
      .in('video_id', videoIds);

    if (error) {
      console.error('批量获取完成人数失败:', error);
      return {};
    }

    // 统计每个视频的已标注人数（去重）
    const videoAnnotatorMap = new Map<string, Set<string>>();
    
    data?.forEach(item => {
      // 前端过滤：有标注人、不是unknown、标注状态为已完成
      const hasValidAnnotator = item.annotator && 
                                item.annotator.trim() !== '' && 
                                item.annotator !== 'unknown';
      const isCompleted = item.status === true;
      
      if (hasValidAnnotator && isCompleted) {
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

// 获取所有问题分类（添加超时控制、重试机制和错误处理）
export async function getProblemCategories(): Promise<{ majorCategory: string; minorCategories: string[] }[]> {
  try {
    return await withRetry(async () => {
      const query = supabase
      .from('problem_categories')
      .select('*')
      .order('major_category', { ascending: true })
      .order('minor_category', { ascending: true });

      const { data, error } = await withTimeout(query, 10000); // 10秒超时

    if (error) {
        console.error('获取问题分类失败:', { message: error.message, details: error });
        throw error; // 抛出错误以便重试机制处理
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
    }, 3, 1000); // 最多重试3次，每次间隔1秒
  } catch (error) {
    console.error('获取问题分类失败（已重试）:', error instanceof Error ? { message: error.message, details: error } : error);
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

