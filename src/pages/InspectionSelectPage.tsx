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
  Col,
  Modal,
  InputNumber,
  Slider
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
  
  // 抽样比例设置
  const [isSampleModalVisible, setIsSampleModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoInspectionData | null>(null);
  const [samplePercentage, setSamplePercentage] = useState(20); // 默认20%

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { getVideos } = await import('../api/database');
      const { supabase } = await import('../api/supabase');
      const allVideos = await getVideos();
      
      // 获取每个视频的标注统计
      const videoStats: VideoInspectionData[] = [];
      
      for (const video of allVideos) {
        // 过滤掉已完成复检的视频（is_completed = true）
        if (video.is_completed === true) {
          console.log(`⏭️ 跳过已完成复检的视频: ${video.name}`);
          continue;
        }
        
        // 直接从数据库查询该视频的所有标注数据（排除已复检完成的数据）
        // 使用分页查询避免1000条限制
        let allAnnotations: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('annotations')
            .select('id, video_id, sentence_no, annotator, human_annotated_text, inspector, is_qualified, review_status, updated_at, created_at')
            .eq('video_id', video.id)
            .not('human_annotated_text', 'is', null)
            .neq('human_annotated_text', '')
            .is('review_status', null)  // 排除已复检完成的数据
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (error) {
            console.error(`查询视频 ${video.name} 的统计数据失败（第${page + 1}页）:`, error);
            break;
          }
          
          if (data && data.length > 0) {
            allAnnotations = allAnnotations.concat(data);
          }
          
          hasMore = data && data.length === pageSize;
          page++;
        }
        
        if (allAnnotations.length > 0) {
          // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
          // 优先保留有质检状态的数据，如果都有质检状态则保留最新的
          const deduplicatedMap = new Map<string, any>();
          
          // 先按是否有质检状态和时间排序：有质检状态的排在后面，然后按时间降序（最新的在后面）
          // 这样遍历时会优先保留有质检状态的，如果都有或都没有，则保留最新的
          allAnnotations.sort((a, b) => {
            const aHasInspection = a.inspector && a.inspector.trim() !== '' && 
                                  a.is_qualified !== null && a.is_qualified !== undefined;
            const bHasInspection = b.inspector && b.inspector.trim() !== '' && 
                                  b.is_qualified !== null && b.is_qualified !== undefined;
            
            // 先按是否有质检状态排序（有质检状态的排在后面）
            if (aHasInspection !== bHasInspection) {
              return aHasInspection ? 1 : -1;
            }
            
            // 都有或都没有质检状态，按时间降序排序（最新的排在后面）
            const timeA = a.updated_at || a.created_at || '';
            const timeB = b.updated_at || b.created_at || '';
            return timeB.localeCompare(timeA);
          });
          
          allAnnotations.forEach(ann => {
            const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
            const existing = deduplicatedMap.get(key);
            
            if (!existing) {
              deduplicatedMap.set(key, ann);
            } else {
              // 判断是否有质检状态：inspector 不为空且 is_qualified 不为 null
              const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && 
                                            existing.is_qualified !== null && existing.is_qualified !== undefined;
              const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && 
                                          ann.is_qualified !== null && ann.is_qualified !== undefined;
              
              if (currentHasInspection && !existingHasInspection) {
                // 当前数据有质检状态，旧数据没有，保留当前数据
                deduplicatedMap.set(key, ann);
              } else if (existingHasInspection && !currentHasInspection) {
                // 旧数据有质检状态，当前数据没有，保留旧数据（不做任何操作）
              } else {
                // 都有或都没有质检状态，保留最新的（因为已经排序，当前数据更新）
                deduplicatedMap.set(key, ann);
              }
            }
          });
          
          const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
          
          // 统计去重情况
          const duplicateKeys = new Map<string, number>();
          allAnnotations.forEach(ann => {
            const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
            duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
          });
          const duplicateCount = Array.from(duplicateKeys.values()).filter(count => count > 1).length;
          const totalDuplicates = Array.from(duplicateKeys.values()).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
          
          // 计算统计数据（只统计有 human_annotated_text 的数据）
          const validAnnotations = deduplicatedAnnotations.filter(item => 
            item.human_annotated_text && item.human_annotated_text.trim() !== ''
          );
          
          const pendingCount = validAnnotations.filter(item => {
            const hasHumanText = item.human_annotated_text && item.human_annotated_text.trim() !== '';
            const notInspected = !item.inspector || item.inspector.trim() === '';
            return hasHumanText && notInspected;
          }).length;
          
          const passedCount = validAnnotations.filter(item => 
            item.is_qualified === true && item.inspector && item.inspector.trim() !== ''
          ).length;
          
          const failedCount = validAnnotations.filter(item => 
            item.is_qualified === false && item.inspector && item.inspector.trim() !== ''
          ).length;
          
          // 统计去重后保留的数据中，有多少是有质检状态的
          const deduplicatedWithInspection = deduplicatedAnnotations.filter(item => {
            const hasInspection = item.inspector && item.inspector.trim() !== '' && 
                                 item.is_qualified !== null && item.is_qualified !== undefined;
            return hasInspection;
          }).length;
          
          console.log(`📊 视频 ${video.name} 统计数据（去重后）:`, {
            原始数量: allAnnotations.length,
            去重后数量: deduplicatedAnnotations.length,
            去除了重复数据: totalDuplicates,
            有重复的key数量: duplicateCount,
            去重后保留的数据中有质检状态的: deduplicatedWithInspection,
            有效标注数: validAnnotations.length,
            待质检: pendingCount,
            已质检: passedCount + failedCount,
            通过: passedCount,
            不通过: failedCount
          });
          
          // 如果去重后仍然有大量待质检数据，输出警告
          if (pendingCount > 0 && duplicateCount > 0) {
            console.warn(`⚠️ 视频 ${video.name} 去重后仍有 ${pendingCount} 条待质检数据，可能存在数据问题`);
          }
          
          videoStats.push({
            id: video.id,
            videoName: video.name,
            subject: video.subject || '未知',
            totalAnnotations: validAnnotations.length,
            pendingInspection: pendingCount,
            passedInspection: passedCount,
            failedInspection: failedCount,
            uploadTime: video.created_at || ''
          });
        }
      }
      
      // 按上传时间降序排序（最新的在最上面）
      videoStats.sort((a, b) => {
        const timeA = a.uploadTime || '';
        const timeB = b.uploadTime || '';
        return timeB.localeCompare(timeA);
      });
      
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
    // 打开抽样比例设置弹窗
    setSelectedVideo(video);
    setIsSampleModalVisible(true);
  };

  const handleConfirmSample = () => {
    if (!selectedVideo) return;
    
    if (samplePercentage <= 0 || samplePercentage > 100) {
      message.error('抽样比例必须在 1% - 100% 之间');
      return;
    }
    
    // 跳转到质检管理页面，传递抽样比例
    navigate('/inspection-manage', {
      state: {
        inspectorName,
        selectedVideoId: selectedVideo.id,
        videoName: selectedVideo.videoName,
        samplePercentage // 传递抽样比例
      }
    });
    
    setIsSampleModalVisible(false);
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
            <Card variant="borderless">
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
            <Card variant="borderless">
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
            <Card variant="borderless">
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
            <Card variant="borderless">
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
          variant="borderless"
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

      {/* 抽样比例设置弹窗 */}
      <Modal
        title="设置抽样比例"
        open={isSampleModalVisible}
        onOk={handleConfirmSample}
        onCancel={() => setIsSampleModalVisible(false)}
        width={500}
        okText="开始质检"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: 20, fontSize: 14, color: '#666' }}>
            <strong>视频名称：</strong>{selectedVideo?.videoName}
          </p>
          <p style={{ marginBottom: 20, fontSize: 14, color: '#666' }}>
            <strong>待质检数据：</strong>{selectedVideo?.pendingInspection || 0} 条
          </p>
          
          <div style={{ marginBottom: 30 }}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 500 }}>抽样比例：</span>
              <InputNumber
                min={1}
                max={100}
                value={samplePercentage}
                onChange={(value) => setSamplePercentage(value || 20)}
                formatter={value => `${value}%`}
                parser={value => Number(value?.replace('%', '') || 0)}
                style={{ width: 100, marginLeft: 10 }}
              />
            </div>
            
            <Slider
              min={1}
              max={100}
              value={samplePercentage}
              onChange={(value) => setSamplePercentage(value)}
              marks={{
                10: '10%',
                20: '20%',
                30: '30%',
                50: '50%',
                100: '100%'
              }}
              style={{ marginTop: 20 }}
            />
          </div>
          
          <div style={{ 
            padding: '12px 16px', 
            background: '#f0f5ff', 
            borderLeft: '3px solid #1890ff',
            borderRadius: 4 
          }}>
            <p style={{ margin: 0, fontSize: 14, color: '#1890ff' }}>
              <strong>预计抽样：</strong>
              约 {Math.max(1, Math.ceil((selectedVideo?.pendingInspection || 0) * samplePercentage / 100))} 条数据
            </p>
          </div>
          
          <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
            💡 系统将从待质检数据中随机抽取指定比例的数据进行质检
          </p>
        </div>
      </Modal>
    </Layout>
  );
}

