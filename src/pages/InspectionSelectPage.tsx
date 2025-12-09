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
  Slider,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined
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
  annotators: string[]; // 标注人列表
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
      const { supabase } = await import('../api/supabase');
      
      // 🚀 性能优化：一次性查询所有数据，使用内存中的操作而不是多次数据库查询
      console.time('⏱️ 加载视频列表总耗时');
      
      // 1. 查询所有未完成复检的视频（is_completed != true）
      console.time('⏱️ 查询视频列表');
      const { data: allVideos, error: videosError } = await supabase
        .from('videos')
        .select('id, name, subject, created_at, is_completed, total_sentences')
        .or('is_completed.is.null,is_completed.eq.false')
        .order('created_at', { ascending: false });
      console.timeEnd('⏱️ 查询视频列表');
      
      if (videosError) {
        throw videosError;
      }
      
      if (!allVideos || allVideos.length === 0) {
        setVideos([]);
        message.info('暂无视频数据');
        return;
      }
      
      // 2. 🚀 使用 RPC 函数一次性查询所有标注数据（自动过滤空标注人）
      console.time('⏱️ 查询所有标注数据 (RPC)');
      const videoIds = allVideos.map(v => v.id);
      console.log('🔍 准备查询标注数据，视频ID列表:', videoIds);
      console.log('🔍 视频数量:', videoIds.length);
      
      const { data: allAnnotations, error: annotationsError } = await supabase
        .rpc('get_all_annotations');
      
      // 过滤出当前视频列表相关的标注数据
      const filteredAnnotations = allAnnotations?.filter(ann => videoIds.includes(ann.video_id)) || [];
      console.timeEnd('⏱️ 查询所有标注数据 (RPC)');
      
      console.log('🔍 查询到的标注数据总数:', filteredAnnotations.length);
      
      if (annotationsError) {
        throw annotationsError;
      }
      
      // 3. 在内存中按视频分组并统计
      console.time('⏱️ 内存中分组统计');
      const videoMap = new Map<string, any[]>();
      filteredAnnotations.forEach(ann => {
        if (!videoMap.has(ann.video_id)) {
          videoMap.set(ann.video_id, []);
        }
        videoMap.get(ann.video_id)!.push(ann);
      });
      
      console.log('🔍 videoMap 中的视频数量:', videoMap.size);
      console.log('🔍 videoMap 中的视频ID:', Array.from(videoMap.keys()));
      
      const videoStats: VideoInspectionData[] = [];
      
      for (const video of allVideos) {
        const annotations = videoMap.get(video.id) || [];
        
        console.log(`🔍 视频 ${video.name} (ID: ${video.id}) 的标注数量:`, annotations.length);
        
        if (annotations.length === 0) {
          continue; // 跳过没有标注数据的视频
        }
        
        // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
        // 使用 Map 进行去重，key = video_id_sentence_no_annotator
        const deduplicatedMap = new Map<string, any>();
        
        annotations.forEach(ann => {
          const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
          const existing = deduplicatedMap.get(key);
          
          if (!existing) {
            deduplicatedMap.set(key, ann);
          } else {
            // 如果已存在，优先保留有质检状态的数据
            const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && 
                                          existing.is_qualified !== null && existing.is_qualified !== undefined;
            const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && 
                                        ann.is_qualified !== null && ann.is_qualified !== undefined;
            
            if (currentHasInspection && !existingHasInspection) {
              deduplicatedMap.set(key, ann);
            }
            // 否则保留已有的（first-wins策略）
          }
        });
        
        const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
        
        // 计算统计数据
        // 🔧 待质检数量 = 所有去重后的数据（移除过滤条件，与总数一致）
        const pendingCount = deduplicatedAnnotations.filter(item => 
          (!item.inspector || item.inspector.trim() === '')
        ).length;
        
        // 已通过和未通过的数据
        const passedCount = deduplicatedAnnotations.filter(item => 
          item.is_qualified === true && item.inspector && item.inspector.trim() !== ''
        ).length;
        
        const failedCount = deduplicatedAnnotations.filter(item => 
          item.is_qualified === false && item.inspector && item.inspector.trim() !== ''
        ).length;
        
        // 收集所有标注人姓名（去重）
        const annotatorsSet = new Set<string>();
        deduplicatedAnnotations.forEach(item => {
          if (item.annotator && item.annotator.trim() !== '' && item.annotator !== 'unknown') {
            annotatorsSet.add(item.annotator.trim());
          }
        });
        const annotators = Array.from(annotatorsSet).sort(); // 按字母排序
        
        videoStats.push({
          id: video.id,
          videoName: video.name,
          subject: video.subject || '未知',
          totalAnnotations: deduplicatedAnnotations.length, // 使用去重后的实际数据量
          pendingInspection: pendingCount,
          passedInspection: passedCount,
          failedInspection: failedCount,
          uploadTime: video.created_at || '',
          annotators: annotators // 添加标注人列表
        });
      }
      console.timeEnd('⏱️ 内存中分组统计');
      console.timeEnd('⏱️ 加载视频列表总耗时');
      
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
      title: '标注人',
      dataIndex: 'annotators',
      key: 'annotators',
      width: 150,
      render: (annotators: string[]) => {
        if (!annotators || annotators.length === 0) {
          return <Tag color="default">无标注人</Tag>;
        }
        // 如果标注人较多，只显示前2个，其余用省略号表示
        if (annotators.length <= 2) {
          return (
            <Space size={4} wrap>
              {annotators.map(name => (
                <Tag key={name} color="green">{name}</Tag>
              ))}
            </Space>
          );
        }
        return (
          <Tooltip title={annotators.join(', ')}>
            <Space size={4}>
              <Tag color="green">{annotators[0]}</Tag>
              <Tag color="green">{annotators[1]}</Tag>
              <Tag color="default">+{annotators.length - 2}</Tag>
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: () => (
        <Space>
          <span>总标注数</span>
          <Tooltip title="去重后的实际标注数据量（按 video_id + sentence_no + annotator 去重）">
            <QuestionCircleOutlined style={{ color: '#1890ff', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'totalAnnotations',
      key: 'totalAnnotations',
      width: 150,
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
        {/* 数据过滤说明 */}
        <Card 
          style={{ marginBottom: 16, background: '#e6f7ff', borderColor: '#91d5ff' }}
          size="small"
        >
          <Space direction="vertical" size="small">
            <Text strong style={{ color: '#1890ff' }}>
              <QuestionCircleOutlined /> 数据说明
            </Text>
            <Text style={{ color: '#595959' }}>
              本页面显示所有视频的标注数据。
              <span style={{ color: '#52c41a', fontWeight: 500 }}> ✓ 总标注数 </span> 为去重后的实际数据量。
              <br />
              <span style={{ color: '#faad14', fontWeight: 500 }}> ✓ 待质检 </span> = 尚未分配质检员的数据。
              <span style={{ color: '#1890ff', fontWeight: 500 }}> ✓ 已质检 </span> = 已分配质检员的数据（包括通过和不通过）。
            </Text>
          </Space>
        </Card>

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

