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
  Statistic,
  Row,
  Col
} from 'antd';
import {
  ArrowLeftOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface VideoInspectionData {
  id: string;
  videoName: string;
  subject: string;
  totalAnnotations: number;
  pendingInspection: number;
  passedInspection: number;
  failedInspection: number;
  uploadTime: string;
}

export default function InspectionSelectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inspectorName = location.state?.inspectorName || '质检员';
  
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoInspectionData[]>([]);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { getVideos, getAnnotations } = await import('../api/database');
      const allVideos = await getVideos();
      
      // 获取每个视频的标注统计
      const videoStats: VideoInspectionData[] = [];
      
      for (const video of allVideos) {
        const annotations = await getAnnotations(video.id);
        
        if (annotations.length > 0) {
          const pendingCount = annotations.filter(a => a.isQualified === null).length;
          const passedCount = annotations.filter(a => a.isQualified === true).length;
          const failedCount = annotations.filter(a => a.isQualified === false).length;
          
          videoStats.push({
            id: video.id,
            videoName: video.name,
            subject: video.subject || '未知',
            totalAnnotations: annotations.length,
            pendingInspection: pendingCount,
            passedInspection: passedCount,
            failedInspection: failedCount,
            uploadTime: video.created_at || ''
          });
        }
      }
      
      setVideos(videoStats);
      message.success(`加载了 ${videoStats.length} 个视频的质检数据`);
    } catch (error) {
      console.error('加载视频列表失败:', error);
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspection = (video: VideoInspectionData) => {
    navigate('/inspection-manage', {
      state: {
        inspectorName,
        selectedVideoId: video.id,
        videoName: video.videoName
      }
    });
  };

  const columns = [
    {
      title: '视频名称',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 300,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '总标注数',
      dataIndex: 'totalAnnotations',
      key: 'totalAnnotations',
      width: 100,
      align: 'center' as const,
      render: (count: number) => <Text>{count} 条</Text>
    },
    {
      title: '待质检',
      dataIndex: 'pendingInspection',
      key: 'pendingInspection',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'orange' : 'default'} icon={<ClockCircleOutlined />}>
          {count} 条
        </Tag>
      )
    },
    {
      title: '质检通过',
      dataIndex: 'passedInspection',
      key: 'passedInspection',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'success' : 'default'} icon={<CheckCircleOutlined />}>
          {count} 条
        </Tag>
      )
    },
    {
      title: '质检不通过',
      dataIndex: 'failedInspection',
      key: 'failedInspection',
      width: 120,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'error' : 'default'}>
          {count} 条
        </Tag>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: VideoInspectionData) => (
        <Button
          type="primary"
          icon={<FileSearchOutlined />}
          onClick={() => handleStartInspection(record)}
          disabled={record.totalAnnotations === 0}
        >
          开始质检
        </Button>
      )
    }
  ];

  // 统计总数
  const totalPending = videos.reduce((sum, v) => sum + v.pendingInspection, 0);
  const totalPassed = videos.reduce((sum, v) => sum + v.passedInspection, 0);
  const totalFailed = videos.reduce((sum, v) => sum + v.failedInspection, 0);
  const totalAll = videos.reduce((sum, v) => sum + v.totalAnnotations, 0);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0, color: 'white' }}>
            质检数据管理
          </Title>
        </Space>
        <Space>
          <Text strong style={{ color: 'white' }}>质检员：{inspectorName}</Text>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic
                title="待质检数据"
                value={totalPending}
                suffix="条"
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic
                title="已质检数据"
                value={totalPassed + totalFailed}
                suffix="条"
                valueStyle={{ color: '#1890ff' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic
                title="质检通过"
                value={totalPassed}
                suffix="条"
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false}>
              <Statistic
                title="质检不通过"
                value={totalFailed}
                suffix="条"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 视频列表 */}
        <Card
          title={
            <Space>
              <FileSearchOutlined style={{ color: '#1890ff' }} />
              <span>选择视频进行质检</span>
              <Tag color="blue">{videos.length} 个视频</Tag>
            </Space>
          }
          bordered={false}
        >
          <Table
            columns={columns}
            dataSource={videos}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个视频`
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Content>
    </Layout>
  );
}

