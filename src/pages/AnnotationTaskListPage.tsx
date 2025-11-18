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
  UserOutlined
} from '@ant-design/icons';

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

export default function AnnotationTaskListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const annotatorName = location.state?.annotatorName || '标注员';
  
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<AnnotationTask[]>([]);
  const [rejectedItems, setRejectedItems] = useState<RejectedAnnotation[]>([]);
  const [activeTab, setActiveTab] = useState<string>('tasks');

  useEffect(() => {
    loadTasks();
    loadRejectedItems();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { getVideos, getBatchCompletedAnnotatorsCount } = await import('../api/database');
      const videos = await getVideos();
      
      // 只显示已发布的视频
      const publishedVideos = videos.filter(video => video.is_published);
      
      // 批量获取完成人数
      const videoIds = publishedVideos.map(v => v.id);
      const completedCountMap = await getBatchCompletedAnnotatorsCount(videoIds);
      
      const publishedTasks = publishedVideos.map(video => ({
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
      const { getAllAnnotations, getVideos } = await import('../api/database');
      const [allAnnotations, allVideos] = await Promise.all([
        getAllAnnotations(),
        getVideos()
      ]);
      
      console.log('🔍 调试信息 - 当前标注人:', annotatorName);
      console.log('📊 所有标注数据数量:', allAnnotations.length);
      
      // 创建视频ID到视频信息的映射
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      
      // 调试：查看所有质检不通过的数据
      const failedInspections = allAnnotations.filter(item => item.isQualified === false);
      console.log('❌ 质检不通过的数据数量:', failedInspections.length);
      console.log('❌ 质检不通过的数据详情:', failedInspections.map(item => ({
        id: item.id,
        annotator: item.annotator,
        inspector: item.inspector,
        isQualified: item.isQualified,
        originalText: item.originalText?.substring(0, 20)
      })));
      
      // 筛选出：
      // 1. 当前标注人的数据
      // 2. 质检状态为不通过 (isQualified === false)
      // 3. 已经有质检人的数据
      const rejected = allAnnotations
        .filter(item => {
          const match = item.annotator === annotatorName &&
                       item.isQualified === false &&
                       item.inspector;
          
          if (item.isQualified === false) {
            console.log(`🔍 质检不通过的数据 ${item.id}:`, {
              annotator: item.annotator,
              匹配标注人: item.annotator === annotatorName,
              isQualified: item.isQualified,
              inspector: item.inspector,
              是否匹配: match
            });
          }
          
          return match;
        })
        .map(item => {
          const video = videoMap.get(item.videoId);
          return {
            id: item.id,
            videoId: item.videoId,
            videoName: video?.name || '未知视频',
            subject: video?.subject || '未知',
            originalText: item.originalText || '',
            annotatedText: item.annotatedText || '',
            majorCategory: item.majorCategory || '',
            minorCategory: item.minorCategory || '',
            inspector: item.inspector || '未知',
            annotator: item.annotator || '',
            rejectedTime: item.updated_at || item.created_at || ''
          };
        });
      
      setRejectedItems(rejected);
      console.log(`✅ 加载了 ${rejected.length} 条被打回的数据`);
    } catch (error) {
      console.error('加载被打回数据失败:', error);
      message.error('加载被打回数据失败');
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

