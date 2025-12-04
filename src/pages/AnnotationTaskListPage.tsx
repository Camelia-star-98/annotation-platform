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
  Tabs,
  Modal,
  Select
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UserOutlined,
  CloseOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import type { AnnotationItem } from '../types';
import { getVideos, getBatchCompletedAnnotatorsCount } from '../api/database';
import AnnotationHistoryModal from '../components/AnnotationHistoryModal';

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
  rejectionCount?: number; // 被打回次数
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
  const [annotatorSelectModalVisible, setAnnotatorSelectModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<CompletedTask | null>(null);
  const [availableAnnotators, setAvailableAnnotators] = useState<string[]>([]);
  const [loadingAnnotators, setLoadingAnnotators] = useState(false);
  
  // 🆕 历史版本查看
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentAnnotationId, setCurrentAnnotationId] = useState<string>('');

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
      
      // 🚀 优化：查询所有句子（包括未标注的）来获取真实的总句子数和已完成情况
      console.log('🔍 查询视频标注统计信息...');
      const { data: allSentences, error: statsError } = await supabase
        .from('annotations')
        .select('video_id, sentence_no, annotator, human_annotated_text')
        .in('video_id', videoIds);
      
      if (statsError) {
        console.error('❌ 查询标注统计失败:', statsError);
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
      
      console.log(`✅ 获取到 ${allSentences?.length || 0} 条句子记录`);
      
      // 统计每个视频的总句子数和每个标注员的完成情况
      const videoTotalSentences = new Map<string, Set<number>>();
      const videoAnnotatorSentences = new Map<string, Map<string, Set<number>>>();
      
      // 统计每个视频的总句子数（所有句子，不管是否标注）
      allSentences?.forEach(item => {
        if (!videoTotalSentences.has(item.video_id)) {
          videoTotalSentences.set(item.video_id, new Set());
        }
        videoTotalSentences.get(item.video_id)!.add(item.sentence_no);
      });
      
      // 统计每个标注员已完成的句子（只统计已完成的标注）
      allSentences?.forEach(item => {
        // 只统计有标注人且已完成的记录
        if (item.annotator && item.annotator.trim() !== '' && 
            item.status === true) {
          if (!videoAnnotatorSentences.has(item.video_id)) {
            videoAnnotatorSentences.set(item.video_id, new Map());
          }
          const annotatorMap = videoAnnotatorSentences.get(item.video_id)!;
          if (!annotatorMap.has(item.annotator)) {
            annotatorMap.set(item.annotator, new Set());
          }
          annotatorMap.get(item.annotator)!.add(item.sentence_no);
        }
      });
      
      // 判断哪些视频已经有标注员完成了
      const completedVideos = new Set<string>();
      
      publishedVideos.forEach(video => {
        const videoId = video.id;
        const totalSentences = videoTotalSentences.get(videoId)?.size || 0;
        
        if (totalSentences === 0) {
          console.log(`⏭️  视频 ${video.name} (${videoId}) 没有任何标注记录，保留在列表中`);
          return;
        }
        
        const annotatorMap = videoAnnotatorSentences.get(videoId) || new Map();
        
        // 检查是否有任何标注员完成了该视频
        for (const [annotator, annotatedSentences] of annotatorMap.entries()) {
          const annotatedCount = annotatedSentences.size;
          if (annotatedCount === totalSentences && totalSentences > 0) {
            completedVideos.add(videoId);
            console.log(`✅ 视频 ${video.name} (${videoId}) 已被标注员 ${annotator} 完成 (${annotatedCount}/${totalSentences})`);
            break;
          }
        }
      });
      
      console.log(`📊 已完成的视频数量: ${completedVideos.size} / ${publishedVideos.length}`);
      
      // 过滤出待标注的任务
      const publishedTasks = publishedVideos
        .filter(video => {
          const completedCount = completedCountMap[video.id] || 0;
          const requiredCount = video.required_annotators || 1;
          const hasAnyCompleted = completedVideos.has(video.id);
          const isVideoFull = completedCount >= requiredCount;
          const isReviewCompleted = video.is_completed === true;
          
          const shouldFilter = hasAnyCompleted || isVideoFull || isReviewCompleted;
          
          if (shouldFilter) {
            console.log(`🚫 过滤视频: ${video.name} (有标注员已完成:${hasAnyCompleted}, 视频已满:${isVideoFull}, 复检完成:${isReviewCompleted}, ${completedCount}/${requiredCount})`);
          }
          
          return !shouldFilter;
        })
        .sort((a, b) => {
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
          completedAnnotators: completedCountMap[video.id] || 0,
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
      
      console.log('🔍 查询所有人被打回的数据（从 rejected_annotations 表）');
      
      // 🆕 从 rejected_annotations 表查询所有未重新提交的被打回数据（所有标注人）
      const { data: rejectedData, error } = await supabase
        .from('rejected_annotations')
        .select('*')
        .eq('is_resubmitted', false)
        .order('rejected_at', { ascending: false });
      
      if (error) {
        console.error('❌ 查询 rejected_annotations 表失败:', error);
        // 如果表不存在，回退到旧逻辑（只查询当前标注人）
        console.log('⚠️ rejected_annotations 表可能不存在，使用旧逻辑查询 annotations 表');
        
        let { data: allAnnotations, error: annotationsError } = await supabase
          .from('annotations')
          .select('id, video_id, original_text, human_annotated_text, major_category, minor_category, inspector, annotator, is_qualified, updated_at, created_at, rejection_count')
          .eq('annotator', annotatorName)
          .not('inspector', 'is', null)
          .neq('inspector', '')
          .eq('is_qualified', false);
        
        if (annotationsError) {
          console.error('查询被打回数据失败:', annotationsError);
          message.error('加载失败');
          return;
        }
        
        const allVideos = await getVideos();
        const videoMap = new Map(allVideos.map(v => [v.id, v]));
        
        const rejected = (allAnnotations || [])
          .map(item => {
            const video = videoMap.get(item.video_id);
            return {
              id: item.id,
              videoId: item.video_id,
              videoName: video?.name || '未知视频',
              subject: video?.subject || '未知',
              originalText: item.original_text || '',
              annotatedText: item.human_annotated_text || '',
              majorCategory: item.major_category || '',
              minorCategory: item.minor_category || '',
              inspector: item.inspector || '未知',
              annotator: item.annotator || '',
              rejectedTime: item.updated_at || item.created_at || '',
              rejectionCount: item.rejection_count || 0
            };
          })
          .sort((a, b) => b.rejectedTime.localeCompare(a.rejectedTime));
        
        setRejectedItems(rejected);
        console.log(`✅ [旧逻辑] 加载了 ${rejected.length} 条被打回的数据`);
        return;
      }
      
      console.log('📊 从 rejected_annotations 表查询到的数据数量:', rejectedData?.length || 0);
      
      // 转换数据格式
      const rejected: RejectedAnnotation[] = (rejectedData || []).map(item => ({
        id: item.annotation_id, // 使用原始 annotation_id 以便跳转到标注页面
        videoId: item.video_id,
        videoName: item.video_name,
        subject: item.subject,
        originalText: item.original_text || '',
        annotatedText: item.human_annotated_text || '',
        majorCategory: item.major_category || '',
        minorCategory: item.minor_category || '',
        inspector: item.inspector || '未知',
        annotator: item.annotator || '',
        rejectedTime: item.rejected_at || '',
        rejectionCount: item.rejection_count || 1
      }));
      
      setRejectedItems(rejected);
      console.log(`✅ 加载了 ${rejected.length} 条被打回的数据（所有标注人，未重新提交）`);
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
      
      // 🚀 使用 RPC 函数查询所有标注数据（无1000条限制）
      const { data: allAnnotations, error } = await supabase
        .rpc('get_all_annotations');
      
      if (error) {
        console.error('❌ 查询标注数据失败:', error);
        message.error('加载失败');
        return;
      }
      
      console.log('📊 查询到标注数据总数:', allAnnotations?.length || 0);
      
      // 过滤出已完成的标注数据（status = true）
      const validAnnotations = allAnnotations?.filter(a => 
        a.status === true
      ) || [];
      
      console.log('📊 有效标注数据（status = true）:', validAnnotations.length);
      
      // 🆕 从 videos 表直接读取视频总句数（上传时已保存）
      const videoTotalSentences = new Map<string, number>();
      allVideos.forEach(video => {
        if (video.total_sentences) {
          videoTotalSentences.set(video.id, video.total_sentences);
        }
      });
      
      // 统计每个视频每位标注员的标注情况
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
        
        // 统计质检状态（不依赖status字段）
        if (!item.inspector || item.inspector === '') {
          // 没有质检人，说明待质检
          stats.pendingCount++;
        } else if (item.is_qualified === true) {
          // 有质检人且通过
          stats.passedCount++;
        } else if (item.is_qualified === false) {
          // 有质检人且不通过
          stats.rejectedCount++;
        } else {
          // 有质检人但 is_qualified 为 null，可能是旧数据或待定
          stats.pendingCount++;
        }
        
        // 更新最新的标注时间
        if (item.updated_at && item.updated_at > stats.maxUpdateTime) {
          stats.maxUpdateTime = item.updated_at;
        }
      });
      
      if (videoStatsMap.size === 0) {
        setCompletedTasks([]);
        console.log('✅ 暂无任何标注员的标注数据');
        return;
      }
      
      // 创建视频ID到视频信息的映射
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      
      // 找出所有有标注数据的视频（包括部分完成和已完成）
      const completed: CompletedTask[] = [];
      
      videoStatsMap.forEach(stats => {
        const { videoId, annotator } = stats;
        const totalSentences = videoTotalSentences.get(videoId) || 0;
        // 该标注员标注的句子数
        const annotatedSentences = stats.sentenceSet.size;
        
        // 只要有标注数据就显示
        if (totalSentences > 0 && annotatedSentences > 0) {
          const video = videoMap.get(videoId);
          
          if (video) {
            const progressPercentage = Math.round((annotatedSentences / totalSentences) * 100);
            const isCompleted = annotatedSentences === totalSentences;
            
            completed.push({
              id: `${videoId}_${annotator}`,
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
          }
        }
      });
      
      // 按完成时间降序排序
      completed.sort((a, b) => b.completedTime.localeCompare(a.completedTime));
      
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
      width: 200,
      render: (text: string, record: RejectedAnnotation) => {
        const rejectionCount = record.rejectionCount || 0;
        if (rejectionCount > 0) {
          return `${text}（被打回第${rejectionCount}次）`;
        }
        return text;
      }
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: RejectedAnnotation) => (
        <Space>
          <Button
            type="primary"
            danger
            icon={<WarningOutlined />}
            onClick={() => handleReannotate(record)}
          >
            重新标注
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => {
              setCurrentAnnotationId(record.id);
              setHistoryModalVisible(true);
            }}
          >
            历史
          </Button>
        </Space>
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

  const handleViewCompleted = async (task: CompletedTask) => {
    // 先查询该视频的所有标注人
    setCurrentTask(task);
    setLoadingAnnotators(true);
    setAnnotatorSelectModalVisible(true);
    
    try {
      const { supabase } = await import('../api/supabase');
      
      // 查询该视频的所有标注人（有标注内容的）
      const { data: annotations, error } = await supabase
        .from('annotations')
        .select('annotator')
        .eq('video_id', task.videoId)
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .not('human_annotated_text', 'is', null)
        .neq('human_annotated_text', '');
      
      if (error) {
        console.error('查询标注人失败:', error);
        message.error('查询标注人失败');
        setAnnotatorSelectModalVisible(false);
        return;
      }
      
      // 去重获取所有标注人
      const annotators = [...new Set(annotations?.map(a => a.annotator).filter(Boolean) || [])];
      
      if (annotators.length === 0) {
        message.warning('该视频暂无标注数据');
        setAnnotatorSelectModalVisible(false);
        return;
      }
      
      setAvailableAnnotators(annotators);
    } catch (error) {
      console.error('查询标注人异常:', error);
      message.error('查询标注人失败');
      setAnnotatorSelectModalVisible(false);
    } finally {
      setLoadingAnnotators(false);
    }
  };

  const handleAnnotatorSelect = (selectedAnnotator: string) => {
    if (!currentTask) return;
    
    // 关闭选择框
    setAnnotatorSelectModalVisible(false);
    
    // 跳转到标注页面查看指定标注人的标注
    navigate('/annotation', {
      state: {
        videoId: currentTask.videoId,
        videoName: currentTask.videoName,
        annotatorName: selectedAnnotator,
        viewOnly: true // 标记为查看模式
      }
    });
    
    // 重置状态
    setCurrentTask(null);
    setAvailableAnnotators([]);
  };

  const handleCancelAnnotatorSelect = () => {
    setAnnotatorSelectModalVisible(false);
    setCurrentTask(null);
    setAvailableAnnotators([]);
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

        {/* 标注人选择弹窗 */}
        <Modal
          title="选择标注人"
          open={annotatorSelectModalVisible}
          onCancel={handleCancelAnnotatorSelect}
          footer={null}
          width={500}
        >
          <div style={{ padding: '20px 0' }}>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              请选择要查看的标注人：
            </p>
            <Select
              style={{ width: '100%' }}
              placeholder={loadingAnnotators ? '正在加载标注人列表...' : '请选择标注人'}
              loading={loadingAnnotators}
              disabled={loadingAnnotators}
              size="large"
              onChange={handleAnnotatorSelect}
              options={availableAnnotators.map(annotator => ({
                label: annotator,
                value: annotator
              }))}
            />
          </div>
        </Modal>

        {/* 🆕 历史版本查看弹窗 */}
        <AnnotationHistoryModal
          visible={historyModalVisible}
          onClose={() => {
            setHistoryModalVisible(false);
            setCurrentAnnotationId('');
          }}
          annotationId={currentAnnotationId}
        />
      </Content>
    </Layout>
  );
}

