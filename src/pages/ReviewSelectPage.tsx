import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Collapse
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  UserOutlined,
  VideoCameraOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;

interface AnnotatorData {
  annotatorName: string;
  totalAnnotations: number;
  reviewedCount: number;
  pendingCount: number;
  reviewers: string[]; // 复检人列表
}

interface VideoWithAnnotators {
  videoId: string;
  videoName: string;
  subject: string;
  annotators: AnnotatorData[];
}

export default function ReviewSelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [videoList, setVideoList] = useState<VideoWithAnnotators[]>([]);

  useEffect(() => {
    loadVideoAndAnnotators();
  }, []);

  const loadVideoAndAnnotators = async () => {
    setLoading(true);
    try {
      const { getVideos, getAllAnnotations } = await import('../api/database');
      
      // 获取所有视频和标注数据
      const [videos, allAnnotations] = await Promise.all([
        getVideos(),
        getAllAnnotations()
      ]);

      // 按视频和标注人分组统计
      const videoMap = new Map<string, VideoWithAnnotators>();

      allAnnotations.forEach(annotation => {
        const videoId = annotation.videoId;
        const annotator = annotation.annotator || '未知标注员';
        const reviewer = annotation.reviewer; // 获取复检人
        
        if (!videoMap.has(videoId)) {
          const video = videos.find(v => v.id === videoId);
          videoMap.set(videoId, {
            videoId,
            videoName: video?.name || videoId,
            subject: video?.subject || '未知',
            annotators: []
          });
        }

        const videoData = videoMap.get(videoId)!;
        let annotatorData = videoData.annotators.find(a => a.annotatorName === annotator);

        if (!annotatorData) {
          annotatorData = {
            annotatorName: annotator,
            totalAnnotations: 0,
            reviewedCount: 0,
            pendingCount: 0,
            reviewers: []
          };
          videoData.annotators.push(annotatorData);
        }

        annotatorData.totalAnnotations++;
        if (annotation.reviewStatus === true) {
          annotatorData.reviewedCount++;
          // 添加复检人到列表（去重）
          if (reviewer && !annotatorData.reviewers.includes(reviewer)) {
            annotatorData.reviewers.push(reviewer);
          }
        } else {
          annotatorData.pendingCount++;
        }
      });

      const result = Array.from(videoMap.values()).filter(v => v.annotators.length > 0);
      setVideoList(result);
      message.success(`加载了 ${result.length} 个视频的标注数据`);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (videoId: string, videoName: string, annotatorName: string) => {
    navigate('/review', {
      state: {
        videoId,
        videoName,
        annotatorName
      }
    });
  };

  const columns = [
    {
      title: '标注人',
      dataIndex: 'annotatorName',
      key: 'annotatorName',
      width: 150,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '总标注数',
      dataIndex: 'totalAnnotations',
      key: 'totalAnnotations',
      width: 120,
      align: 'center' as const,
      render: (count: number) => <Text>{count} 条</Text>
    },
    {
      title: '已复检',
      dataIndex: 'reviewedCount',
      key: 'reviewedCount',
      width: 120,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'success' : 'default'}>
          {count} 条
        </Tag>
      )
    },
    {
      title: '待复检',
      dataIndex: 'pendingCount',
      key: 'pendingCount',
      width: 120,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'orange' : 'default'}>
          {count} 条
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: AnnotatorData, index: number) => {
        // 获取当前视频信息（从 Collapse 的 activeKey 中获取）
        const videoData = videoList[Math.floor(index / 100)]; // 简化处理，实际需要更精确的方式
        return (
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
          >
            开始复检
          </Button>
        );
      }
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center'
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
            产品复检 - 选择视频和标注人
          </Title>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card
          title={
            <Space>
              <VideoCameraOutlined style={{ color: '#1890ff' }} />
              <span>视频列表</span>
              <Tag color="blue">{videoList.length} 个视频</Tag>
            </Space>
          }
          bordered={false}
          loading={loading}
        >
          <Collapse accordion>
            {videoList.map((video) => (
              <Panel
                header={
                  <Space size="large">
                    <Text strong style={{ minWidth: 250 }}>{video.videoName}</Text>
                    <Tag color="blue">{video.subject}</Tag>
                    <Tag color="purple">{video.annotators.length} 位标注员</Tag>
                    <Tag color="orange">
                      {video.annotators.reduce((sum, a) => sum + a.totalAnnotations, 0)} 条标注
                    </Tag>
                  </Space>
                }
                key={video.videoId}
              >
                <Table
                  columns={[
                    {
                      title: '标注人',
                      dataIndex: 'annotatorName',
                      key: 'annotatorName',
                      width: 150,
                      render: (text: string) => (
                        <Space>
                          <UserOutlined />
                          <Text strong>{text}</Text>
                        </Space>
                      )
                    },
                    {
                      title: '总标注数',
                      dataIndex: 'totalAnnotations',
                      key: 'totalAnnotations',
                      width: 120,
                      align: 'center' as const,
                      render: (count: number) => <Text>{count} 条</Text>
                    },
                    {
                      title: '已复检',
                      dataIndex: 'reviewedCount',
                      key: 'reviewedCount',
                      width: 120,
                      align: 'center' as const,
                      render: (count: number) => (
                        <Tag color={count > 0 ? 'success' : 'default'}>
                          {count} 条
                        </Tag>
                      )
                    },
                    {
                      title: '待复检',
                      dataIndex: 'pendingCount',
                      key: 'pendingCount',
                      width: 120,
                      align: 'center' as const,
                      render: (count: number) => (
                        <Tag color={count > 0 ? 'orange' : 'default'}>
                          {count} 条
                        </Tag>
                      )
                    },
                    {
                      title: '复检人',
                      dataIndex: 'reviewers',
                      key: 'reviewers',
                      width: 200,
                      render: (reviewers: string[]) => (
                        <Space wrap>
                          {reviewers.length > 0 ? (
                            reviewers.map(reviewer => (
                              <Tag key={reviewer} color="cyan" icon={<CheckCircleOutlined />}>
                                {reviewer}
                              </Tag>
                            ))
                          ) : (
                            <Text type="secondary">-</Text>
                          )}
                        </Space>
                      )
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 120,
                      align: 'center' as const,
                      render: (_: any, record: AnnotatorData) => (
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => handleReview(video.videoId, video.videoName, record.annotatorName)}
                        >
                          开始复检
                        </Button>
                      )
                    }
                  ]}
                  dataSource={video.annotators}
                  rowKey="annotatorName"
                  pagination={false}
                  size="small"
                />
              </Panel>
            ))}
          </Collapse>
        </Card>
      </Content>
    </Layout>
  );
}

