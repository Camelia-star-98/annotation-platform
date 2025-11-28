import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Tabs
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UserOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { AnnotationItem } from '../types';
import { getVideos, getBatchCompletedAnnotatorsCount } from '../api/database';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface AnnotationTask {
  id: string;
  videoName: string;
  subject: string;
  duration: number;
  requiredAnnotators: number;
  completedAnnotators: number;
  uploadTime: string;
}

interface RejectedAnnotation {
  id: string;
  videoId: string;
  videoName: string;
  subject: string;
  originalText: string;
  annotatedText: string;
  majorCategory: string;
  minorCategory: string;
  inspector: string; // 质检人（谁打回的）
  annotator: string; // 标注人（自己）
  rejectedTime: string;
}

interface CompletedTask {
  id: string;
  annotator: string;
  videoId: string;
  videoName: string;
  subject: string;
  duration: number;
  annotationCount: number; // 标注的条数
  completedTime: string;
  totalSentences: number; // 视频总句子数
  annotatedSentences: number; // 已标注的句子数
  progressPercentage: number; // 完成进度百分比
  isCompleted: boolean; // 是否100%完成
  passedCount: number; // 质检通过数
  rejectedCount: number; // 质检不通过数
  pendingCount: number; // 待质检数
}

export default function AnnotationTaskListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const annotatorName = location.state?.annotatorName || '标注员';
  
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<AnnotationTask[]>([]);
  const [rejectedItems, setRejectedItems] = useState<RejectedAnnotation[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [activeTab, setActiveTab] = useState<string>('tasks');

  useEffect(() => {
    loadTasks();
    loadRejectedItems();
    loadCompletedTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      const videos = await getVideos();
      
      // 只显示已发布的视频
      const publishedVideos = videos.filter(video => video.is_published);
      
      console.log(`📊 已发布的视频数量: ${publishedVideos.length}`);
      
      // 如果没有已发布的视频，直接返回空列表
      if (publishedVideos.length === 0) {
        setTasks([]);
        message.info('暂无待标注任务');
        setLoading(false);
        return;
      }
      
      // 批量获取完成人数
      const videoIds = publishedVideos.map(v => v.id);
      const completedCountMap = await getBatchCompletedAnnotatorsCount(videoIds);
      
      // 1. 先查询每个视频的总句子数（包含所有记录，包括模板，按 video_id 和 sentence_no 去重）
      // 这样可以获取视频的真实总句子数
      // 使用分页查询避免1000条限制
      console.log('🔍 开始分页查询视频总句子数（loadTasks）...');
      let allVideoSentences: any[] = [];
      let sentencePage = 0;
      const sentencePageSize = 1000;
      let sentenceHasMore = true;
      
      while (sentenceHasMore) {
        const { data, error: totalError } = await supabase
          .from('annotations')
          .select('video_id, sentence_no')
          .in('video_id', videoIds)
          .range(sentencePage * sentencePageSize, (sentencePage + 1) * sentencePageSize - 1);
        
        if (totalError) {
          console.error('❌ 查询视频总句子数失败（第' + (sentencePage + 1) + '页）:', totalError);
          message.error('查询视频总句子数失败');
          setLoading(false);
          return;
        }
        
        if (data && data.length > 0) {
          allVideoSentences = allVideoSentences.concat(data);
          console.log(`📊 已获取第 ${sentencePage + 1} 页，本页 ${data.length} 条，累计 ${allVideoSentences.length} 条`);
        }
        
        sentenceHasMore = data && data.length === sentencePageSize;
        sentencePage++;
      }
      
      console.log('✅ 总句子数查询完成（loadTasks），总计获取:', allVideoSentences.length, '条数据');
      
      // 统计每个视频的总句子数（按 video_id 和 sentence_no 去重）
      const videoTotalSentences = new Map<string, Set<number>>();
      allVideoSentences?.forEach(item => {
        if (!videoTotalSentences.has(item.video_id)) {
          videoTotalSentences.set(item.video_id, new Set());
        }
        videoTotalSentences.get(item.video_id)!.add(item.sentence_no);
      });
      
      // 2. 查询所有标注员在这些视频中的标注情况（不限制标注人）
      // 使用分页查询避免1000条限制
      console.log('🔍 开始分页查询标注情况（videoIds:', videoIds.length, '个）...');
      let allAnnotations: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('annotations')
          .select('video_id, annotator, human_annotated_text, sentence_no')
          .in('video_id', videoIds)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('❌ 查询标注情况失败（第' + (page + 1) + '页）:', error);
          // 如果查询失败，显示所有已发布的视频（不过滤）
          const publishedTasks = publishedVideos.map(video => ({
            id: video.id,
            videoName: video.name || '未命名视频',
            subject: video.subject || '未知',
            duration: video.duration || 0,
            requiredAnnotators: video.required_annotators || 1,
            completedAnnotators: completedCountMap[video.id] || 0,
            uploadTime: video.created_at || ''
          }));
          setTasks(publishedTasks);
          message.warning(`加载了 ${publishedTasks.length} 个任务（无法过滤已完成任务）`);
          setLoading(false);
          return;
        }
        
        if (data && data.length > 0) {
          allAnnotations = allAnnotations.concat(data);
          console.log(`📊 已获取第 ${page + 1} 页，本页 ${data.length} 条，累计 ${allAnnotations.length} 条`);
        }
        
        hasMore = data && data.length === pageSize;
        page++;
      }
      
      console.log('✅ 分页查询完成，总计获取:', allAnnotations.length, '条标注数据');
      
      // 3. 统计每个视频每个标注员的标注情况（按 video_id + annotator + sentence_no 去重）
      // Map<videoId, Map<annotator, Set<sentence_no>>> - 记录每个标注员已标注的句子
      const videoAnnotatorSentences = new Map<string, Map<string, Set<number>>>();
      allAnnotations?.forEach(item => {
        if (!videoAnnotatorSentences.has(item.video_id)) {
          videoAnnotatorSentences.set(item.video_id, new Map());
        }
        const annotatorMap = videoAnnotatorSentences.get(item.video_id)!;
        if (!annotatorMap.has(item.annotator)) {
          annotatorMap.set(item.annotator, new Set());
        }
        const sentenceSet = annotatorMap.get(item.annotator)!;
        // 只有当 human_annotated_text 不为空时，才记录该句子已被标注
        if (item.human_annotated_text && item.human_annotated_text.trim() !== '') {
          sentenceSet.add(item.sentence_no);
        }
      });
      
      // 4. 判断是否有任何标注员完成了视频（已标注的句子数 = 视频的总句子数）
      const completedVideos = new Set<string>();
      
      // 遍历所有已发布的视频，检查是否有标注员完成
      publishedVideos.forEach(video => {
        const videoId = video.id;
        const totalSentences = videoTotalSentences.get(videoId)?.size || 0; // 视频的总句子数
        
        // 如果视频没有任何标注记录，跳过（显示在列表中）
        if (totalSentences === 0) {
          console.log(`⏭️  视频 ${video.name} (${videoId}) 没有任何标注记录，保留在列表中`);
          return;
        }
        
        const annotatorMap = videoAnnotatorSentences.get(videoId) || new Map();
        
        // 检查是否有任何标注员完成了该视频
        let foundCompleted = false;
        for (const [annotator, annotatedSentences] of annotatorMap.entries()) {
          const annotatedCount = annotatedSentences.size; // 该标注员已标注的不同句子数
          // 如果某个标注员已标注的句子数 = 视频的总句子数，则认为该视频已完成
          if (totalSentences > 0 && annotatedCount === totalSentences) {
            completedVideos.add(videoId);
            console.log(`✅ 视频 ${video.name} (${videoId}) 已被标注员 ${annotator} 完成 (${annotatedCount}/${totalSentences})`);
            foundCompleted = true;
            break; // 找到一个完成的标注员就够了
          } else {
            console.log(`  - 标注员 ${annotator}: ${annotatedCount}/${totalSentences} (未完成)`);
          }
        }
        
        if (!foundCompleted && annotatorMap.size === 0) {
          console.log(`  - 视频 ${video.name} (${videoId}): 无任何标注员有标注记录`);
        }
      });
      
      console.log(`📊 已完成的视频数量: ${completedVideos.size} / ${publishedVideos.length}`);
      
      // 打印调试信息
      console.log('📊 标注完成情况详情:');
      publishedVideos.forEach(video => {
        const videoId = video.id;
        const sentenceNos = videoTotalSentences.get(videoId);
        const totalSentences = sentenceNos?.size || 0;
        const annotatorMap = videoAnnotatorSentences.get(videoId) || new Map();
        const isCompleted = completedVideos.has(videoId);
        
        // 打印每个标注员的情况
        const annotatorInfo: string[] = [];
        annotatorMap.forEach((annotatedSentences, annotator) => {
          const annotatedCount = annotatedSentences.size;
          annotatorInfo.push(`${annotator}: ${annotatedCount}/${totalSentences}`);
        });
        const infoStr = annotatorInfo.length > 0 ? annotatorInfo.join(', ') : '无标注记录';
        console.log(`  - ${video.name}: ${infoStr} ${isCompleted ? '✅已完成' : '⏳未完成'}`);
      });
      
      // 只显示没有任何标注员完成、视频未达到标注人数要求、且未完成复检的视频，按创建时间降序排序（最新的在最上面）
      const publishedTasks = publishedVideos
        .filter(video => {
          const completedCount = completedCountMap[video.id] || 0;
          const requiredCount = video.required_annotators || 1;
          const hasAnyCompleted = completedVideos.has(video.id); // 是否有任何标注员完成了
          const isVideoFull = completedCount >= requiredCount;
          const isReviewCompleted = video.is_completed === true; // 是否已完成复检
          
          // 过滤条件：有任何标注员已完成 OR 视频已达到要求人数 OR 已完成复检
          const shouldFilter = hasAnyCompleted || isVideoFull || isReviewCompleted;
          
          if (shouldFilter) {
            console.log(`🚫 过滤视频: ${video.name} (有标注员已完成:${hasAnyCompleted}, 视频已满:${isVideoFull}, 复检完成:${isReviewCompleted}, ${completedCount}/${requiredCount})`);
          }
          
          return !shouldFilter;
        })
        .sort((a, b) => {
          // 按创建时间降序排序（最新的在最上面）
          const timeA = a.created_at || '';
          const timeB = b.created_at || '';
          return timeB.localeCompare(timeA);
        })
        .map(video => ({
          id: video.id,
          videoName: video.name || '未命名视频',
          subject: video.subject || '未知',
          duration: video.duration || 0,
          requiredAnnotators: video.required_annotators || 1,
          completedAnnotators: completedCountMap[video.id] || 0, // 使用实际完成人数
          uploadTime: video.created_at || ''
        }));
      
      setTasks(publishedTasks);
      message.success(`加载了 ${publishedTasks.length} 个待标注任务`);
    } catch (error) {
      console.error('加载任务列表失败:', error);
      message.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRejectedItems = async () => {
    try {
      const { supabase } = await import('../api/supabase');
      const allVideos = await getVideos();
      
      console.log('🔍 调试信息 - 当前标注人:', annotatorName);
      
      // 先查询所有当前标注人的数据，看看实际情况（使用分页查询）
      console.log('🔍 开始分页查询当前标注人的所有数据（调试用）...');
      let allMyAnnotations: any[] = [];
      let debugPage = 0;
      const debugPageSize = 1000;
      let debugHasMore = true;
      
      while (debugHasMore) {
        const { data, error: debugError } = await supabase
          .from('annotations')
          .select('id, video_id, annotator, is_qualified, inspector')
          .eq('annotator', annotatorName)
          .range(debugPage * debugPageSize, (debugPage + 1) * debugPageSize - 1);
        
        if (debugError) {
          console.error('❌ 查询调试数据失败（第' + (debugPage + 1) + '页）:', debugError);
          break;
        }
        
        if (data && data.length > 0) {
          allMyAnnotations = allMyAnnotations.concat(data);
          console.log(`📊 已获取第 ${debugPage + 1} 页，本页 ${data.length} 条，累计 ${allMyAnnotations.length} 条`);
        }
        
        debugHasMore = data && data.length === debugPageSize;
        debugPage++;
      }
      
      console.log('✅ 调试数据查询完成，总计获取:', allMyAnnotations.length, '条数据');
      
      console.log('📊 当前标注人的所有数据数量:', allMyAnnotations?.length || 0);
      if (allMyAnnotations && allMyAnnotations.length > 0) {
        const withInspector = allMyAnnotations.filter(a => a.inspector);
        const withFalseQualified = allMyAnnotations.filter(a => a.is_qualified === false);
        const withNullQualified = allMyAnnotations.filter(a => a.is_qualified === null);
        const withTrueQualified = allMyAnnotations.filter(a => a.is_qualified === true);
        console.log('  - 有质检人的数据:', withInspector.length);
        console.log('  - is_qualified = false 的数据:', withFalseQualified.length);
        console.log('  - is_qualified = null 的数据:', withNullQualified.length);
        console.log('  - is_qualified = true 的数据:', withTrueQualified.length);
        console.log('  - 前5条数据样例:', allMyAnnotations.slice(0, 5).map(a => ({
          id: a.id,
          inspector: a.inspector,
          is_qualified: a.is_qualified
        })));
      }
      
      // 性能优化：直接在数据库查询当前标注人的被打回数据
      // 查询条件：当前标注人 + 有质检人 + 质检不通过
      let { data: allAnnotations, error } = await supabase
        .from('annotations')
        .select('id, video_id, original_text, human_annotated_text, major_category, minor_category, inspector, annotator, is_qualified, updated_at, created_at')
        .eq('annotator', annotatorName)
        .not('inspector', 'is', null)
        .neq('inspector', '')
        .eq('is_qualified', false);
      
      if (error) {
        console.error('查询被打回数据失败:', error);
        message.error('加载失败');
        return;
      }
      
      console.log('📊 被打回数据数量（is_qualified=false）:', allAnnotations?.length || 0);
      
      // 如果查询结果为空，尝试查询 is_qualified 为 null 但有质检人的数据（可能是旧数据）
      if (!allAnnotations || allAnnotations.length === 0) {
        console.log('⚠️ 未找到 is_qualified=false 的数据，尝试查询 is_qualified=null 但有质检人的数据...');
        const { data: nullQualifiedData, error: nullError } = await supabase
          .from('annotations')
          .select('id, video_id, original_text, human_annotated_text, major_category, minor_category, inspector, annotator, is_qualified, updated_at, created_at')
          .eq('annotator', annotatorName)
          .not('inspector', 'is', null)
          .neq('inspector', '')
          .is('is_qualified', null);
        
        if (!nullError && nullQualifiedData && nullQualifiedData.length > 0) {
          console.log('📊 找到 is_qualified=null 但有质检人的数据:', nullQualifiedData.length);
          // 使用这些数据作为被打回的数据
          allAnnotations = nullQualifiedData;
        }
      }
      
      // 创建视频ID到视频信息的映射
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      
      // 转换数据格式，按打回时间降序排序（最新的在最上面）
      const rejected = (allAnnotations || [])
        .map(item => {
          const video = videoMap.get(item.video_id);
          return {
            id: item.id,
            videoId: item.video_id,
            videoName: video?.name || '未知视频',
            subject: video?.subject || '未知',
            originalText: item.original_text || '',
            annotatedText: item.human_annotated_text || '', // 修正字段名
            majorCategory: item.major_category || '',
            minorCategory: item.minor_category || '',
            inspector: item.inspector || '未知',
            annotator: item.annotator || '',
            rejectedTime: item.updated_at || item.created_at || ''
          };
        })
        .sort((a, b) => {
          // 按打回时间降序排序（最新的在最上面）
          return b.rejectedTime.localeCompare(a.rejectedTime);
        });
      
      setRejectedItems(rejected);
      console.log(`✅ 加载了 ${rejected.length} 条被打回的数据`);
    } catch (error) {
      console.error('加载被打回数据失败:', error);
      message.error('加载被打回数据失败');
    }
  };

  const loadCompletedTasks = async () => {
    try {
      const { supabase } = await import('../api/supabase');
      const allVideos = await getVideos();
      
      console.log('🔍 加载所有已标注任务（全体标注员）');
      
      // 查询所有标注员的标注数据（包括已提交和未提交的）
      // 使用分页查询避免1000条限制
      console.log('🔍 开始分页查询所有标注数据...');
      let allAnnotations: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error, count } = await supabase
          .from('annotations')
          .select('video_id, sentence_no, human_annotated_text, updated_at, status, inspector, is_qualified, annotator', { count: 'exact' })
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('❌ 查询标注数据失败（第' + (page + 1) + '页）:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allAnnotations = allAnnotations.concat(data);
          console.log(`📊 已获取第 ${page + 1} 页，本页 ${data.length} 条，累计 ${allAnnotations.length} 条`);
          if (count !== null) {
            console.log(`   总计约 ${count} 条数据`);
          }
        }
        
        hasMore = data && data.length === pageSize;
        page++;
      }
      
      console.log('✅ 分页查询完成，总计获取:', allAnnotations.length, '条标注数据');
      if (allAnnotations.length > 0) {
        console.log('🔍 第一条数据示例:', allAnnotations[0]);
      }
      
      console.log('📊 所有标注数据总数:', allAnnotations?.length || 0);
      
      // 统计每个视频的标注数据
      const videoAnnotationCount = new Map<string, number>();
      allAnnotations?.forEach(a => {
        const count = videoAnnotationCount.get(a.video_id) || 0;
        videoAnnotationCount.set(a.video_id, count + 1);
      });
      console.log('📊 有标注数据的视频数:', videoAnnotationCount.size);
      console.log('📊 前10个视频的标注数据量:');
      Array.from(videoAnnotationCount.entries()).slice(0, 10).forEach(([videoId, count]) => {
        const video = allVideos.find(v => v.id === videoId);
        console.log(`  - ${video?.name || videoId}: ${count} 条数据`);
      });
      
      // 过滤出真正有标注内容的数据
      const validAnnotations = allAnnotations?.filter(a => 
        a.human_annotated_text && a.human_annotated_text.trim() !== ''
      ) || [];
      
      console.log('📊 有效标注数据（human_annotated_text不为空）:', validAnnotations.length);
      console.log('  - 已提交质检:', validAnnotations.filter(a => a.status === true).length);
      console.log('  - 未提交质检:', validAnnotations.filter(a => !a.status).length);
      console.log('  - 待质检:', validAnnotations.filter(a => a.status && (!a.inspector || a.inspector === '')).length);
      console.log('  - 已质检:', validAnnotations.filter(a => a.inspector && a.inspector !== '').length);
      
      // 统计每个视频每位标注员的标注情况
      // Map<videoId__annotator, { videoId: string, annotator: string, sentenceSet: Set<number>, maxUpdateTime: string, annotationCount: number, passedCount: number, rejectedCount: number, pendingCount: number }>
      const videoStatsMap = new Map<string, { 
        videoId: string;
        annotator: string;
        sentenceSet: Set<number>, 
        maxUpdateTime: string, 
        annotationCount: number,
        passedCount: number,
        rejectedCount: number,
        pendingCount: number
      }>();
      
      validAnnotations.forEach(item => {
        const annotator = item.annotator || '未知标注员';
        const key = `${item.video_id}__${annotator}`;
        
        if (!videoStatsMap.has(key)) {
          videoStatsMap.set(key, {
            videoId: item.video_id,
            annotator,
            sentenceSet: new Set(),
            maxUpdateTime: item.updated_at || '',
            annotationCount: 0,
            passedCount: 0,
            rejectedCount: 0,
            pendingCount: 0
          });
        }
        const stats = videoStatsMap.get(key)!;
        
        // 记录该句子已被标注
        stats.sentenceSet.add(item.sentence_no);
        stats.annotationCount++;
        
        // 统计质检状态（只统计已提交质检的数据）
        if (item.status === true) {
          // 只有已提交质检的数据才统计质检状态
          if (!item.inspector || item.inspector === '') {
            // 待质检
            stats.pendingCount++;
          } else if (item.is_qualified === true) {
            // 质检通过
            stats.passedCount++;
          } else if (item.is_qualified === false) {
            // 质检不通过
            stats.rejectedCount++;
          }
        }
        
        // 更新最新的标注时间
        if (item.updated_at && item.updated_at > stats.maxUpdateTime) {
          stats.maxUpdateTime = item.updated_at;
        }
      });
      
      // 查询每个视频的总句子数
      const videoIds = Array.from(new Set(Array.from(videoStatsMap.values()).map(v => v.videoId)));
      if (videoIds.length === 0) {
        setCompletedTasks([]);
        console.log('✅ 暂无任何标注员的标注数据');
        return;
      }
      
      // 使用分页查询避免1000条限制
      console.log('🔍 开始分页查询视频总句子数（videoIds:', videoIds.length, '个）...');
      let allVideoSentences: any[] = [];
      page = 0; // 重置页码
      hasMore = true;
      
      while (hasMore) {
        const { data, error: totalError } = await supabase
          .from('annotations')
          .select('video_id, sentence_no')
          .in('video_id', videoIds)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (totalError) {
          console.error('❌ 查询视频总句子数失败（第' + (page + 1) + '页）:', totalError);
          message.error('查询视频总句子数失败');
          return;
        }
        
        if (data && data.length > 0) {
          allVideoSentences = allVideoSentences.concat(data);
          console.log(`📊 已获取第 ${page + 1} 页，本页 ${data.length} 条，累计 ${allVideoSentences.length} 条`);
        }
        
        hasMore = data && data.length === pageSize;
        page++;
      }
      
      console.log('✅ 总句子数查询完成，总计获取:', allVideoSentences.length, '条数据');
      
      // 统计每个视频的总句子数（按 video_id 和 sentence_no 去重）
      const videoTotalSentences = new Map<string, Set<number>>();
      allVideoSentences?.forEach(item => {
        if (!videoTotalSentences.has(item.video_id)) {
          videoTotalSentences.set(item.video_id, new Set());
        }
        videoTotalSentences.get(item.video_id)!.add(item.sentence_no);
      });
      
      // 创建视频ID到视频信息的映射
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      
      // 找出所有有标注数据的视频（包括部分完成和已完成）
      const completed: CompletedTask[] = [];
      
      console.log(`🔍 videoStatsMap 大小: ${videoStatsMap.size}`);
      console.log(`🔍 videoTotalSentences 大小: ${videoTotalSentences.size}`);
      console.log(`🔍 videoMap 大小: ${videoMap.size}`);
      
      videoStatsMap.forEach(stats => {
        const { videoId, annotator } = stats;
        const totalSentences = videoTotalSentences.get(videoId)?.size || 0;
        const annotatedSentences = stats.sentenceSet.size;
        
        console.log(`🔍 处理视频: ${videoId}, 标注人: ${annotator}, 总句子: ${totalSentences}, 已标注: ${annotatedSentences}`);
        
        // 只要有标注数据就显示
        if (totalSentences > 0 && annotatedSentences > 0) {
          const video = videoMap.get(videoId);
          console.log(`🔍 视频信息: ${video ? `找到: ${video.name}` : '未找到'}`);
          
          if (video) {
            const progressPercentage = Math.round((annotatedSentences / totalSentences) * 100);
            const isCompleted = annotatedSentences === totalSentences;
            
            completed.push({
              id: `${videoId}_${annotator}`, // 使用组合ID避免重复
              annotator,
              videoId: videoId,
              videoName: video.name || '未命名视频',
              subject: video.subject || '未知',
              duration: video.duration || 0,
              annotationCount: stats.annotationCount,
              completedTime: stats.maxUpdateTime,
              totalSentences,
              annotatedSentences,
              progressPercentage,
              isCompleted,
              passedCount: stats.passedCount,
              rejectedCount: stats.rejectedCount,
              pendingCount: stats.pendingCount
            });
            
            if (isCompleted) {
              console.log(`✅ 已完成视频: ${video.name} - ${annotator} (${annotatedSentences}/${totalSentences} 句, 100%)`);
            } else {
              console.log(`⏳ 进行中视频: ${video.name} - ${annotator} (${annotatedSentences}/${totalSentences} 句, ${progressPercentage}%)`);
            }
          } else {
            console.warn(`⚠️ 未找到视频信息: ${videoId}`);
          }
        } else {
          console.log(`⏭️  跳过视频 ${videoId} - ${annotator}: totalSentences=${totalSentences}, annotatedSentences=${annotatedSentences}`);
        }
      });
      
      // 按完成时间降序排序（最新的在最上面）
      completed.sort((a, b) => b.completedTime.localeCompare(a.completedTime));
      
      console.log(`📊 最终生成的任务列表数量: ${completed.length}`);
      completed.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.videoName} - ${task.annotator} (${task.progressPercentage}%)`);
      });
      
      setCompletedTasks(completed);
      
      const fullyCompleted = completed.filter(t => t.isCompleted).length;
      const inProgress = completed.filter(t => !t.isCompleted).length;
      console.log(`✅ 加载了 ${completed.length} 个标注任务（已完成: ${fullyCompleted}，进行中: ${inProgress}）`);
    } catch (error) {
      console.error('加载已标注任务失败:', error);
      message.error('加载已标注任务失败');
    }
  };

  const handleStartAnnotation = (task: AnnotationTask) => {
    // 跳转到标注页面，并传递视频ID和标注员姓名
    navigate('/annotation', {
      state: {
        videoId: task.id,
        videoName: task.videoName,
        annotatorName: annotatorName
      }
    });
  };

  const handleReannotate = (item: RejectedAnnotation) => {
    // 跳转到标注页面，并传递视频ID、标注员姓名，以及标记这是重新标注
    navigate('/annotation', {
      state: {
        videoId: item.videoId,
        videoName: item.videoName,
        annotatorName: annotatorName,
        isReannotation: true, // 标记这是重新标注
        focusItemId: item.id // 可以聚焦到具体的标注项
      }
    });
  };

  const columns = [
    {
      title: '视频名称',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 300
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (seconds: number) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 120,
      render: (text: string) => (
        <Tag color="purple">{text || '未知标注员'}</Tag>
      )
    },
    {
      title: '标注进度',
      key: 'progress',
      width: 150,
      render: (_: any, record: AnnotationTask) => (
        <Space>
          <Text>
            {record.completedAnnotators} / {record.requiredAnnotators}
          </Text>
          {record.completedAnnotators >= record.requiredAnnotators ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <Tag color="warning">进行中</Tag>
          )}
        </Space>
      )
    },
    {
      title: '发布时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: AnnotationTask) => (
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => handleStartAnnotation(record)}
        >
          开始标注
        </Button>
      )
    }
  ];

  const rejectedColumns = [
    {
      title: '视频名称',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 200
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 80,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '原文',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 200,
      ellipsis: true
    },
    {
      title: '标注内容',
      dataIndex: 'annotatedText',
      key: 'annotatedText',
      width: 200,
      ellipsis: true
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 120,
      render: (text: string) => {
        if (!text) return '-';
        return text.split(',').map((cat, idx) => (
          <Tag key={idx} color="orange">{cat}</Tag>
        ));
      }
    },
    {
      title: '问题小类',
      dataIndex: 'minorCategory',
      key: 'minorCategory',
      width: 120,
      render: (text: string) => {
        if (!text) return '-';
        return text.split(',').map((cat, idx) => (
          <Tag key={idx} color="gold">{cat}</Tag>
        ));
      }
    },
    {
      title: '质检人',
      dataIndex: 'inspector',
      key: 'inspector',
      width: 100,
      render: (text: string) => (
        <Tag icon={<UserOutlined />} color="red">
          {text}
        </Tag>
      )
    },
    {
      title: '质检状态',
      dataIndex: 'isQualified',
      key: 'isQualified',
      width: 100,
      align: 'center' as const,
      render: (isQualified: boolean) => (
        <Tag color="red" icon={<CloseOutlined />}>
          未通过
        </Tag>
      )
    },
    {
      title: '打回时间',
      dataIndex: 'rejectedTime',
      key: 'rejectedTime',
      width: 150,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: RejectedAnnotation) => (
        <Button
          type="primary"
          danger
          icon={<WarningOutlined />}
          onClick={() => handleReannotate(record)}
        >
          重新标注
        </Button>
      )
    }
  ];

  const completedColumns = [
    {
      title: '视频名称',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 300
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '标注进度',
      key: 'progress',
      width: 200,
      render: (_: any, record: CompletedTask) => {
        const { annotatedSentences, totalSentences, progressPercentage, isCompleted } = record;
        return (
          <div>
            <div style={{ marginBottom: '4px', fontSize: '12px', color: '#666' }}>
              {annotatedSentences} / {totalSentences} 句
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                flex: 1, 
                height: '8px', 
                background: '#f0f0f0', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progressPercentage}%`,
                  height: '100%',
                  background: isCompleted ? '#52c41a' : '#1890ff',
                  transition: 'width 0.3s'
                }} />
              </div>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 'bold',
                color: isCompleted ? '#52c41a' : '#1890ff'
              }}>
                {progressPercentage}%
              </span>
            </div>
          </div>
        );
      }
    },
    {
      title: '标注条数',
      dataIndex: 'annotationCount',
      key: 'annotationCount',
      width: 120,
      render: (count: number) => (
        <Tag color="green">{count} 条</Tag>
      )
    },
    {
      title: '质检状态',
      key: 'inspectionStatus',
      width: 200,
      render: (_: any, record: CompletedTask) => {
        const { passedCount, rejectedCount, pendingCount } = record;
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {pendingCount > 0 && (
              <Tag color="default" style={{ margin: 0 }}>
                待质检 {pendingCount}
              </Tag>
            )}
            {passedCount > 0 && (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>
                通过 {passedCount}
              </Tag>
            )}
            {rejectedCount > 0 && (
              <Tag color="error" icon={<CloseCircleOutlined />} style={{ margin: 0 }}>
                不通过 {rejectedCount}
              </Tag>
            )}
          </div>
        );
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: CompletedTask) => (
        record.isCompleted ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
        ) : (
          <Tag color="processing">进行中</Tag>
        )
      )
    },
    {
      title: '最后更新',
      dataIndex: 'completedTime',
      key: 'completedTime',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: CompletedTask) => (
        <Button
          type="default"
          icon={<CheckCircleOutlined />}
          onClick={() => handleViewCompleted(record)}
        >
          查看详情
        </Button>
      )
    }
  ];

  const handleViewCompleted = (task: CompletedTask) => {
    // 跳转到标注页面查看已完成的标注
    navigate('/annotation', {
      state: {
        videoId: task.videoId,
        videoName: task.videoName,
        annotatorName: annotatorName,
        viewOnly: true // 标记为查看模式
      }
    });
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            标注任务列表
          </Title>
        </Space>
        <Space>
          <Text strong>标注员：{annotatorName}</Text>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: 'tasks',
                label: (
                  <Space>
                    <PlayCircleOutlined />
                    <span>待标注任务</span>
                    <Tag color="blue">{tasks.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table
                    columns={columns}
                    dataSource={tasks}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 个任务`
                    }}
                    scroll={{ x: 1000 }}
                  />
                )
              },
              {
                key: 'completed',
                label: (
                  <Space>
                    <CheckCircleOutlined />
                    <span>所有已标注任务</span>
                    <Tag color="green">{completedTasks.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table
                    columns={completedColumns}
                    dataSource={completedTasks}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => {
                        const completed = completedTasks.filter(t => t.isCompleted).length;
                        const inProgress = completedTasks.filter(t => !t.isCompleted).length;
                        return `共 ${total} 个任务（已完成 ${completed} 个，进行中 ${inProgress} 个）`;
                      }
                    }}
                    scroll={{ x: 1200 }}
                  />
                )
              },
              {
                key: 'rejected',
                label: (
                  <Space>
                    <WarningOutlined />
                    <span>被打回重标</span>
                    <Tag color="red">{rejectedItems.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table
                    columns={rejectedColumns}
                    dataSource={rejectedItems}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条待重标数据`
                    }}
                    scroll={{ x: 1400 }}
                  />
                )
              }
            ]}
          />
        </Card>
      </Content>
    </Layout>
  );
}

