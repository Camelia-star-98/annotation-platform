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
  Popconfirm
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined
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

export default function AnnotationTaskListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const annotatorName = location.state?.annotatorName || '标注员';
  
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<AnnotationTask[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { getVideos } = await import('../api/database');
      const videos = await getVideos();
      
      // 只显示已发布的视频
      const publishedTasks = videos
        .filter(video => video.is_published)
        .map(video => ({
          id: video.id,
          videoName: video.name || '未命名视频',
          subject: video.subject || '未知',
          duration: video.duration || 0,
          requiredAnnotators: video.required_annotators || 1,
          completedAnnotators: 0, // TODO: 计算已完成人数
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

  // 撤回任务（取消发布）
  const handleWithdrawTask = async (task: AnnotationTask) => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 将视频的 is_published 设置为 false
      const { error } = await supabase
        .from('videos')
        .update({ is_published: false })
        .eq('id', task.id);
      
      if (error) {
        throw error;
      }
      
      message.success(`已撤回任务"${task.videoName}"`);
      loadTasks(); // 重新加载任务列表
    } catch (error) {
      console.error('撤回任务失败:', error);
      message.error('撤回任务失败');
    } finally {
      setLoading(false);
    }
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: AnnotationTask) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleStartAnnotation(record)}
          >
            开始标注
          </Button>
          <Popconfirm
            title="确认撤回？"
            description="撤回后，该任务将从任务列表中移除，标注员将无法访问"
            onConfirm={() => handleWithdrawTask(record)}
            okText="确认撤回"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<RollbackOutlined />}
            >
              撤回
            </Button>
          </Popconfirm>
        </Space>
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
        <Card
          title={
            <Space>
              <PlayCircleOutlined style={{ color: '#1890ff' }} />
              <span>待标注任务</span>
              <Tag color="blue">{tasks.length} 个任务</Tag>
            </Space>
          }
        >
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
        </Card>
      </Content>
    </Layout>
  );
}

