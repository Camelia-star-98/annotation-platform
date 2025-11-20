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
  Collapse,
  Tabs,
  Popconfirm
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  UserOutlined,
  VideoCameraOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;

interface AnnotatorData {
  annotatorName: string;
  totalAnnotations: number;
  reviewedCount: number;
  pendingCount: number;
  unannotatedCount: number; // 未标注数量
  reviewers: string[]; // 复检人列表
  inspectors: string[]; // 质检人列表
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
  const [pendingList, setPendingList] = useState<VideoWithAnnotators[]>([]); // 待复检列表
  const [completedList, setCompletedList] = useState<VideoWithAnnotators[]>([]); // 已复检列表

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
        // 处理标注人：如果为空、null、'unknown'或'未知标注员'，跳过这条数据（不统计）
        const annotator = annotation.annotator;
        if (!annotator || annotator.trim() === '' || annotator === 'unknown' || annotator === '未知标注员') {
          return; // 跳过没有有效标注人的数据
        }
        const reviewer = annotation.reviewer; // 获取复检人
        const inspector = annotation.inspector; // 获取质检人
        // 判断是否已标注：有人工标注文本即为已标注（不依赖status字段）
        const hasHumanText = annotation.humanAnnotatedText && annotation.humanAnnotatedText.trim() !== '';
        const isAnnotated = hasHumanText; // 是否已标注
        
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
            unannotatedCount: 0,
            reviewers: [],
            inspectors: []
          };
          videoData.annotators.push(annotatorData);
        }

        annotatorData.totalAnnotations++;
        
        // 只统计已标注的数据
        if (isAnnotated) {
          if (annotation.reviewStatus === true) {
            annotatorData.reviewedCount++;
            // 添加复检人到列表（去重）
            if (reviewer && !annotatorData.reviewers.includes(reviewer)) {
              annotatorData.reviewers.push(reviewer);
            }
          } else {
            annotatorData.pendingCount++;
          }
        } else {
          // 未标注的数据
          annotatorData.unannotatedCount++;
        }
        
        // 添加质检人到列表（去重）
        if (inspector && !annotatorData.inspectors.includes(inspector)) {
          annotatorData.inspectors.push(inspector);
        }
      });

      const result = Array.from(videoMap.values()).filter(v => v.annotators.length > 0);
      
      console.log('📊 视频和标注人统计:', result.map(v => ({
        videoName: v.videoName,
        annotators: v.annotators.map(a => ({
          name: a.annotatorName,
          total: a.totalAnnotations,
          reviewed: a.reviewedCount,
          pending: a.pendingCount,
          unannotated: a.unannotatedCount,
          reviewers: a.reviewers
        }))
      })));
      
      // 分离待复检和已复检
      const pending: VideoWithAnnotators[] = [];
      const completed: VideoWithAnnotators[] = [];
      
      console.log('📊 开始分离待复检和已复检，总视频数:', result.length);
      
      result.forEach(video => {
        console.log(`📹 处理视频: ${video.videoName}`);
        video.annotators.forEach(a => {
          console.log(`  - 标注人: ${a.annotatorName}, 待复检: ${a.pendingCount}, 已复检: ${a.reviewedCount}`);
        });
        
        // 待复检：有已标注但未复检的数据（排除未标注的）
        const pendingAnnotators = video.annotators.filter(a => 
          a.pendingCount > 0 && (a.pendingCount + a.reviewedCount) > 0
        );
        // 已复检：所有已标注的数据都已复检完成
        const completedAnnotators = video.annotators.filter(a => 
          a.pendingCount === 0 && a.reviewedCount > 0
        );
        
        console.log(`  ✅ 已复检标注人数: ${completedAnnotators.length}`, completedAnnotators.map(a => a.annotatorName));
        console.log(`  ⏳ 待复检标注人数: ${pendingAnnotators.length}`, pendingAnnotators.map(a => a.annotatorName));
        
        if (pendingAnnotators.length > 0) {
          pending.push({
            ...video,
            annotators: pendingAnnotators
          });
        }
        
        if (completedAnnotators.length > 0) {
          completed.push({
            ...video,
            annotators: completedAnnotators
          });
        }
      });
      
      console.log('⏳ 待复检列表:', pending);
      console.log('✅ 已复检列表:', completed);
      
      setPendingList(pending);
      setCompletedList(completed);
      
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

  // 删除标注人的所有标注数据
  const handleDelete = async (videoId: string, videoName: string, annotatorName: string) => {
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('🗑️ 准备删除标注数据:', {
        videoId,
        videoName,
        annotatorName
      });

      // 删除该视频该标注人的所有标注数据
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('video_id', videoId)
        .eq('annotator', annotatorName);

      if (error) {
        console.error('❌ 删除失败:', error);
        message.error('删除失败');
        return;
      }

      message.success(`已删除 ${annotatorName} 在视频"${videoName}"中的所有标注数据`);
      
      // 重新加载数据
      loadVideoAndAnnotators();
    } catch (error) {
      console.error('❌ 删除异常:', error);
      message.error('删除失败');
    }
  };

  // 渲染视频列表（可复用组件）
  const renderVideoList = (videoList: VideoWithAnnotators[]) => {
    if (videoList.length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          暂无数据
        </div>
      );
    }

    return (
      <Collapse accordion>
        {videoList.map((video) => (
          <Panel
            header={
              <Space size="large">
                <Text strong style={{ minWidth: 250 }}>{video.videoName}</Text>
                <Tag color="blue">{video.subject}</Tag>
                <Tag color="purple">{video.annotators.length} 位标注员</Tag>
                <Tag color="green">
                  {video.annotators.reduce((sum, a) => sum + a.reviewedCount, 0)} 已复检
                </Tag>
                <Tag color="orange">
                  {video.annotators.reduce((sum, a) => sum + a.pendingCount, 0)} 待复检
                </Tag>
                {video.annotators.reduce((sum, a) => sum + a.unannotatedCount, 0) > 0 && (
                  <Tag color="red" icon={<ClockCircleOutlined />}>
                    {video.annotators.reduce((sum, a) => sum + a.unannotatedCount, 0)} 未标注
                  </Tag>
                )}
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
                  title: '未标注',
                  dataIndex: 'unannotatedCount',
                  key: 'unannotatedCount',
                  width: 120,
                  align: 'center' as const,
                  render: (count: number) => (
                    count > 0 ? (
                      <Tag color="red" icon={<ClockCircleOutlined />}>
                        {count} 条
                      </Tag>
                    ) : (
                      <Tag color="default">0 条</Tag>
                    )
                  )
                },
                {
                  title: '质检人',
                  dataIndex: 'inspectors',
                  key: 'inspectors',
                  width: 200,
                  render: (inspectors: string[]) => (
                    <Space wrap>
                      {inspectors.length > 0 ? (
                        inspectors.map(inspector => (
                          <Tag key={inspector} color="blue" icon={<UserOutlined />}>
                            {inspector}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">-</Text>
                      )}
                    </Space>
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
                  width: 200,
                  align: 'center' as const,
                  render: (_: any, record: AnnotatorData) => (
                    <Space>
                      <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() => handleReview(video.videoId, video.videoName, record.annotatorName)}
                      >
                        开始复检
                      </Button>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除标注人"${record.annotatorName}"的所有标注数据吗？此操作不可恢复！`}
                        onConfirm={() => handleDelete(video.videoId, video.videoName, record.annotatorName)}
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
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
    );
  };

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
        <Card bordered={false} loading={loading}>
          <Tabs
            defaultActiveKey="pending"
            size="large"
            items={[
              {
                key: 'pending',
                label: (
                  <Space>
                    <ClockCircleOutlined />
                    <span>待复检</span>
                    <Tag color="orange">{pendingList.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(pendingList)
              },
              {
                key: 'completed',
                label: (
                  <Space>
                    <CheckCircleOutlined />
                    <span>已复检</span>
                    <Tag color="success">{completedList.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(completedList)
              }
            ]}
          />
        </Card>
      </Content>
    </Layout>
  );
}

