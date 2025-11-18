import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Typography,
  Table,
  Row,
  Col,
  Tag,
  message,
  Radio,
  Select,
  Divider
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { MOCK_ANNOTATED_DATA, MOCK_VIDEOS } from '../mock/data';
import { exportToCSV, calculateStatistics } from '../utils/helpers';
import type { AnnotationItem } from '../types';
import './AnalysisPage.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const selectedVideoIds = location.state?.selectedVideos || [];
  const [videos, setVideos] = useState<any[]>([]);
  const [allSubjectsData, setAllSubjectsData] = useState<any[]>([]);
  const [singleSubjectData, setSingleSubjectData] = useState<any[]>([]);
  const [detailData, setDetailData] = useState<AnnotationItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 按学科分组的数据（用于聚合分析）
  const [subjectGroupedData, setSubjectGroupedData] = useState<Record<string, any[]>>({});
  
  // 分析模式：'aggregate' 聚合分析, 'single' 单视频分析
  const [analysisMode, setAnalysisMode] = useState<'aggregate' | 'single'>('aggregate');
  // 单视频分析时选中的视频
  const [selectedSingleVideo, setSelectedSingleVideo] = useState<string>('');

  // 加载视频列表和标注数据
  useEffect(() => {
    loadData();
  }, [selectedVideoIds, analysisMode, selectedSingleVideo]);

  const loadData = async () => {
    if (selectedVideoIds.length === 0) {
      message.warning('请先选择视频');
      return;
    }

    setLoading(true);
    try {
      const { getVideos, getAllAnnotations } = await import('../api/database');
      
      // 加载视频信息
      const allVideos = await getVideos();
      const selectedVids = allVideos.filter(v => selectedVideoIds.includes(v.id));
      setVideos(selectedVids);
      
      console.log('📹 选中的视频:', selectedVids);
      console.log('📹 视频科目信息:');
      selectedVids.forEach(v => {
        console.log(`  - ${v.name}: subject = "${v.subject}"`);
      });
      
      // 创建视频ID到科目的映射
      const videoSubjectMap = new Map<string, string>();
      selectedVids.forEach(v => {
        const subject = v.subject || '未知';
        videoSubjectMap.set(v.id, subject);
        console.log(`📋 映射: ${v.id} -> ${subject}`);
      });
      
      // 加载所有标注数据
      const allAnnotations = await getAllAnnotations();
      
      // 根据分析模式筛选数据
      let filteredData: AnnotationItem[] = [];
      
      if (analysisMode === 'aggregate') {
        // 聚合分析：所有选中视频的数据
        filteredData = allAnnotations.filter(item => 
          selectedVideoIds.includes(item.videoId) && item.reviewStatus === true
        ).map(item => ({
          ...item,
          subject: videoSubjectMap.get(item.videoId) || '未知' // 从视频映射中获取科目
        }));
      } else {
        // 单视频分析
        const targetVideoId = selectedSingleVideo || selectedVideoIds[0];
        filteredData = allAnnotations.filter(item => 
          item.videoId === targetVideoId && item.reviewStatus === true
        ).map(item => ({
          ...item,
          subject: videoSubjectMap.get(item.videoId) || '未知'
        }));
        if (!selectedSingleVideo) {
          setSelectedSingleVideo(targetVideoId);
        }
      }
      
      console.log('📊 分析模式:', analysisMode);
      console.log('📊 筛选后数据量:', filteredData.length);
      console.log('📊 前5条数据的科目:');
      filteredData.slice(0, 5).forEach(item => {
        console.log(`  - ID: ${item.id}, VideoID: ${item.videoId}, Subject: "${item.subject}"`);
      });
      
      // 计算统计数据
      if (analysisMode === 'aggregate') {
        // 聚合分析：按学科分组
        const subjectGroups: Record<string, AnnotationItem[]> = {};
        const subjectStats: Record<string, any[]> = {};
        
        filteredData.forEach(item => {
          const subject = item.subject || '未知';
          if (!subjectGroups[subject]) {
            subjectGroups[subject] = [];
          }
          subjectGroups[subject].push(item);
        });
        
        // 为每个学科计算统计
        Object.keys(subjectGroups).forEach(subject => {
          const data = subjectGroups[subject];
          subjectStats[subject] = calculateStatistics(data, 'majorCategory');
        });
        
        console.log('📊 按学科分组统计:', subjectStats);
        setSubjectGroupedData(subjectStats);
        
        // 保留全局统计用于表格
        const allSubjects = calculateStatistics(filteredData, 'majorCategory');
        setAllSubjectsData(allSubjects);
      } else {
        // 单视频分析：原有逻辑
        const allSubjects = calculateStatistics(filteredData, 'majorCategory');
        const singleSubject = calculateStatistics(filteredData, 'minorCategory');
        setAllSubjectsData(allSubjects);
        setSingleSubjectData(singleSubject);
      }
      
      setDetailData(filteredData);
      
      message.success(`加载了 ${filteredData.length} 条标注数据`);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 全学科问题占比饼图配置
  const allSubjectsOption = {
    title: {
      text: '全学科问题占比',
      left: 'center',
      top: 20,
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}条 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'middle',
      formatter: (name: string) => {
        const item = allSubjectsData.find(d => d.name === name);
        return `${name}: ${item?.value || 0}条`;
      }
    },
    series: [
      {
        name: '问题分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: allSubjectsData
      }
    ],
    color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452']
  };

  // 单科问题占比饼图配置
  const singleSubjectOption = {
    title: {
      text: '大模型改写单科问题占比',
      left: 'center',
      top: 20,
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}条 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 20,
      top: 'middle',
      formatter: (name: string) => {
        const item = singleSubjectData.find(d => d.name === name);
        return `${name}: ${item?.value || 0}条`;
      }
    },
    series: [
      {
        name: '问题分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: singleSubjectData
      }
    ],
    color: ['#ee6666', '#5470c6', '#91cc75', '#fac858', '#73c0de', '#3ba272', '#fc8452']
  };

  // 下载分析结果
  const handleDownload = () => {
    try {
      // 准备导出数据
      const exportData = detailData.map(item => ({
        '句子编号': item.sentenceNo,
        '科目': item.subject,
        '视频名称': item.videoName,
        '时间范围': item.timeRange,
        '原文文本': item.originalText,
        '大模型改写文本': item.aiRewrittenText,
        '人工标注文本': item.humanAnnotatedText,
        '问题大类': item.majorCategory,
        '问题小类': item.minorCategory,
        '教研备注': item.remark
      }));

      exportToCSV(exportData, `标注分析报告_${new Date().toLocaleDateString()}`);
      message.success('分析报告已导出');
    } catch (error) {
      message.error('导出失败，请重试');
    }
  };

  // 详情表格列定义
  const columns = [
    {
      title: '句子编号',
      dataIndex: 'sentenceNo',
      key: 'sentenceNo',
      width: 100,
      align: 'center' as const
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 80,
      render: (text: string) => <Tag color="purple">{text}</Tag>
    },
    {
      title: '视频名称',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 150
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 120
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 200
    },
    {
      title: '大模型改写文本',
      dataIndex: 'aiRewrittenText',
      key: 'aiRewrittenText',
      width: 200
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 200
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 150,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '问题小类',
      dataIndex: 'minorCategory',
      key: 'minorCategory',
      width: 150,
      render: (text: string) => <Tag color="cyan">{text}</Tag>
    },
    {
      title: '教研备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200
    }
  ];

  // 获取选中的视频名称
  const selectedVideoNames = videos.map(v => v.name);
  
  // 获取当前分析的视频名称
  const getAnalysisTitle = () => {
    if (analysisMode === 'aggregate') {
      return `聚合分析 (${videos.length} 个视频)`;
    } else {
      const video = videos.find(v => v.id === selectedSingleVideo);
      return `单视频分析: ${video?.name || ''}`;
    }
  };

  return (
    <Layout className="analysis-layout">
      <Header className="analysis-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            结果分析 - {getAnalysisTitle()}
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          size="large"
          style={{ background: 'white', color: '#667eea' }}
        >
          下载分析报告
        </Button>
      </Header>

      <Content className="analysis-content">
        <div className="analysis-container">
          {/* 分析模式选择 */}
          <Card title="分析设置" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong style={{ marginRight: 16 }}>分析模式：</Text>
                <Radio.Group
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="aggregate">聚合分析（所有视频）</Radio.Button>
                  <Radio.Button value="single">单视频分析</Radio.Button>
                </Radio.Group>
              </div>
              
              {analysisMode === 'single' && videos.length > 1 && (
                <div>
                  <Text strong style={{ marginRight: 16 }}>选择视频：</Text>
                  <Select
                    style={{ width: 300 }}
                    value={selectedSingleVideo}
                    onChange={setSelectedSingleVideo}
                    options={videos.map(v => ({
                      label: v.name,
                      value: v.id
                    }))}
                  />
                </div>
              )}
            </Space>
          </Card>

          {/* 数据来源 */}
          <Card title="数据来源" style={{ marginBottom: 24 }} loading={loading}>
            <div className="video-sources">
              {analysisMode === 'aggregate' ? (
                <>
                  <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                    包含以下 {videos.length} 个视频的所有标注数据：
                  </Text>
                  {selectedVideoNames.length > 0 ? (
                    selectedVideoNames.map((name, index) => (
                      <Tag key={index} color="blue" style={{ marginBottom: 8, marginRight: 8 }}>
                        {name}
                      </Tag>
                    ))
                  ) : (
                    <Text type="secondary">暂无选中的视频</Text>
                  )}
                </>
              ) : (
                <>
                  <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                    单视频分析：
                  </Text>
                  <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                    {videos.find(v => v.id === selectedSingleVideo)?.name || ''}
                  </Tag>
                </>
              )}
              <Divider />
              <Text type="secondary">
                共 {detailData.length} 条已复检数据
              </Text>
            </div>
          </Card>

          {/* 图表展示 */}
          {analysisMode === 'aggregate' ? (
            // 聚合分析：按学科显示多个饼图
            <>
              <Card title="按学科分类统计" style={{ marginBottom: 24 }}>
                <Row gutter={[24, 24]}>
                  {Object.keys(subjectGroupedData).length > 0 ? (
                    Object.entries(subjectGroupedData).map(([subject, data]) => {
                      const option = {
                        title: {
                          text: `${subject} - 问题占比`,
                          left: 'center',
                          top: 20,
                          textStyle: {
                            fontSize: 16,
                            fontWeight: 'bold'
                          }
                        },
                        tooltip: {
                          trigger: 'item',
                          formatter: '{b}: {c}条 ({d}%)'
                        },
                        legend: {
                          orient: 'vertical',
                          right: 10,
                          top: 'middle',
                          textStyle: {
                            fontSize: 12
                          },
                          formatter: (name: string) => {
                            const item = data.find((d: any) => d.name === name);
                            return `${name}: ${item?.value || 0}条`;
                          }
                        },
                        series: [
                          {
                            name: '问题分布',
                            type: 'pie',
                            radius: ['40%', '70%'],
                            center: ['40%', '55%'],
                            avoidLabelOverlap: false,
                            itemStyle: {
                              borderRadius: 10,
                              borderColor: '#fff',
                              borderWidth: 2
                            },
                            label: {
                              show: true,
                              formatter: '{d}%',
                              fontSize: 12
                            },
                            emphasis: {
                              label: {
                                show: true,
                                fontSize: 14,
                                fontWeight: 'bold'
                              }
                            },
                            data: data
                          }
                        ],
                        color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
                      };

                      return (
                        <Col xs={24} lg={12} xl={12} key={subject}>
                          <Card bordered={false} loading={loading}>
                            <ReactECharts
                              option={option}
                              style={{ height: '400px' }}
                              notMerge={true}
                              lazyUpdate={true}
                            />
                          </Card>
                        </Col>
                      );
                    })
                  ) : (
                    <Col span={24}>
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        暂无数据
                      </div>
                    </Col>
                  )}
                </Row>
              </Card>
            </>
          ) : (
            // 单视频分析：显示两个饼图
            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col xs={24} lg={12}>
                <Card loading={loading}>
                  <ReactECharts
                    option={allSubjectsOption}
                    style={{ height: '400px' }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card loading={loading}>
                  <ReactECharts
                    option={singleSubjectOption}
                    style={{ height: '400px' }}
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* 详细问题汇总 */}
          <Card title="各大类问题汇总" loading={loading}>
            <Table
              columns={columns}
              dataSource={detailData}
              rowKey="id"
              scroll={{ x: 1800 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条问题`
              }}
            />
          </Card>
        </div>
      </Content>
    </Layout>
  );
}

