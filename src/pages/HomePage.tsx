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
  Tag,
  Select
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  SwapOutlined
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
      const { supabase } = await import('../api/supabase');
      
      // 1. 获取所有视频
      const allVideos = await getVideos();
      console.log('🎬 所有视频数量:', allVideos.length);
      
      // 2. 直接在数据库查询有已复检数据的视频ID和标注人（性能优化）
      const { data: reviewedData, error } = await supabase
        .from('annotations')
        .select('video_id, annotator')
        .eq('review_status', true)
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .neq('annotator', 'unknown');
      
      if (error) {
        console.error('查询已复检数据失败:', error);
        message.error('加载失败');
        setLoading(false);
        return;
      }
      
      console.log('📊 查询到的已复检数据记录数:', reviewedData?.length || 0);
      
      // 3. 统计每个视频的已复检标注人数量
      const videoAnnotatorMap = new Map<string, Set<string>>();
      reviewedData?.forEach(item => {
        if (!videoAnnotatorMap.has(item.video_id)) {
          videoAnnotatorMap.set(item.video_id, new Set());
        }
        videoAnnotatorMap.get(item.video_id)!.add(item.annotator);
      });
      
      console.log('✅ 有已复检数据的视频ID数量:', videoAnnotatorMap.size);
      
      // 4. 筛选出有已复检数据的视频，并添加已复检标注人数量
      const completed = allVideos
        .filter(video => videoAnnotatorMap.has(video.id))
        .map(video => ({
          ...video,
          completedAnnotators: videoAnnotatorMap.get(video.id)!.size
        }));
      
      console.log('✅ 有已复检数据的视频数量:', completed.length);
      setCompletedVideos(completed);
      
      if (completed.length === 0) {
        console.warn('⚠️ 没有找到有已复检数据的视频');
      }
    } catch (error) {
      console.error('加载视频列表失败:', error);
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
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
        // 如果视频名称为空、只有ID或者是annotation_only_开头的，显示"无"
        if (!record.name || record.name === record.id || record.name.startsWith('annotation_only_')) {
          return <span style={{ color: '#999' }}>无</span>;
        }
        // 标注文件名通常是：视频名称_标注数据.xlsx
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
    if (selectedVideos.length !== 2) {
      message.warning('请选择2个视频进行对比');
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
                <Tag color="success">{completedVideos.length} 个视频</Tag>
              </Space>
            }
            extra={
              <Space>
                <span>已选择 {selectedVideos.length} 个视频</span>
                <Button
                  type="default"
                  icon={<SwapOutlined />}
                  onClick={handleComparison}
                  disabled={selectedVideos.length !== 2}
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
              这些视频已完成：教研标注 → 抽样质检 → 产品复检，可进行结果分析或对比（选择2个视频）
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

