import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Table,
  Checkbox,
  Modal,
  Input,
  Typography,
  Space,
  message,
  Divider,
  Tag,
  Select
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { VideoInfo } from '../types';
import './HomePage.css';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'annotation' | 'inspection'>('annotation');
  const [userName, setUserName] = useState('');
  const [completedVideos, setCompletedVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(''); // 搜索文本
  const [currentPage, setCurrentPage] = useState(1); // 当前页码
  const [pageSize, setPageSize] = useState(10); // 每页大小
  const [totalCount, setTotalCount] = useState(0); // 总数量
  const [completedVideoIds, setCompletedVideoIds] = useState<Set<string>>(new Set()); // 已完成的视频ID集合
  const [annotatorCountMap, setAnnotatorCountMap] = useState<Map<string, number>>(new Map()); // 每个视频的标注人数
  const [dataVersion, setDataVersion] = useState(0); // 数据版本号，用于触发重新加载
  const isLoadingRef = useRef(false); // 防止重复加载

  // 组件挂载时打印版本号
  useEffect(() => {
    console.log('🏠 HomePage 版本 5.1 - 禁用自动刷新，翻页时不重新加载所有数据');
  }, []);

  // 初始化：加载已完成的视频ID列表
  useEffect(() => {
    loadCompletedVideoIds();
  }, []);

  // 当完成视频ID加载完成后，加载第一页数据
  useEffect(() => {
    if (completedVideoIds.size > 0 && !isLoadingRef.current && dataVersion > 0) {
      console.log(`🔄 数据刷新完成，加载第 ${currentPage} 页 (version=${dataVersion})`);
      loadPageVideos(currentPage, pageSize, searchText, completedVideoIds, annotatorCountMap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]); // 只监听 dataVersion，用于首次加载和刷新后加载

  // 当页码或搜索条件变化时，加载对应页的视频
  useEffect(() => {
    console.log(`🔔 useEffect [currentPage, pageSize, searchText] 触发: page=${currentPage}, size=${pageSize}, search="${searchText}", completedVideoIds.size=${completedVideoIds.size}, isLoading=${isLoadingRef.current}, dataVersion=${dataVersion}`);
    // 只有在completedVideoIds已经加载且不在加载中时才执行
    if (completedVideoIds.size > 0 && !isLoadingRef.current && dataVersion > 0) {
      console.log(`📄 ✅ 满足条件，开始加载页面视频`);
      loadPageVideos(currentPage, pageSize, searchText, completedVideoIds, annotatorCountMap);
    } else {
      console.log(`📄 ⚠️ 不满足条件，跳过加载: completedVideoIds.size=${completedVideoIds.size}, isLoading=${isLoadingRef.current}, dataVersion=${dataVersion}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchText]); // dataVersion 不需要作为依赖项，因为它会导致不必要的重复加载

  // 监听页面可见性，当用户返回页面时自动刷新（暂时禁用，避免翻页时意外触发）
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible') {
  //       console.log('📍 页面变为可见，重新加载数据...');
  //       loadCompletedVideoIds();
  //     }
  //   };
  //
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //
  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, []);

  // 第一步：加载已完成复检的视频ID列表（只加载ID，不加载完整视频信息）
  const loadCompletedVideoIds = async () => {
    if (isLoadingRef.current) {
      console.log('⏸️ 已有加载任务在进行中，跳过...');
      return;
    }
    
    // 打印调用信息和调用栈，帮助调试
    console.log('🔄 触发完整数据刷新');
    console.trace('🔍 开始查询已完成复检的视频ID... 调用栈：');
    
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 1. 分页查询所有标注数据
      let allAnnotations: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('annotations')
          .select('video_id, annotator, human_annotated_text, review_status, status')
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown')
          .range(offset, offset + limit - 1);
        
        if (error) {
          console.error('查询标注数据失败:', error);
          message.error('加载失败');
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }
        
        if (data && data.length > 0) {
          allAnnotations = allAnnotations.concat(data);
          offset += data.length;
          hasMore = data.length === limit;
          console.log(`  - 已加载 ${allAnnotations.length} 条标注数据...`);
        } else {
          hasMore = false;
        }
      }
      
      console.log('📊 查询到的标注数据总数:', allAnnotations.length);
      
      // 2. 按视频和标注人分组，统计每个标注人的复检状态
      const videoAnnotatorMap = new Map<string, Map<string, { total: number; reviewed: number }>>();
      
      allAnnotations.forEach(item => {
        const videoId = item.video_id;
        const annotator = item.annotator;
        const isCompleted = item.status === true;
        
        // 只统计已完成的标注（status = true）
        if (!isCompleted) return;
        
        if (!videoAnnotatorMap.has(videoId)) {
          videoAnnotatorMap.set(videoId, new Map());
        }
        
        const annotatorMap = videoAnnotatorMap.get(videoId)!;
        if (!annotatorMap.has(annotator)) {
          annotatorMap.set(annotator, { total: 0, reviewed: 0 });
        }
        
        const stats = annotatorMap.get(annotator)!;
        stats.total++;
        if (item.review_status === true) {
          stats.reviewed++;
        }
      });
      
      // 3. 筛选出有已复检数据的视频ID（只要有任何已复检的数据就显示）
      const completedIds = new Set<string>();
      const videoAnnotatorCount = new Map<string, number>();
      
      videoAnnotatorMap.forEach((annotatorMap, videoId) => {
        let annotatorCount = 0;
        let hasReviewedData = false;
        
        annotatorMap.forEach((stats) => {
          // 只要该标注人有至少一条已复检的数据，就计入
          if (stats.reviewed > 0) {
            hasReviewedData = true;
            annotatorCount++;
          }
        });
        
        // 只要视频中有任何已复检的数据，就加入到已复检列表
        if (hasReviewedData) {
          completedIds.add(videoId);
          videoAnnotatorCount.set(videoId, annotatorCount);
        }
      });
      
      console.log('✅ 已完成复检的视频ID数量:', completedIds.size);
      
      // 保存已完成的视频ID集合和标注人数映射
      setCompletedVideoIds(completedIds);
      setAnnotatorCountMap(videoAnnotatorCount);
      setTotalCount(completedIds.size);
      
      // 增加数据版本号，触发 useEffect 重新加载
      setDataVersion(prev => prev + 1);
      
      if (completedIds.size === 0) {
        console.warn('⚠️ 没有找到已完成复检的视频');
        setCompletedVideos([]);
      }
    } catch (error) {
      console.error('加载视频ID列表失败:', error);
      message.error('加载视频ID列表失败');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // 第二步：按页加载视频详细信息
  const loadPageVideos = async (
    page: number, 
    size: number, 
    search: string,
    videoIds?: Set<string>,
    annotatorCountMap?: Map<string, number>
  ) => {
    if (isLoadingRef.current) {
      console.log('⏸️ 已有加载任务在进行中，跳过...');
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 使用传入的videoIds或state中的completedVideoIds
      const idsToUse = videoIds || completedVideoIds;
      if (idsToUse.size === 0) {
        setCompletedVideos([]);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      console.log(`📄 加载第 ${page} 页视频，每页 ${size} 条`);
      
      // 将Set转为数组
      const idsArray = Array.from(idsToUse);
      
      // 构建查询
      let query = supabase
        .from('videos')
        .select('*')
        .in('id', idsArray);
      
      // 如果有搜索条件，添加搜索过滤
      if (search && search.trim()) {
        const searchLower = search.toLowerCase();
        // 先查询所有匹配的视频
        const { data: allMatchedVideos, error: searchError } = await query;
        
        if (searchError) {
          console.error('搜索视频失败:', searchError);
          message.error('搜索失败');
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }
        
        // 在客户端进行搜索过滤
        const filteredVideos = (allMatchedVideos || []).filter(video => 
          video.name?.toLowerCase().includes(searchLower) ||
          video.subject?.toLowerCase().includes(searchLower) ||
          video.id?.toLowerCase().includes(searchLower)
        );
        
        // 🆕 获取每个视频的最新完成时间（从 annotation_completions 表）
        const videoIdsForCompletion = filteredVideos.map(v => v.id);
        const { data: completionData } = await supabase
          .from('annotation_completions')
          .select('video_id, completed_at')
          .in('video_id', videoIdsForCompletion)
          .order('completed_at', { ascending: false });
        
        // 构建每个视频的最新完成时间映射
        const videoCompletionTime = new Map<string, string>();
        completionData?.forEach(item => {
          if (!videoCompletionTime.has(item.video_id)) {
            // 只保留最新的完成时间
            videoCompletionTime.set(item.video_id, item.completed_at);
          }
        });
        
        // 按完成时间降序排序（最新的在最前面）- 在分页之前排序
        filteredVideos.sort((a, b) => {
          const timeA = videoCompletionTime.get(a.id) || a.created_at || '';
          const timeB = videoCompletionTime.get(b.id) || b.created_at || '';
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;  // 没有完成时间的排后面
          if (!timeB) return -1;
          return timeB.localeCompare(timeA);  // 降序：新的在前
        });
        
        // 更新总数
        setTotalCount(filteredVideos.length);
        
        // 分页
        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;
        const pageVideos = filteredVideos.slice(startIndex, endIndex);
        
        // 添加标注人数信息
        const videosWithCount = pageVideos.map(video => ({
          ...video,
          completedAnnotators: annotatorCountMap?.get(video.id) || 0
        }));
        
        setCompletedVideos(videosWithCount);
        console.log(`✅ 加载了 ${videosWithCount.length} 个视频（搜索后）`);
      } else {
        // 无搜索条件，先获取所有视频数据进行排序，再分页
        const { data: allVideos, error: allError } = await supabase
          .from('videos')
          .select('*')
          .in('id', idsArray);
        
        if (allError) {
          console.error('加载视频失败:', allError);
          message.error('加载视频失败');
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }
        
        // 🆕 获取每个视频的最新完成时间（从 annotation_completions 表）
        const { data: completionData } = await supabase
          .from('annotation_completions')
          .select('video_id, completed_at')
          .in('video_id', idsArray)
          .order('completed_at', { ascending: false });
        
        // 构建每个视频的最新完成时间映射
        const videoCompletionTime = new Map<string, string>();
        completionData?.forEach(item => {
          if (!videoCompletionTime.has(item.video_id)) {
            // 只保留最新的完成时间
            videoCompletionTime.set(item.video_id, item.completed_at);
          }
        });
        
        // 按完成时间降序排序（最新的在最前面）- 在分页之前排序
        const sortedVideos = (allVideos || []).sort((a, b) => {
          const timeA = videoCompletionTime.get(a.id) || a.created_at || '';
          const timeB = videoCompletionTime.get(b.id) || b.created_at || '';
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;  // 没有完成时间的排后面
          if (!timeB) return -1;
          return timeB.localeCompare(timeA);  // 降序：新的在前
        });
        
        // 分页
        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;
        const pageVideos = sortedVideos.slice(startIndex, endIndex);
        
        // 从annotations表查询每个视频的标注人数
        const videoIdsInPage = pageVideos?.map(v => v.id) || [];
        const { data: annotationData } = await supabase
          .from('annotations')
          .select('video_id, annotator')
          .in('video_id', videoIdsInPage)
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown');
        
        // 统计每个视频的标注人数
        const annotatorCount = new Map<string, Set<string>>();
        annotationData?.forEach(item => {
          if (!annotatorCount.has(item.video_id)) {
            annotatorCount.set(item.video_id, new Set());
          }
          annotatorCount.get(item.video_id)?.add(item.annotator);
        });
        
        // 添加标注人数信息
        const videosWithCount = (pageVideos || []).map(video => ({
          ...video,
          completedAnnotators: annotatorCount.get(video.id)?.size || 0
        }));
        
        setCompletedVideos(videosWithCount);
        setTotalCount(idsToUse.size);
        console.log(`✅ 加载了 ${videosWithCount.length} 个视频`);
      }
    } catch (error) {
      console.error('加载视频页面失败:', error);
      message.error('加载视频页面失败');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // 更新视频科目
  const handleSubjectChange = async (videoId: string, newSubject: string) => {
    try {
      const { supabase } = await import('../api/supabase');
      
      const { error } = await supabase
        .from('videos')
        .update({ subject: newSubject })
        .eq('id', videoId);

      if (error) {
        console.error('更新科目失败:', error);
        message.error('更新科目失败');
        return;
      }

      // 更新本地状态
      setCompletedVideos(prev =>
        prev.map(video =>
          video.id === videoId ? { ...video, subject: newSubject } : video
        )
      );

      message.success('科目更新成功');
    } catch (error) {
      console.error('更新科目失败:', error);
      message.error('更新科目失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: () => {
        // 获取当前页的视频ID
        const currentPageVideoIds = completedVideos.map(video => video.id);
        // 计算当前页有多少视频被选中
        const selectedInCurrentPage = currentPageVideoIds.filter(id => selectedVideos.includes(id)).length;
        // 全选状态：当前页所有视频都被选中
        const isAllSelected = currentPageVideoIds.length > 0 && selectedInCurrentPage === currentPageVideoIds.length;
        // 部分选中状态：当前页有部分视频被选中，但不是全部
        const isIndeterminate = selectedInCurrentPage > 0 && selectedInCurrentPage < currentPageVideoIds.length;
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <span>全选</span>
          </div>
        );
      },
      key: 'select',
      width: 80,
      render: (_: any, record: VideoInfo) => (
        <Checkbox
          checked={selectedVideos.includes(record.id)}
          onChange={(e) => handleSelectVideo(record.id, e.target.checked)}
        />
      )
    },
    {
      title: '视频名称',
      dataIndex: 'name',
      key: 'name',
      width: 250
    },
    {
      title: '标注文件名称',
      key: 'annotationFileName',
      width: 250,
      ellipsis: true,
      render: (_: any, record: VideoInfo) => {
        // 优先显示数据库中保存的 annotation_file_name
        if (record.annotation_file_name) {
          return record.annotation_file_name;
        }
        // 如果视频名称为空、只有ID或者是annotation_only_开头的，显示"无"
        if (!record.name || record.name === record.id || record.name.startsWith('annotation_only_')) {
          return <span style={{ color: '#999' }}>无</span>;
        }
        // 兜底：标注文件名通常是：视频名称_标注数据.xlsx
        // 如果视频名称已经包含扩展名，去掉扩展名
        const baseName = record.name.replace(/\.(mp4|avi|mov|wmv|flv|mkv)$/i, '');
        return `${baseName}_标注数据.xlsx`;
      }
    }, // 标注文件名称列
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 150,
      render: (text: string, record: VideoInfo) => (
        <Select
          value={text || '未知'}
          style={{ width: 120 }}
          onChange={(value) => handleSubjectChange(record.id, value)}
          options={[
            { label: '物理', value: '物理' },
            { label: '英语', value: '英语' },
            { label: '数学', value: '数学' },
            { label: '语文', value: '语文' },
            { label: '化学', value: '化学' }
          ]}
        />
      )
    },
    {
      title: '时长',
      key: 'duration',
      width: 100,
      render: (_: any, record: VideoInfo) => {
        if (!record.duration) return '-';
        const mins = Math.floor(record.duration / 60);
        const secs = record.duration % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    },
    {
      title: '已复检标注人数',
      dataIndex: 'completedAnnotators',
      key: 'completedAnnotators',
      width: 130,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="green">{count || 0} 人</Tag>
      )
    },
    {
      title: '完成时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: () => (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          已完成
        </Tag>
      )
    }
  ];

  // 选择视频
  const handleSelectVideo = (videoId: string, checked: boolean) => {
    if (checked) {
      setSelectedVideos([...selectedVideos, videoId]);
    } else {
      setSelectedVideos(selectedVideos.filter(id => id !== videoId));
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    // 获取当前页的所有视频ID
    const currentPageVideoIds = completedVideos.map(video => video.id);
    
    if (checked) {
      // 全选：将当前页的视频ID添加到已选择列表（去重）
      const newSelectedVideos = [...new Set([...selectedVideos, ...currentPageVideoIds])];
      setSelectedVideos(newSelectedVideos);
    } else {
      // 取消全选：从已选择列表中移除当前页的视频ID
      setSelectedVideos(selectedVideos.filter(id => !currentPageVideoIds.includes(id)));
    }
  };

  // 处理分页变化
  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
    // 保留已选择的视频，不清空
  };

  // 过滤后的视频列表（用于显示）
  const filteredCompletedVideos = completedVideos;

  // 打开弹窗
  const openModal = (type: 'annotation' | 'inspection') => {
    setModalType(type);
    setUserName('');
    setIsModalVisible(true);
  };

  // 开始标注/质检
  const handleStart = () => {
    if (!userName.trim()) {
      message.warning('请填写姓名');
      return;
    }

    setIsModalVisible(false);
    
    if (modalType === 'annotation') {
      // 进入任务列表页面
      navigate('/annotation-tasks', { 
        state: { annotatorName: userName }
      });
    } else {
      // 进入质检视频选择页面
      navigate('/inspection-select', { 
        state: { inspectorName: userName }
      });
    }
    
    // 重置姓名
    setUserName('');
  };

  // 进入复检
  const handleReview = () => {
    navigate('/review-select');
  };

  // 结果分析
  const handleAnalysis = () => {
    if (selectedVideos.length === 0) {
      message.warning('请至少选择一个视频');
      return;
    }
    navigate('/analysis', { state: { selectedVideos } });
  };

  // 结果对比
  const handleComparison = () => {
    if (selectedVideos.length < 2) {
      message.warning('请至少选择2个视频进行对比');
      return;
    }
    if (selectedVideos.length > 6) {
      message.warning('最多支持同时对比6个视频');
      return;
    }
    navigate('/comparison', { state: { selectedVideos } });
  };

  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          标注平台
        </Title>
      </Header>

      <Content className="home-content">
        <div className="home-container">
          {/* 视频和数据管理入口 */}
          <Card className="upload-card">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  数据管理
                </Typography.Title>
                <Typography.Text type="secondary">
                  管理视频文件和标注数据，上传新视频或查看已有数据
                </Typography.Text>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<DatabaseOutlined />}
                onClick={() => navigate('/video-manage')}
                block
              >
                视频和数据管理
              </Button>
            </Space>
          </Card>

          <Divider>或使用以下功能</Divider>

          {/* 功能入口卡片 */}
          <div className="entry-cards">
            <Card className="entry-card" hoverable>
              <div className="card-icon annotation">
                <EditOutlined style={{ fontSize: 48 }} />
              </div>
              <Title level={4}>教研标注</Title>
              <p>对视频内容进行文本标注和问题分类</p>
              <Button
                type="primary"
                size="large"
                onClick={() => openModal('annotation')}
              >
                开始标注
              </Button>
            </Card>

            <Card className="entry-card" hoverable>
              <div className="card-icon inspection">
                <CheckCircleOutlined style={{ fontSize: 48 }} />
              </div>
              <Title level={4}>抽样质检</Title>
              <p>选择标注数据进行质量检查</p>
              <Button
                type="primary"
                size="large"
                onClick={() => openModal('inspection')}
              >
                开始质检
              </Button>
            </Card>

            <Card className="entry-card" hoverable>
              <div className="card-icon review">
                <EyeOutlined style={{ fontSize: 48 }} />
              </div>
              <Title level={4}>产品复检</Title>
              <p>PM复检标注结果，确认问题分类</p>
              <Button
                type="primary"
                size="large"
                onClick={handleReview}
              >
                进入复检
              </Button>
            </Card>
          </div>

          {/* 已完成视频列表 */}
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>已完成视频列表</span>
                <Tag color="success">{totalCount} 个视频</Tag>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={loadCompletedVideoIds}
                  loading={loading}
                  title="刷新列表"
                />
              </Space>
            }
            extra={
              <Space>
                <span>已选择 {selectedVideos.length} 个视频</span>
                <Button
                  type="default"
                  icon={<SwapOutlined />}
                  onClick={handleComparison}
                  disabled={selectedVideos.length < 2}
                >
                  结果对比
                </Button>
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  onClick={handleAnalysis}
                  disabled={selectedVideos.length === 0}
                >
                  结果分析
                </Button>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
              这些视频已完成：教研标注 → 抽样质检 → 产品复检，可进行结果分析或对比（选择2-6个视频）
            </Typography.Paragraph>
            
            {/* 搜索框 */}
            <div style={{ marginBottom: 16 }}>
              <Input.Search
                placeholder="搜索视频名称、科目或ID"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={(value) => setSearchText(value)}
                style={{ width: 400 }}
                size="large"
              />
            </div>

            <Table
              columns={columns}
              dataSource={filteredCompletedVideos}
              rowKey="id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: totalCount,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个视频`,
                onChange: handlePageChange,
                onShowSizeChange: handlePageChange
              }}
              locale={{
                emptyText: searchText ? '未找到匹配的视频' : '暂无已完成的视频'
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </div>
      </Content>

      {/* 姓名输入弹窗 */}
      <Modal
        title={modalType === 'annotation' ? '教研标注' : '抽样质检'}
        open={isModalVisible}
        onOk={handleStart}
        onCancel={() => setIsModalVisible(false)}
        okText={modalType === 'annotation' ? '开始标注' : '进入质检管理'}
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            {modalType === 'annotation' ? '标注人姓名' : '质检人姓名'}
          </label>
          <Input
            placeholder="请输入姓名"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onPressEnter={handleStart}
            size="large"
          />
        </div>
      </Modal>
    </Layout>
  );
}

