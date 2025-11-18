import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Select,
  Input,
  Checkbox,
  Button,
  Space,
  message,
  Typography,
  Cascader,
  Tag
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactPlayer from 'react-player';
import { PROBLEM_CATEGORIES, generateMockAnnotations } from '../mock/data';
import type { AnnotationItem } from '../types';
import './AnnotationPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

export default function AnnotationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef<ReactPlayer>(null);
  
  // 支持两种模式：
  // 1. 旧模式：从主页传入 videos 数组
  // 2. 新模式：从任务列表传入 videoId、videoName、annotatorName
  const userName = location.state?.annotatorName || location.state?.userName || '未知用户';
  const videos = location.state?.videos || [];
  const videoId = location.state?.videoId;
  const videoName = location.state?.videoName;
  const uploadedAnnotations = location.state?.annotations || null;
  const isUploadMode = location.state?.isUploadMode || false;
  
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const pageSize = 20; // 修改为每页20条

  // 加载视频数据（新模式）
  useEffect(() => {
    if (videoId && !videos.length) {
      loadVideoData(videoId);
    }
  }, [videoId]);

  const loadVideoData = async (id: string) => {
    setLoading(true);
    try {
      const { getVideos, getAnnotations } = await import('../api/database');
      
      // 获取视频信息
      const allVideos = await getVideos();
      const video = allVideos.find(v => v.id === id);
      
      if (video) {
        setCurrentVideo(video);
      }
      
      // 获取标注数据
      const annotationData = await getAnnotations(id);
      
      if (annotationData.length > 0) {
        setAnnotations(annotationData);
        message.success(`加载了 ${annotationData.length} 条标注数据`);
      } else {
        message.warning('该视频暂无标注数据');
      }
    } catch (error) {
      console.error('加载视频数据失败:', error);
      message.error('加载视频数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据（旧模式）
  useEffect(() => {
    if (isUploadMode && uploadedAnnotations) {
      // 使用上传的数据
      setAnnotations(uploadedAnnotations);
    } else if (videos.length > 0) {
      // 使用模拟数据
      const mockData = generateMockAnnotations(videos[currentVideoIndex].id);
      setAnnotations(mockData);
    }
  }, [currentVideoIndex, videos, uploadedAnnotations, isUploadMode]);

  // 构建级联选择器选项
  const categoryOptions = PROBLEM_CATEGORIES.map(cat => ({
    value: cat.majorCategory,
    label: cat.majorCategory,
    children: cat.minorCategories.map(sub => ({
      value: sub,
      label: sub
    }))
  }));

  // 点击时间戳跳转视频
  const handleTimeClick = (startTime: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, 'seconds');
    }
  };

  // 更新标注项
  const updateAnnotation = (id: string, field: string, value: any) => {
    setAnnotations(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 处理问题分类选择（支持多选）
  const handleCategoryChange = (id: string, value: [string, string][] | null) => {
    if (value && value.length > 0) {
      // 提取所有选中的大类和小类
      const majorCategories = value.map(v => v[0]);
      const minorCategories = value.map(v => v[1]);
      
      // 使用逗号分隔存储多个分类
      updateAnnotation(id, 'majorCategory', [...new Set(majorCategories)].join(','));
      updateAnnotation(id, 'minorCategory', minorCategories.join(','));
    } else {
      updateAnnotation(id, 'majorCategory', '');
      updateAnnotation(id, 'minorCategory', '');
    }
  };

  // 提交标注
  const handleSubmit = async () => {
    const completedCount = annotations.filter(item => item.status).length;
    
    if (completedCount === 0) {
      message.warning('请至少完成一条标注');
      return;
    }

    try {
      // 使用 Supabase - 确保每条数据都有标注人姓名
      const annotationsWithUser = annotations.map(item => ({
        ...item,
        annotator: userName // 添加标注人姓名
      }));
      
      const { saveAnnotations } = await import('../api/database');
      const currentVideoId = videoId || videos[currentVideoIndex]?.id || 'unknown';
      const success = await saveAnnotations(currentVideoId, annotationsWithUser);
      
      if (success) {
        message.success(`标注完成！共标注 ${completedCount} 条数据，已保存到云端数据库`);
        setTimeout(() => navigate('/'), 1500);
      } else {
        message.error('保存失败，请重试');
      }
    } catch (error) {
      console.error('保存标注数据失败:', error);
      message.error('保存失败，请检查后端服务');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '句子编号',
      dataIndex: 'sentenceNo',
      key: 'sentenceNo',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 120,
      render: (text: string, record: AnnotationItem) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleTimeClick(record.startTime)}
          style={{ padding: 0, height: 'auto' }}
        >
          {text}
        </Button>
      )
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 180,
      ellipsis: false,
      render: (text: string) => (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          lineHeight: '1.4',
          fontSize: '13px'
        }}>
          {text}
        </div>
      )
    },
    {
      title: '大模型改写文本',
      dataIndex: 'aiRewrittenText',
      key: 'aiRewrittenText',
      width: 180,
      ellipsis: false,
      render: (text: string) => (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          lineHeight: '1.4',
          fontSize: '13px'
        }}>
          {text}
        </div>
      )
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 180,
      render: (text: string, record: AnnotationItem) => (
        <TextArea
          value={text}
          onChange={(e) => updateAnnotation(record.id, 'humanAnnotatedText', e.target.value)}
          autoSize={{ minRows: 1, maxRows: 6 }}
          placeholder="双击编辑"
          style={{ fontSize: '13px' }}
        />
      )
    },
    {
      title: '问题分类',
      key: 'category',
      width: 250,
      render: (_: any, record: AnnotationItem) => {
        // 将存储的逗号分隔字符串转换为数组格式
        let currentValue: [string, string][] | undefined;
        if (record.majorCategory && record.minorCategory) {
          const majors = record.majorCategory.split(',').filter(Boolean);
          const minors = record.minorCategory.split(',').filter(Boolean);
          
          // 组合成 [[大类1, 小类1], [大类2, 小类2], ...] 格式
          currentValue = minors.map((minor, index) => {
            // 找到该小类对应的大类
            const matchedCategory = PROBLEM_CATEGORIES.find(cat => 
              cat.minorCategories.includes(minor)
            );
            return [matchedCategory?.majorCategory || majors[0] || '', minor];
          });
        }
        
        return (
          <Cascader
            options={categoryOptions}
            onChange={(value) => handleCategoryChange(record.id, value as [string, string][] | null)}
            value={currentValue}
            placeholder="选择问题类型（可多选）"
            style={{ width: '100%' }}
            size="small"
            showSearch
            multiple
            maxTagCount="responsive"
          />
        );
      }
    },
    {
      title: '质检状态',
      dataIndex: 'isQualified',
      key: 'isQualified',
      width: 100,
      align: 'center' as const,
      render: (isQualified: boolean | undefined, record: AnnotationItem) => {
        if (isQualified === false) {
          return <Tag color="red">❌ 未通过</Tag>;
        } else if (isQualified === true) {
          return <Tag color="green">✅ 已通过</Tag>;
        } else if (record.status) {
          // 已标注但未质检
          return <Tag color="orange">⏳ 待质检</Tag>;
        } else {
          return <Tag color="default">未标注</Tag>;
        }
      }
    },
    {
      title: '标注状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (checked: boolean, record: AnnotationItem) => (
        <Checkbox
          checked={checked}
          onChange={(e) => updateAnnotation(record.id, 'status', e.target.checked)}
        />
      )
    }
  ];

  if (!loading && videos.length === 0 && !currentVideo) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>暂无视频数据</div>;
  }

  // 确定当前显示的视频：优先使用 currentVideo（新模式），否则使用 videos 数组（旧模式）
  const displayVideo = currentVideo || (videos.length > 0 ? videos[currentVideoIndex] : null);

  return (
    <Layout className="annotation-layout">
      <Header className="annotation-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            教研标注 - {userName}
          </Title>
        </Space>
      </Header>

      <Content className="annotation-content">
        <div className="annotation-container">
          {/* 视频播放器 */}
          <Card title={`原视频：${displayVideo?.name || videoName || '未命名视频'}`} className="video-card">
            <div className="video-wrapper">
              {displayVideo?.url ? (
                <ReactPlayer
                  ref={playerRef}
                  url={displayVideo.url}
                  controls
                  width="100%"
                  height="100%"
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '400px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: '#f0f0f0'
                }}>
                  {loading ? '加载中...' : '暂无视频'}
                </div>
              )}
            </div>
          </Card>

          {/* 标注表格 */}
          <Card
            className="annotation-table-card"
            title="标注内容"
            extra={
              <Space>
                <span>已标注：{annotations.filter(a => a.status).length} / {annotations.length}</span>
                <Button type="primary" onClick={handleSubmit}>
                  提交标注
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={annotations}
              rowKey="id"
              size="small"
              scroll={{ x: 1000 }}
              rowClassName={(record) => {
                // 质检未通过的数据行用红色背景标识
                if (record.isQualified === false) {
                  return 'row-failed-inspection';
                }
                return '';
              }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: annotations.length,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
                size: 'small'
              }}
            />
          </Card>
        </div>
      </Content>
    </Layout>
  );
}

