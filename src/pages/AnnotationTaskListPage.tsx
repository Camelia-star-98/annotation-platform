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
  videoId: string;
  videoName: string;
  subject: string;
  duration: number;
  annotationCount: number; // 标注的条数
  completedTime: string;
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
      const { data: allVideoSentences, error: totalError } = await supabase
        .from('annotations')
        .select('video_id, sentence_no')
        .in('video_id', videoIds);
      
      if (totalError) {
        console.error('查询视频总句子数失败:', totalError);
        message.error('查询视频总句子数失败');
        setLoading(false);
        return;
      }
      
      // 统计每个视频的总句子数（按 video_id 和 sentence_no 去重）
      const videoTotalSentences = new Map<string, Set<number>>();
      allVideoSentences?.forEach(item => {
        if (!videoTotalSentences.has(item.video_id)) {
          videoTotalSentences.set(item.video_id, new Set());
        }
        videoTotalSentences.get(item.video_id)!.add(item.sentence_no);
      });
      
      // 2. 查询所有标注员在这些视频中的标注情况（不限制标注人）
      const { data: allAnnotations, error } = await supabase
        .from('annotations')
        .select('video_id, annotator, human_annotated_text, sentence_no')
        .in('video_id', videoIds);
      
      if (error) {
        console.error('查询标注情况失败:', error);
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
      
      // 先查询所有当前标注人的数据，看看实际情况
      const { data: allMyAnnotations, error: debugError } = await supabase
        .from('annotations')
        .select('id, video_id, annotator, is_qualified, inspector')
        .eq('annotator', annotatorName)
        .limit(100);
      
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
      
      console.log('🔍 加载已标注任务 - 当前标注人:', annotatorName);
      
      // 查询当前标注人的所有标注数据
      const { data: myAnnotations, error } = await supabase
        .from('annotations')
        .select('video_id, sentence_no, human_annotated_text, updated_at')
        .eq('annotator', annotatorName);
      
      if (error) {
        console.error('查询已标注数据失败:', error);
        message.error('加载已标注任务失败');
        return;
      }
      
      console.log('📊 当前标注人的标注数据总数:', myAnnotations?.length || 0);
      
      // 统计每个视频的标注情况
      // Map<videoId, { sentenceSet: Set<number>, maxUpdateTime: string, annotationCount: number }>
      const videoStatsMap = new Map<string, { sentenceSet: Set<number>, maxUpdateTime: string, annotationCount: number }>();
      
      myAnnotations?.forEach(item => {
        if (!videoStatsMap.has(item.video_id)) {
          videoStatsMap.set(item.video_id, {
            sentenceSet: new Set(),
            maxUpdateTime: item.updated_at || '',
            annotationCount: 0
          });
        }
        const stats = videoStatsMap.get(item.video_id)!;
        
        // 只有当 human_annotated_text 不为空时，才记录该句子已被标注
        if (item.human_annotated_text && item.human_annotated_text.trim() !== '') {
          stats.sentenceSet.add(item.sentence_no);
          stats.annotationCount++;
          // 更新最新的标注时间
          if (item.updated_at && item.updated_at > stats.maxUpdateTime) {
            stats.maxUpdateTime = item.updated_at;
          }
        }
      });
      
      // 查询每个视频的总句子数
      const videoIds = Array.from(videoStatsMap.keys());
      if (videoIds.length === 0) {
        setCompletedTasks([]);
        console.log('✅ 当前标注人没有标注过任何视频');
        return;
      }
      
      const { data: allVideoSentences, error: totalError } = await supabase
        .from('annotations')
        .select('video_id, sentence_no')
        .in('video_id', videoIds);
      
      if (totalError) {
        console.error('查询视频总句子数失败:', totalError);
        message.error('查询视频总句子数失败');
        return;
      }
      
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
      
      // 找出已完成的视频（已标注的句子数 = 视频的总句子数）
      const completed: CompletedTask[] = [];
      
      videoStatsMap.forEach((stats, videoId) => {
        const totalSentences = videoTotalSentences.get(videoId)?.size || 0;
        const annotatedSentences = stats.sentenceSet.size;
        
        // 只有当已标注的句子数 = 视频的总句子数时，才认为已完成
        if (totalSentences > 0 && annotatedSentences === totalSentences) {
          const video = videoMap.get(videoId);
          if (video) {
            completed.push({
              id: `${videoId}_${annotatorName}`, // 使用组合ID避免重复
              videoId: videoId,
              videoName: video.name || '未命名视频',
              subject: video.subject || '未知',
              duration: video.duration || 0,
              annotationCount: stats.annotationCount,
              completedTime: stats.maxUpdateTime
            });
            console.log(`✅ 已完成视频: ${video.name} (${annotatedSentences}/${totalSentences} 句)`);
          }
        } else {
          console.log(`⏳ 未完成视频: ${videoMap.get(videoId)?.name} (${annotatedSentences}/${totalSentences} 句)`);
        }
      });
      
      // 按完成时间降序排序（最新的在最上面）
      completed.sort((a, b) => b.completedTime.localeCompare(a.completedTime));
      
      setCompletedTasks(completed);
      console.log(`✅ 加载了 ${completed.length} 个已完成的标注任务`);
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
      title: '标注条数',
      dataIndex: 'annotationCount',
      key: 'annotationCount',
      width: 120,
      render: (count: number) => (
        <Tag color="green">{count} 条</Tag>
      )
    },
    {
      title: '完成时间',
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
                    <span>已标注任务</span>
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
                      showTotal: (total) => `共 ${total} 个已完成任务`
                    }}
                    scroll={{ x: 1000 }}
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

