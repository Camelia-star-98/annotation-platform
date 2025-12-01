import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Checkbox,
  Modal,
  Input,
  Select,
  Statistic,
  Row,
  Col,
  Radio
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { AnnotationItem } from '../types';
import './InspectionManagePage.css';
import { supabase } from '../api/supabase';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export default function InspectionManagePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从上一页传来的质检人姓名、选中的视频ID、抽样比例
  const defaultInspectorName = location.state?.inspectorName || '';
  const selectedVideoId = location.state?.selectedVideoId;
  const videoName = location.state?.videoName;
  const samplePercentage = location.state?.samplePercentage || 100; // 默认100%（全部）
  
  const [allAnnotations, setAllAnnotations] = useState<AnnotationItem[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]); // 分组后的数据
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]); // 展开的行
  const [isBatchInspectModalVisible, setIsBatchInspectModalVisible] = useState(false);
  const [batchInspectResult, setBatchInspectResult] = useState<'pass' | 'fail' | null>(null);
  const [inspectorName, setInspectorName] = useState(defaultInspectorName);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inspected'>('pending');
  const [loading, setLoading] = useState(false);
  const [sampledCount, setSampledCount] = useState(0); // 抽样数量
  const [page, setPage] = useState(1); // 当前页码
  const [pageSize] = useState(50); // 每页数量（初始加载50条）
  const [hasMore, setHasMore] = useState(true); // 是否还有更多数据
  const [totalCount, setTotalCount] = useState(0); // 总数据量
  const [isLoadingMore, setIsLoadingMore] = useState(false); // 是否正在加载更多
  const [isLoadingData, setIsLoadingData] = useState(false); // 防止重复加载
  const [statistics, setStatistics] = useState({ pendingCount: 0, inspectedCount: 0, passedCount: 0, failedCount: 0 }); // 统计数据
  const [videoTotalSentences, setVideoTotalSentences] = useState<Map<string, number>>(new Map()); // 每个视频的总句子数

  // 按视频分组数据 - 使用 useCallback 优化
  const groupByVideo = useCallback((data: AnnotationItem[]) => {
    const videoGroups = new Map<string, AnnotationItem[]>();
    
    // 按 videoId 分组
    data.forEach(item => {
      const videoKey = item.videoId || 'unknown';
      if (!videoGroups.has(videoKey)) {
        videoGroups.set(videoKey, []);
      }
      videoGroups.get(videoKey)!.push(item);
    });
    
    // 转换为表格需要的格式
    const result: any[] = [];
    videoGroups.forEach((items, videoId) => {
      const videoName = items[0]?.videoName || videoId;
      const totalSentences = videoTotalSentences.get(videoId) || 0;
      
      // 父级行（视频）
      result.push({
        key: `video_${videoId}`,
        isGroup: true,
        videoId,
        videoName,
        itemCount: items.length,
        totalSentences, // 添加总句子数
        children: items.map(item => ({
          ...item,
          key: item.id,
          isGroup: false
        }))
      });
    });
    
    return result;
  }, [videoTotalSentences]);

  // 优化数据加载，添加分页和延迟加载（使用 useCallback 避免重复创建）
  const loadData = useCallback(async (isLoadMore = false) => {
    // 防止重复加载
    if (isLoadingData) {
      console.log('⚠️ 数据正在加载中，跳过重复请求');
      return;
    }
    
    setIsLoadingData(true);
    
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
      setPage(1);
      setAllAnnotations([]); // 重置数据
    }
    
    try {
      const { getVideo, getPendingInspectionAnnotations } = await import('../api/database');
      
      // 如果指定了视频ID，只加载该视频的数据（优化：直接查询单个视频，不查询所有视频）
      if (selectedVideoId) {
        // 优化：直接查询单个视频，而不是查询所有视频后查找
        let videoUrl = '';
        try {
          const currentVideo = await getVideo(selectedVideoId);
          videoUrl = currentVideo?.url || '';
        } catch (error) {
          console.error('获取视频信息失败，将继续使用传入的视频名称:', error);
          // 即使获取视频失败，也继续执行，使用传入的 videoName
        }
        
        // 计算分页参数（使用函数式更新避免闭包问题）
        let currentPage = 1;
        if (isLoadMore) {
          setPage(prev => {
            currentPage = prev + 1;
            return currentPage;
          });
        } else {
          currentPage = 1;
        }
        const offset = (currentPage - 1) * pageSize;
        
        // 优化：直接在数据库层面查询待质检数据，支持分页
        const { data: pendingAnnotations, total } = await getPendingInspectionAnnotations(
          selectedVideoId,
          { limit: pageSize, offset }
        );
        
        setTotalCount(total);
        setHasMore(offset + pendingAnnotations.length < total);
        
        // 实施抽样（如果不是100%且是第一页）
        let sampledAnnotations = pendingAnnotations;
        if (samplePercentage < 100 && !isLoadMore && pendingAnnotations.length > 0) {
          const calculatedSize = Math.ceil(total * samplePercentage / 100);
          const sampleSize = Math.max(1, Math.min(calculatedSize, 200)); // 限制最大抽样数量
          
          // 使用更高效的随机抽样（Fisher-Yates 洗牌算法）
          if (pendingAnnotations.length <= sampleSize) {
            sampledAnnotations = pendingAnnotations;
          } else {
            // 使用 Fisher-Yates 洗牌算法进行随机抽样，性能更好
            const shuffled = [...pendingAnnotations];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            sampledAnnotations = shuffled.slice(0, sampleSize);
          }
          
          setSampledCount(sampledAnnotations.length);
        } else if (samplePercentage < 100 && !isLoadMore && pendingAnnotations.length === 0) {
          // 如果没有待质检数据，但用户设置了抽样比例，显示0
          setSampledCount(0);
          sampledAnnotations = [];
        } else {
          // 100%抽样或加载更多，显示所有数据
          if (!isLoadMore) {
            setSampledCount(total);
          }
        }
        
        // 给每条标注添加视频名称和视频URL
        const annotationsWithVideoName = sampledAnnotations.map(item => ({
          ...item,
          videoName: videoName || '未知视频',
          videoUrl: videoUrl
        }));
        
        // 合并数据（加载更多时追加，否则替换）
        if (isLoadMore) {
          setAllAnnotations(prev => [...prev, ...annotationsWithVideoName]);
          setPage(currentPage);
        } else {
          setAllAnnotations(annotationsWithVideoName);
          setPage(1);
        }
        
        if (!isLoadMore) {
          if (samplePercentage < 100) {
            message.success(
              `已按 ${samplePercentage}% 比例抽样，从 ${total} 条中抽取了 ${annotationsWithVideoName.length} 条数据`
            );
          } else {
            message.success(`加载了视频"${videoName}"的 ${annotationsWithVideoName.length} 条待质检数据`);
          }
        }
      } else {
        // 否则加载所有数据 - 优化：只加载有人工标注文本且未质检的数据（精简字段，支持分页）
        // 计算分页参数（使用函数式更新避免闭包问题）
        let currentPage = 1;
        if (isLoadMore) {
          setPage(prev => {
            currentPage = prev + 1;
            return currentPage;
          });
        } else {
          currentPage = 1;
        }
        const offset = (currentPage - 1) * pageSize;
        
        // 性能优化：只查询必要的字段，不查询大文本字段，并支持分页
        // 质检所有句子（包括未标注和已标注的）
        // 排除已复检完成的数据（review_status 不为 null）
        const { data: annotationsData, error: annotationsError, count } = await supabase
          .from('annotations')
          .select('id, video_id, sentence_no, time_range, start_time, end_time, original_text, human_annotated_text, major_category, minor_category, annotator, inspector, review_status, created_at', { count: 'exact' })
          // ✅ 移除了 human_annotated_text 和 inspector 的限制
          // ✅ 质检员应该能看到所有句子
          .is('review_status', null)  // 排除已复检完成的数据
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        
        if (annotationsError) {
          console.error('加载标注数据失败:', annotationsError);
          message.error('加载数据失败，请重试');
          return;
        }
        
        setTotalCount(count || 0);
        setHasMore(offset + (annotationsData?.length || 0) < (count || 0));
        
        // 优化：只查询相关视频的基本信息（id, name, url），减少数据传输
        // 提取所有唯一的 video_id
        const uniqueVideoIds = [...new Set((annotationsData || []).map((item: any) => item.video_id))];
        
        // 只查询相关的视频，而不是所有视频
        const { data: videosData } = await supabase
          .from('videos')
          .select('id, name, url')
          .in('id', uniqueVideoIds); // 只查询相关的视频
        
        // 创建视频 ID 到视频信息的映射
        const videoMap = new Map((videosData || []).map((v: any) => [v.id, { name: v.name, url: v.url }]));
        
        // 转换数据格式并添加视频信息（只包含必要字段）
        const annotationsWithVideoName = (annotationsData || []).map((item: any) => {
          const videoInfo = videoMap.get(item.video_id);
          const videoName = videoInfo?.name || item.video_id || '未知视频';
          const videoUrl = videoInfo?.url || '';
          return {
              id: item.id || '',
              videoId: item.video_id || '',
              sentenceNo: item.sentence_no || 0,
              timeRange: item.time_range || '',
              startTime: item.start_time,
              endTime: item.end_time,
              originalText: item.original_text || '',
              aiRewrittenText: '', // 不查询，节省带宽
              humanAnnotatedText: item.human_annotated_text || '',
              majorCategory: item.major_category || '',
              minorCategory: item.minor_category || '',
              remark: '',
            status: false,
            annotator: item.annotator || '',
            isQualified: undefined,
            inspector: item.inspector || '',
            reviewer: '',
            reviewStatus: item.review_status ?? undefined,
            videoName,
            videoUrl,
            subject: ''
          };
        });
        
        // 合并数据（加载更多时追加，否则替换）
        if (isLoadMore) {
          setAllAnnotations(prev => [...prev, ...annotationsWithVideoName]);
          setPage(currentPage);
        } else {
          setAllAnnotations(annotationsWithVideoName);
          setPage(1);
        }
        
        if (!isLoadMore) {
          message.success(`加载了 ${annotationsWithVideoName.length} 条待质检数据（共 ${count || 0} 条）`);
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败，请检查网络连接或后端服务');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      setIsLoadingData(false); // 重置加载标志
    }
  }, [selectedVideoId, videoName, samplePercentage, pageSize]);

  // 单独查询每个视频的总句子数（从 videos 表读取）
  const loadVideoTotalSentences = useCallback(async () => {
    try {
      // 从 videos 表直接读取 total_sentences 字段
      const { getVideos } = await import('../api/database');
      const allVideos = await getVideos();
      
      // 转换为 Map<string, number>
      const totalSentences = new Map<string, number>();
      allVideos.forEach(video => {
        if (video.total_sentences) {
          totalSentences.set(video.id, video.total_sentences);
        }
      });
      
      // 如果指定了视频ID，只保留该视频的数据
      if (selectedVideoId && totalSentences.has(selectedVideoId)) {
        const videoTotal = totalSentences.get(selectedVideoId);
        totalSentences.clear();
        totalSentences.set(selectedVideoId, videoTotal!);
      }
      
      console.log('📊 视频总句子数统计（从 videos.total_sentences 读取）:', Object.fromEntries(totalSentences));
      setVideoTotalSentences(totalSentences);
    } catch (error) {
      console.error('加载视频总句子数失败:', error);
    }
  }, [selectedVideoId]);

  // 单独查询统计数据（从数据库查询，考虑去重）
  const loadStatistics = useCallback(async () => {
    try {
      // 查询待质检和已质检的数据（排除已复检完成的数据）
      // 🔧 修复：如果指定了 selectedVideoId，只统计该视频的数据
      // 使用分页查询避免1000条限制
      let allAnnotationsForStats: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('annotations')
          .select('id, video_id, sentence_no, annotator, human_annotated_text, inspector, is_qualified, review_status, updated_at, created_at')
          // ✅ 移除了 human_annotated_text 和 inspector 的限制
          // ✅ 质检员应该能看到所有句子
          .is('review_status', null);  // 排除已复检完成的数据
        
        // 🔧 如果指定了视频ID，只查询该视频的数据
        if (selectedVideoId) {
          query = query.eq('video_id', selectedVideoId);
        }
        
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          console.error('查询统计数据失败（第' + (page + 1) + '页）:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allAnnotationsForStats = allAnnotationsForStats.concat(data);
        }
        
        hasMore = data && data.length === pageSize;
        page++;
      }
      
      // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
      // 优先保留有质检状态的数据，如果都有质检状态则保留最新的
      const deduplicatedMap = new Map<string, any>();
      
      allAnnotationsForStats.forEach(ann => {
        const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
        const existing = deduplicatedMap.get(key);
        
        if (!existing) {
          deduplicatedMap.set(key, ann);
        } else {
          // 优先保留有质检状态的数据
          const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && existing.is_qualified === true;
          const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
          
          if (currentHasInspection && !existingHasInspection) {
            // 当前数据有质检状态，旧数据没有，保留当前数据
            deduplicatedMap.set(key, ann);
          } else if (existingHasInspection && !currentHasInspection) {
            // 旧数据有质检状态，当前数据没有，保留旧数据
            // 不做任何操作
          } else {
            // 都有或都没有质检状态，保留最新的（按 updated_at）
            const existingTime = existing.updated_at || existing.created_at || '';
            const currentTime = ann.updated_at || ann.created_at || '';
            if (currentTime > existingTime) {
              deduplicatedMap.set(key, ann);
            }
          }
        }
      });
      
      const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
      
      // 计算统计数据
      // ✅ 修改：待质检 = 所有句子（包括未标注和已标注的）且未质检
      const pendingCount = deduplicatedAnnotations.filter(item => {
        const notInspected = !item.inspector || item.inspector.trim() === '';
        return notInspected; // 所有未质检的句子都算"待质检"
      }).length;
      
      const inspectedCount = deduplicatedAnnotations.filter(item => 
        item.inspector && item.inspector.trim() !== ''
      ).length;
      
      const passedCount = deduplicatedAnnotations.filter(item => 
        item.is_qualified === true && item.inspector && item.inspector.trim() !== ''
      ).length;
      
      const failedCount = deduplicatedAnnotations.filter(item => 
        item.is_qualified === false && item.inspector && item.inspector.trim() !== ''
      ).length;
      
      console.log('📊 统计数据（去重后）' + (selectedVideoId ? `（仅视频 ${selectedVideoId}）` : '（全部视频）') + ':', {
        原始数量: allAnnotationsForStats.length,
        去重后数量: deduplicatedAnnotations.length,
        待质检: pendingCount,
        已质检: inspectedCount,
        通过: passedCount,
        不通过: failedCount
      });
      
      setStatistics({ pendingCount, inspectedCount, passedCount, failedCount });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, [selectedVideoId]); // 🔧 添加依赖，当 selectedVideoId 变化时重新加载统计

  // 加载数据（只在 selectedVideoId 变化时重新加载）
  useEffect(() => {
    loadVideoTotalSentences(); // 先加载总句子数
    loadData(false);
    loadStatistics(); // 同时加载统计数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId]);

  // 使用 useMemo 优化过滤和分组计算
  const filteredAndGroupedData = useMemo(() => {
    let filtered = allAnnotations;
    
    switch (filterStatus) {
      case 'pending':
        // ✅ 修改：待质检 = 所有未质检的句子（包括未标注和已标注的）
        filtered = allAnnotations.filter(item => {
          const notInspected = !item.inspector;
          const notReviewed = item.reviewStatus == null; // 排除已复检完成的数据
          return notInspected && notReviewed;
        });
        break;
      case 'inspected':
        // 已质检的（有质检人）且未复检完成
        filtered = allAnnotations.filter(item => {
          const hasInspector = item.inspector && item.inspector.trim() !== '';
          const notReviewed = item.reviewStatus == null; // 排除已复检完成的数据
          return hasInspector && notReviewed;
        });
        break;
      case 'all':
      default:
        // 全部：排除已复检完成的数据
        filtered = allAnnotations.filter(item => item.reviewStatus == null);
        break;
    }
    
    // 按视频分组
    return groupByVideo(filtered);
  }, [allAnnotations, filterStatus, groupByVideo]);
  
  // 更新状态
  useEffect(() => {
    setGroupedData(filteredAndGroupedData);
    setFilteredData(filteredAndGroupedData);
  }, [filteredAndGroupedData]);

  // 开始质检 - 跳转到质检页面
  const handleStartInspection = () => {
    if (selectedRows.length === 0) {
      message.warning('请至少选择一条数据进行质检');
      return;
    }

    const selectedData = allAnnotations.filter(item => 
      selectedRows.includes(item.id)
    );

    navigate('/inspection', {
      state: {
        userName: inspectorName || '质检员',
        inspectionData: selectedData,
        isFromManagement: true,
        returnToManagement: true, // 标记从管理页面来，返回时需要显示提交弹窗
        selectedVideoId,
        videoName
      }
    });
  };

  // 批量质检确认
  const handleBatchInspectConfirm = async () => {
    if (!batchInspectResult) {
      message.warning('请选择质检结果（通过/不通过）');
      return;
    }

    if (!inspectorName.trim()) {
      message.warning('请输入质检人姓名');
      return;
    }

    setLoading(true);
    try {
      const { updateAnnotation } = await import('../api/database');
      
      // 批量更新选中的数据
      const updatePromises = selectedRows.map(id => 
        updateAnnotation(id, {
          isQualified: batchInspectResult === 'pass',
          inspector: inspectorName
        })
      );

      await Promise.all(updatePromises);

      message.success(`批量质检完成！共质检 ${selectedRows.length} 条数据`);
      
      // 重新加载数据
      await loadData(false);
      await loadStatistics(); // 重新加载统计数据
      
      // 清空选择
      setSelectedRows([]);
      setBatchInspectResult(null);
      setIsBatchInspectModalVisible(false);
      
    } catch (error) {
      console.error('批量质检失败:', error);
      message.error('批量质检失败，请重试');
    } finally {
      setLoading(false);
    }
  };


  // 处理父级行的全选/取消
  const handleGroupSelect = (record: any, checked: boolean) => {
    if (!record.children || record.children.length === 0) return;
    
    // 过滤出未质检的子项（isQualified 为 null 或 undefined）
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 使用 == null 同时匹配 null 和 undefined
      .map((child: any) => child.key);
    
    if (checked) {
      // 选中：添加所有可选的子项
      const newSelectedKeys = [...new Set([...selectedRows, ...childKeys])];
      setSelectedRows(newSelectedKeys);
    } else {
      // 取消：移除所有子项
      const newSelectedKeys = selectedRows.filter(key => !childKeys.includes(key));
      setSelectedRows(newSelectedKeys);
    }
  };

  // 检查父级行是否被选中
  const isGroupSelected = (record: any) => {
    if (!record.children || record.children.length === 0) return false;
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 只统计未质检的
      .map((child: any) => child.key);
    if (childKeys.length === 0) return false; // 如果没有可选的子项，返回false
    return childKeys.every((key: string) => selectedRows.includes(key));
  };

  // 检查父级行是否部分选中
  const isGroupIndeterminate = (record: any) => {
    if (!record.children || record.children.length === 0) return false;
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 只统计未质检的
      .map((child: any) => child.key);
    if (childKeys.length === 0) return false; // 如果没有可选的子项，返回false
    const selectedCount = childKeys.filter((key: string) => selectedRows.includes(key)).length;
    return selectedCount > 0 && selectedCount < childKeys.length;
  };

  // 表格列定义
  const columns = [
    {
      title: '视频名称 / 句子编号',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 300,
      render: (text: string, record: any) => {
        if (record.isGroup) {
          const allChildrenSelected = isGroupSelected(record);
          const someChildrenSelected = isGroupIndeterminate(record);
          
          return (
            <Space>
              <Checkbox
                checked={allChildrenSelected}
                indeterminate={someChildrenSelected}
                onChange={(e) => {
                  console.log('📦 Checkbox onChange 触发', e.target.checked);
                  handleGroupSelect(record, e.target.checked);
                }}
                onClick={(e) => {
                  console.log('🖱️ Checkbox onClick 触发');
                  e.stopPropagation();
                }}
              />
              <strong style={{ fontSize: '14px' }}>
                📹 {text} <Tag color="blue">总标注数: {record.totalSentences || 0} 条</Tag>
              </strong>
            </Space>
          );
        }
        return `句子 ${record.sentenceNo}`;
      }
    },
    {
      title: '标注文件名称',
      dataIndex: 'videoName',
      key: 'videoNameDetail',
      width: 200,
      ellipsis: { showTitle: false },
      render: (text: string, record: any) => record.isGroup ? null : (text || '-')
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 120,
      render: (text: string, record: any) => record.isGroup ? null : text
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 200,
      ellipsis: { showTitle: false }, // 优化：禁用 tooltip，提升性能
      render: (text: string, record: any) => record.isGroup ? null : (text || '-')
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 200,
      ellipsis: { showTitle: false }, // 优化：禁用 tooltip，提升性能
      render: (text: string, record: any) => record.isGroup ? null : (text || '-')
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 150,
      render: (text: string, record: any) => {
        if (record.isGroup) return null;
        return text ? <Tag color="blue">{text}</Tag> : '-';
      }
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100,
      render: (text: string, record: any) => {
        if (record.isGroup) return null;
        // 如果标注人为空、null 或 'unknown'，显示为"未标注"
        if (!text || text === 'unknown' || text.trim() === '') {
          return <span style={{ color: '#999' }}>未标注</span>;
        }
        return text;
      }
    },
    {
      title: '标注状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: boolean, record: any) => {
        if (record.isGroup) return null;
        return status ? 
          <Tag color="success">已完成</Tag> : 
          <Tag color="default">未完成</Tag>;
      }
    },
    {
      title: '质检状态',
      key: 'inspectionStatus',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (record.isGroup) return null;
        if (record.inspector) {
          // 已质检
          if (record.isQualified === true) {
            return <Tag color="success" icon={<CheckCircleOutlined />}>✅ 通过</Tag>;
          } else if (record.isQualified === false) {
            return <Tag color="error">❌ 不通过</Tag>;
          }
        }
        // 未质检
        return <Tag color="orange" icon={<ClockCircleOutlined />}>⏳ 待质检</Tag>;
      }
    },
    {
      title: '质检人',
      dataIndex: 'inspector',
      key: 'inspector',
      width: 120,
      align: 'center' as const,
      render: (inspector: string, record: any) => {
        if (record.isGroup) return null;
        if (inspector) {
          return (
            <Tag color="blue" icon={<UserOutlined />}>
              {inspector}
            </Tag>
          );
        }
        return <Tag color="default">未质检</Tag>;
      }
    }
  ];

  const rowSelection = {
    selectedRowKeys: selectedRows,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedRows(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: any) => {
      const isParent = record.isGroup === true;
      const isInspected = record.isQualified !== null && record.isQualified !== undefined;
      
      return {
        disabled: isParent || isInspected, // 父级行和已质检的都不能选
      };
    },
  };

  return (
    <Layout className="inspection-manage-layout">
      <Header className="inspection-manage-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(selectedVideoId ? '/inspection-select' : '/', { 
              state: selectedVideoId ? { inspectorName: defaultInspectorName } : undefined 
            })}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            质检数据管理{videoName && ` - ${videoName}`}{defaultInspectorName && ` - ${defaultInspectorName}`}
          </Title>
        </Space>
      </Header>

      <Content className="inspection-manage-content">
        <div className="inspection-manage-container">
          {/* 抽样信息提示 */}
          {samplePercentage < 100 && sampledCount > 0 && (
            <Card 
              style={{ 
                marginBottom: 16, 
                background: '#e6f7ff', 
                borderColor: '#91d5ff' 
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🎲</span>
                  <span style={{ fontWeight: 500, color: '#0050b3' }}>
                    抽样质检模式：已按 {samplePercentage}% 比例随机抽取
                  </span>
                </div>
                <div style={{ color: '#096dd9', fontSize: 13 }}>
                  本次抽样数量：<strong>{sampledCount}</strong> 条 | 
                  抽样算法：Fisher-Yates 随机洗牌
                </div>
                <div style={{ color: '#fa8c16', fontSize: 12, marginTop: 4 }}>
                  ⚠️ 注意：只有被抽到的数据会被质检，其余数据仍为"待质检"状态，需要后续再次抽样质检
                </div>
              </Space>
            </Card>
          )}
          
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-待质检" : "待质检数据"}
                  value={statistics.pendingCount}
                  suffix="条"
                  valueStyle={{ color: '#faad14' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-已质检" : "已质检数据"}
                  value={statistics.inspectedCount}
                  suffix="条"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-通过" : "质检通过"}
                  value={statistics.passedCount}
                  suffix="条"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-不通过" : "质检不通过"}
                  value={statistics.failedCount}
                  suffix="条"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 操作栏 */}
          <Card style={{ marginBottom: 16 }}>
            <Space size="large" wrap>
              <span>筛选：</span>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: 150 }}
              >
                <Option value="pending">待质检</Option>
                <Option value="inspected">已质检</Option>
                <Option value="all">全部</Option>
              </Select>

              <div style={{ flex: 1 }} />

              <span>已选择 {selectedRows.length} 条</span>
              {hasMore && totalCount > 0 && (
                <Button
                  onClick={() => loadData(true)}
                  loading={isLoadingMore}
                  disabled={loading || isLoadingMore}
                >
                  {isLoadingMore ? '加载中...' : `加载更多 (${totalCount - allAnnotations.length} 条剩余)`}
                </Button>
              )}
              {!hasMore && totalCount > 0 && (
                <span style={{ color: '#999', fontSize: 12 }}>
                  已加载全部 {totalCount} 条数据
                </span>
              )}
              <Button
                type="primary"
                onClick={handleStartInspection}
                disabled={selectedRows.length === 0}
              >
                开始质检
              </Button>
            </Space>
          </Card>

          {/* 数据表格 */}
          <Card>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={filteredData}
              rowKey="key"
              loading={loading}
              scroll={{ x: 1400, y: 600 }} // 添加固定高度，启用虚拟滚动
              expandable={{
                defaultExpandAllRows: false,
                expandedRowKeys: expandedRowKeys,
                onExpand: (expanded, record) => {
                  if (expanded) {
                    setExpandedRowKeys([...expandedRowKeys, record.key]);
                  } else {
                    setExpandedRowKeys(expandedRowKeys.filter(k => k !== record.key));
                  }
                },
                rowExpandable: (record) => record.isGroup && record.children && record.children.length > 0
              }}
              pagination={{
                pageSize: 10, // 减少每页显示数量，提升渲染速度
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total, range) => `已加载 ${allAnnotations.length} / ${totalCount} 条（当前显示 ${range[0]}-${range[1]} 条）`
              }}
              size="small" // 使用小尺寸，减少渲染负担
            />
          </Card>
        </div>
      </Content>

      {/* 批量质检弹窗（合并了输入姓名和选择结果） */}
      <Modal
        title="批量质检"
        open={isBatchInspectModalVisible}
        onOk={handleBatchInspectConfirm}
        onCancel={() => {
          setIsBatchInspectModalVisible(false);
          setBatchInspectResult(null);
        }}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={loading}
        width={520}
      >
        <div style={{ padding: '20px 0' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 质检人姓名输入 */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 15 }}>
                质检人姓名 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Input
                placeholder="请输入质检人姓名"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                size="large"
                style={{ fontSize: 15 }}
              />
            </div>

            {/* 统计信息 */}
            <div style={{ background: '#e6f7ff', padding: 16, borderRadius: 8, border: '1px solid #91d5ff' }}>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                即将质检 <strong style={{ color: '#1890ff', fontSize: 20 }}>{selectedRows.length}</strong> 条数据
              </p>
            </div>

            {/* 质检结果选择 */}
            <div>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 500, fontSize: 15 }}>
                质检结果 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Radio.Group
                value={batchInspectResult}
                onChange={(e) => setBatchInspectResult(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Radio 
                    value="pass" 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      marginRight: 0
                    }}
                  >
                    <Space>
                      <CheckOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>通过</span>
                    </Space>
                  </Radio>
                  <Radio 
                    value="fail" 
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      marginRight: 0
                    }}
                  >
                    <Space>
                      <CloseOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>不通过</span>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {/* 提示信息 */}
            <div style={{ background: '#fffbe6', padding: 12, borderRadius: 4, border: '1px solid #ffe58f' }}>
              <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
                💡 提示：批量质检将对所有选中的数据应用相同的质检结果
              </p>
            </div>
          </Space>
        </div>
      </Modal>
    </Layout>
  );
}

