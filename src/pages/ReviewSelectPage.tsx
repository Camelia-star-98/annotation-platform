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
  Popconfirm,
  Checkbox
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
  lastReviewTime?: string; // 最后复检时间
}

interface VideoWithAnnotators {
  videoId: string;
  videoName: string;
  subject: string;
  annotators: AnnotatorData[];
}

export default function ReviewSelectPage() {
  console.log('✨ ReviewSelectPage 组件加载 - 版本 3.0 (稳定版)');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // 存储所有数据（不分页）
  const [allPendingVideos, setAllPendingVideos] = useState<VideoWithAnnotators[]>([]);
  const [allCompletedVideos, setAllCompletedVideos] = useState<VideoWithAnnotators[]>([]);
  
  // 分页状态（仅用于前端显示）
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const pageSize = 5; // 每页显示5个视频
  
  // 选中状态（跨页保留）
  const [selectedPendingVideoIds, setSelectedPendingVideoIds] = useState<Set<string>>(new Set());
  const [selectedCompletedVideoIds, setSelectedCompletedVideoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllPendingVideos();
    loadAllCompletedVideos();
  }, []);

  // 切换视频选中状态
  const toggleVideoSelection = (videoId: string, isPending: boolean) => {
    if (isPending) {
      const newSelected = new Set(selectedPendingVideoIds);
      if (newSelected.has(videoId)) {
        newSelected.delete(videoId);
      } else {
        newSelected.add(videoId);
      }
      setSelectedPendingVideoIds(newSelected);
    } else {
      const newSelected = new Set(selectedCompletedVideoIds);
      if (newSelected.has(videoId)) {
        newSelected.delete(videoId);
      } else {
        newSelected.add(videoId);
      }
      setSelectedCompletedVideoIds(newSelected);
    }
  };
  
  // 全选/取消全选当前页（跨页保留选中状态）
  const toggleSelectAll = (isPending: boolean) => {
    // 获取所有数据和当前页码
    const allVideos = isPending ? allPendingVideos : allCompletedVideos;
    const currentPage = isPending ? pendingPage : completedPage;
    
    // 计算当前页的视频切片
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const currentPageVideos = allVideos.slice(startIdx, endIdx);
    
    const currentSelected = isPending ? selectedPendingVideoIds : selectedCompletedVideoIds;
    const setSelected = isPending ? setSelectedPendingVideoIds : setSelectedCompletedVideoIds;
    
    const currentPageVideoIds = currentPageVideos.map(v => v.videoId);
    const allSelected = currentPageVideoIds.every(id => currentSelected.has(id));
    
    const newSelected = new Set(currentSelected);
    if (allSelected) {
      // 取消全选当前页
      currentPageVideoIds.forEach(id => newSelected.delete(id));
    } else {
      // 全选当前页
      currentPageVideoIds.forEach(id => newSelected.add(id));
    }
    setSelected(newSelected);
  };
  
  // 清空选中
  const clearSelection = (isPending: boolean) => {
    if (isPending) {
      setSelectedPendingVideoIds(new Set());
    } else {
      setSelectedCompletedVideoIds(new Set());
    }
  };

  // 加载待复检视频（一次性加载所有数据）
  const loadAllPendingVideos = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('📊 加载所有待复检视频...');
      
      // 1. 查询所有有标注的数据（video_id 去重）
      const { data: videoIds, error: videoError } = await supabase
        .from('annotations')
        .select('video_id')
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .neq('annotator', 'unknown')
        .not('human_annotated_text', 'is', null)
        .neq('human_annotated_text', '');
      
      if (videoError) {
        console.error('查询视频ID失败:', videoError);
        message.error('加载失败');
        setLoading(false);
        return;
      }
      
      // 去重视频ID
      const uniqueVideoIds = [...new Set(videoIds?.map(item => item.video_id) || [])];
      console.log('  - 有标注数据的视频总数:', uniqueVideoIds.length);
      
      // 2. 对每个视频统计待复检数据
      const videoStatsPromises = uniqueVideoIds.map(async (videoId) => {
        // 查询该视频的所有标注数据（按标注人分组）
        const { data: annotations, error } = await supabase
          .from('annotations')
          .select('video_id, annotator, human_annotated_text, review_status, reviewer, inspector, updated_at')
          .eq('video_id', videoId)
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown');
        
        if (error || !annotations) return null;
        
        // 按标注人分组统计
        const annotatorMap = new Map<string, AnnotatorData>();
        
        annotations.forEach(ann => {
          const annotator = ann.annotator;
          const hasHumanText = ann.human_annotated_text && ann.human_annotated_text.trim() !== '';
          
          if (!annotatorMap.has(annotator)) {
            annotatorMap.set(annotator, {
              annotatorName: annotator,
              totalAnnotations: 0,
              reviewedCount: 0,
              pendingCount: 0,
              unannotatedCount: 0,
              reviewers: [],
              inspectors: [],
              lastReviewTime: undefined
            });
          }
          
          const annotatorData = annotatorMap.get(annotator)!;
          annotatorData.totalAnnotations++;
          
          if (hasHumanText) {
            if (ann.review_status === true) {
              annotatorData.reviewedCount++;
              if (ann.reviewer && !annotatorData.reviewers.includes(ann.reviewer)) {
                annotatorData.reviewers.push(ann.reviewer);
              }
              if (ann.updated_at) {
                if (!annotatorData.lastReviewTime || ann.updated_at > annotatorData.lastReviewTime) {
                  annotatorData.lastReviewTime = ann.updated_at;
                }
              }
            } else {
              annotatorData.pendingCount++;
            }
          } else {
            annotatorData.unannotatedCount++;
          }
          
          if (ann.inspector && !annotatorData.inspectors.includes(ann.inspector)) {
            annotatorData.inspectors.push(ann.inspector);
          }
        });
        
        // 过滤出有待复检数据的标注人
        const pendingAnnotators = Array.from(annotatorMap.values()).filter(a => 
          a.pendingCount > 0 && (a.pendingCount + a.reviewedCount) > 0
        );
        
        return pendingAnnotators.length > 0 ? { videoId, annotators: pendingAnnotators } : null;
      });
      
      const videoStatsResults = await Promise.all(videoStatsPromises);
      const videosWithPending = videoStatsResults.filter(v => v !== null) as { videoId: string; annotators: AnnotatorData[] }[];
      
      console.log('  - 有待复检数据的视频数量:', videosWithPending.length);
      
      // 3. 获取所有视频详细信息
      const { getVideos } = await import('../api/database');
      const allVideos = await getVideos();
      
      const result: VideoWithAnnotators[] = videosWithPending.map(item => {
        const video = allVideos.find(v => v.id === item.videoId);
        return {
          videoId: item.videoId,
          videoName: video?.name || item.videoId,
          subject: video?.subject || '未知',
          annotators: item.annotators
        };
      });
      
      setAllPendingVideos(result);
      setPendingPage(1); // 重置到第一页
      
      console.log('✅ 所有待复检视频加载完成:', result.length);
    } catch (error) {
      console.error('加载待复检视频失败:', error);
      message.error('加载待复检视频失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载已复检视频（一次性加载所有数据）
  const loadAllCompletedVideos = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('📊 加载所有已复检视频...');
      
      // 1. 查询所有有标注的数据（video_id 去重）
      const { data: videoIds, error: videoError } = await supabase
        .from('annotations')
        .select('video_id')
        .eq('review_status', true)
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .neq('annotator', 'unknown')
        .not('human_annotated_text', 'is', null)
        .neq('human_annotated_text', '');
      
      if (videoError) {
        console.error('查询视频ID失败:', videoError);
        message.error('加载失败');
        setLoading(false);
        return;
      }
      
      // 去重视频ID
      const uniqueVideoIds = [...new Set(videoIds?.map(item => item.video_id) || [])];
      console.log('  - 有已复检数据的视频总数:', uniqueVideoIds.length);
      
      // 2. 对每个视频统计已复检数据
      const videoStatsPromises = uniqueVideoIds.map(async (videoId) => {
        // 查询该视频的所有标注数据（按标注人分组）
        const { data: annotations, error } = await supabase
          .from('annotations')
          .select('video_id, annotator, human_annotated_text, review_status, reviewer, inspector, updated_at')
          .eq('video_id', videoId)
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown');
        
        if (error || !annotations) return null;
        
        // 按标注人分组统计
        const annotatorMap = new Map<string, AnnotatorData>();
        
        annotations.forEach(ann => {
          const annotator = ann.annotator;
          const hasHumanText = ann.human_annotated_text && ann.human_annotated_text.trim() !== '';
          
          if (!annotatorMap.has(annotator)) {
            annotatorMap.set(annotator, {
            annotatorName: annotator,
            totalAnnotations: 0,
            reviewedCount: 0,
            pendingCount: 0,
            unannotatedCount: 0,
            reviewers: [],
            inspectors: [],
            lastReviewTime: undefined
            });
        }

          const annotatorData = annotatorMap.get(annotator)!;
        annotatorData.totalAnnotations++;
        
          if (hasHumanText) {
            if (ann.review_status === true) {
            annotatorData.reviewedCount++;
              if (ann.reviewer && !annotatorData.reviewers.includes(ann.reviewer)) {
                annotatorData.reviewers.push(ann.reviewer);
              }
              if (ann.updated_at) {
                if (!annotatorData.lastReviewTime || ann.updated_at > annotatorData.lastReviewTime) {
                  annotatorData.lastReviewTime = ann.updated_at;
              }
            }
          } else {
            annotatorData.pendingCount++;
          }
        } else {
          annotatorData.unannotatedCount++;
        }
        
          if (ann.inspector && !annotatorData.inspectors.includes(ann.inspector)) {
            annotatorData.inspectors.push(ann.inspector);
          }
        });
        
        // 过滤出已完成复检的标注人（没有待复检数据，且有已复检数据）
        const completedAnnotators = Array.from(annotatorMap.values()).filter(a => 
          a.pendingCount === 0 && a.reviewedCount > 0
        );
        
        // 重要：只有当该视频的所有标注人都没有待复检数据时，才算完全复检完成
        const allAnnotators = Array.from(annotatorMap.values());
        const hasPendingData = allAnnotators.some(a => a.pendingCount > 0);
        
        // 如果还有待复检数据，则不放入已复检列表
        if (hasPendingData) {
          return null;
        }
        
        // 计算最新复检时间用于排序
        const latestReviewTime = Math.max(
          ...completedAnnotators
            .map(a => a.lastReviewTime ? new Date(a.lastReviewTime).getTime() : 0)
        );
        
        return completedAnnotators.length > 0 ? { 
          videoId, 
          annotators: completedAnnotators,
          latestReviewTime 
        } : null;
      });
      
      const videoStatsResults = await Promise.all(videoStatsPromises);
      let videosWithCompleted = videoStatsResults.filter(v => v !== null) as { 
        videoId: string; 
        annotators: AnnotatorData[];
        latestReviewTime: number;
      }[];
      
      // 按最新复检时间排序（最新的在前）
      videosWithCompleted.sort((a, b) => b.latestReviewTime - a.latestReviewTime);
      
      console.log('  - 已完成复检的视频数量:', videosWithCompleted.length);
      console.log('  - 前5个视频的最新复检时间:', 
        videosWithCompleted.slice(0, 5).map(v => ({
          videoId: v.videoId,
          time: new Date(v.latestReviewTime).toLocaleString('zh-CN')
        }))
      );
      
      // 3. 获取所有视频详细信息
      const { getVideos } = await import('../api/database');
      const allVideos = await getVideos();
      
      const result: VideoWithAnnotators[] = videosWithCompleted.map(item => {
        const video = allVideos.find(v => v.id === item.videoId);
        return {
          videoId: item.videoId,
          videoName: video?.name || item.videoId,
          subject: video?.subject || '未知',
          annotators: item.annotators
        };
      });
      
      setAllCompletedVideos(result);
      setCompletedPage(1); // 重置到第一页
      
      console.log('✅ 所有已复检视频加载完成:', result.length);
    } catch (error) {
      console.error('加载已复检视频失败:', error);
      message.error('加载已复检视频失败');
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
      
      // 重新加载所有数据
      loadAllPendingVideos();
      loadAllCompletedVideos();
    } catch (error) {
      console.error('❌ 删除异常:', error);
      message.error('删除失败');
    }
  };

  // 渲染视频列表（可复用组件 - 前端分页）
  const renderVideoList = (allVideos: VideoWithAnnotators[], isPending: boolean) => {
    const currentPage = isPending ? pendingPage : completedPage;
    const setCurrentPage = isPending ? setPendingPage : setCompletedPage;
    
    // 前端分页：根据当前页码切片数据
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const displayVideos = allVideos.slice(startIdx, endIdx);
    
    if (allVideos.length === 0 && !loading) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          暂无数据
        </div>
      );
    }

    const total = allVideos.length;
    const totalPages = Math.ceil(total / pageSize);
    
    const selectedVideoIds = isPending ? selectedPendingVideoIds : selectedCompletedVideoIds;
    const currentPageVideoIds = displayVideos.map(v => v.videoId);
    const allSelected = currentPageVideoIds.length > 0 && currentPageVideoIds.every(id => selectedVideoIds.has(id));
    const someSelected = currentPageVideoIds.some(id => selectedVideoIds.has(id)) && !allSelected;

    return (
      <>
        {/* 批量操作栏 */}
        <div style={{ 
          marginBottom: 16, 
          padding: '12px 16px', 
          background: '#f5f5f5', 
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => toggleSelectAll(isPending)}
            >
              全选当前页
            </Checkbox>
            <Text type="secondary">
              已选中 {selectedVideoIds.size} 个视频
            </Text>
          </Space>
          <Space>
            {selectedVideoIds.size > 0 && (
              <Button
                size="small"
                onClick={() => clearSelection(isPending)}
              >
                清空选择
              </Button>
            )}
          </Space>
        </div>
        
      <Collapse accordion>
        {displayVideos.map((video) => (
          <Panel
            header={
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Checkbox
                    checked={selectedVideoIds.has(video.videoId)}
                    onChange={() => toggleVideoSelection(video.videoId, isPending)}
                    onClick={(e) => e.stopPropagation()}
                  />
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
                </div>
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
                  title: '最后复检时间',
                  dataIndex: 'lastReviewTime',
                  key: 'lastReviewTime',
                  width: 180,
                  align: 'center' as const,
                  render: (time: string | undefined) => (
                    time ? (
                      <Text>{new Date(time).toLocaleString('zh-CN')}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    )
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
        
        {/* 分页控件 - 仅更新页码，不重新加载数据 */}
        {total > pageSize && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Space direction="vertical" align="center">
              <Space>
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  上一页
                </Button>
                <Text>
                  第 {currentPage} / {totalPages} 页
                  （共 {total} 个视频）
                </Text>
                <Button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  下一页
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </>
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
        <Card variant="borderless" loading={loading}>
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
                    <Tag color="orange">{allPendingVideos.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(allPendingVideos, true)
              },
              {
                key: 'completed',
                label: (
                  <Space>
                    <CheckCircleOutlined />
                    <span>已复检</span>
                    <Tag color="success">{allCompletedVideos.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(allCompletedVideos, false)
              }
            ]}
          />
        </Card>
      </Content>
    </Layout>
  );
}

