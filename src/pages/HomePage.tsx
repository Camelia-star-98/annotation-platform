import { useState, useEffect } from 'react';
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
  Tag
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  BarChartOutlined,
  DatabaseOutlined
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

  // 加载已完成的视频列表
  useEffect(() => {
    loadCompletedVideos();
  }, []);

  const loadCompletedVideos = async () => {
    setLoading(true);
    try {
      const { getVideos } = await import('../api/database');
      const allVideos = await getVideos();
      
      // 只显示已完成所有流程的视频
      const completed = allVideos.filter(video => video.is_completed === true);
      
      setCompletedVideos(completed);
      console.log('📋 已完成视频列表:', completed);
    } catch (error) {
      console.error('加载视频列表失败:', error);
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '选择',
      key: 'select',
      width: 60,
      render: (_: any, record: VideoInfo) => (
        <Checkbox
          checked={selectedVideos.includes(record.id)}
          onChange={(e) => handleSelectVideo(record.id, e.target.checked)}
        />
      )
    },
    {
      title: '视频编号',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      ellipsis: true
    },
    {
      title: '视频名称',
      dataIndex: 'name',
      key: 'name',
      width: 250
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text: string) => <Tag color="blue">{text || '未知'}</Tag>
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
                <Tag color="success">{completedVideos.length} 个视频</Tag>
              </Space>
            }
            extra={
              <Space>
                <span>已选择 {selectedVideos.length} 个视频</span>
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
              这些视频已完成：教研标注 → 抽样质检 → 产品复检，可进行结果分析
            </Typography.Paragraph>
            <Table
              columns={columns}
              dataSource={completedVideos}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个视频`
              }}
              locale={{
                emptyText: '暂无已完成的视频'
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

