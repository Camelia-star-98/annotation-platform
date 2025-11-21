import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Typography,
  message,
  Row,
  Col,
  Divider,
  Table,
  Spin
} from 'antd';
import { ArrowLeftOutlined, SwapOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { AnnotationItem } from '../types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface ComparisonData {
  videoId: string;
  videoName: string;
  data: AnnotationItem[];
  majorCategoryStats: { category: string; count: number }[];
  minorCategoryStats: { category: string; count: number }[];
}

export default function ComparisonPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const selectedVideoIds = location.state?.selectedVideos || [];
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<[ComparisonData | null, ComparisonData | null]>([null, null]);

  useEffect(() => {
    if (selectedVideoIds.length !== 2) {
      message.error('请选择2个视频进行对比');
      navigate('/');
      return;
    }
    loadComparisonData();
  }, [selectedVideoIds]);

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const { getVideos, getReviewedAnnotations } = await import('../api/database');
      
      // 加载视频信息
      const allVideos = await getVideos();
      const selectedVids = allVideos.filter(v => selectedVideoIds.includes(v.id));
      
      if (selectedVids.length !== 2) {
        message.error('无法加载视频信息');
        return;
      }

      // 为每个视频加载数据并统计
      const dataPromises = selectedVids.map(async (video) => {
        const annotations = await getReviewedAnnotations([video.id]);
        
        if (annotations.length === 0) {
          message.warning(`视频"${video.name}"暂无已复检数据`);
          return null;
        }

        // 统计问题分类
        const majorCategoryMap = new Map<string, number>();
        const minorCategoryMap = new Map<string, number>();

        annotations.forEach(item => {
          // 统计大类
          if (item.majorCategory && item.majorCategory.trim()) {
            const majors = item.majorCategory.split(',').map(c => c.trim()).filter(c => c);
            majors.forEach(major => {
              majorCategoryMap.set(major, (majorCategoryMap.get(major) || 0) + 1);
            });
          }

          // 统计小类
          if (item.minorCategory && item.minorCategory.trim()) {
            const minors = item.minorCategory.split(',').map(c => c.trim()).filter(c => c);
            minors.forEach(minor => {
              minorCategoryMap.set(minor, (minorCategoryMap.get(minor) || 0) + 1);
            });
          }
        });

        return {
          videoId: video.id,
          videoName: video.name || '未命名视频',
          data: annotations.map(item => ({
            ...item,
            videoName: video.name || '未命名视频'
          })),
          majorCategoryStats: Array.from(majorCategoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count),
          minorCategoryStats: Array.from(minorCategoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
        };
      });

      const results = await Promise.all(dataPromises);
      setComparisonData([results[0], results[1]]);
      
      message.success('数据加载完成');
    } catch (error) {
      console.error('加载对比数据失败:', error);
      message.error('加载对比数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成问题大类对比图表配置
  const getMajorCategoryComparisonOption = () => {
    if (!comparisonData[0] || !comparisonData[1]) return {};

    // 获取所有大类（合并两个任务的）
    const allCategories = new Set<string>();
    comparisonData[0].majorCategoryStats.forEach(s => allCategories.add(s.category));
    comparisonData[1].majorCategoryStats.forEach(s => allCategories.add(s.category));
    
    const categories = Array.from(allCategories);
    
    // 构建数据
    const data1 = categories.map(cat => {
      const stat = comparisonData[0]!.majorCategoryStats.find(s => s.category === cat);
      return stat ? stat.count : 0;
    });
    
    const data2 = categories.map(cat => {
      const stat = comparisonData[1]!.majorCategoryStats.find(s => s.category === cat);
      return stat ? stat.count : 0;
    });

    return {
      title: {
        text: '问题大类对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: [comparisonData[0].videoName, comparisonData[1].videoName],
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: comparisonData[0].videoName,
          type: 'bar',
          data: data1,
          itemStyle: { color: '#5470c6' }
        },
        {
          name: comparisonData[1].videoName,
          type: 'bar',
          data: data2,
          itemStyle: { color: '#91cc75' }
        }
      ]
    };
  };

  // 生成问题占比对比（饼图）
  const getPieChartOption = (data: ComparisonData) => {
    const total = data.data.length;
    const categoryCounts = data.majorCategoryStats;

    return {
      title: {
        text: data.videoName,
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      series: [
        {
          name: '问题分类',
          type: 'pie',
          radius: '50%',
          data: categoryCounts.map(item => ({
            value: item.count,
            name: item.category
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  // 表格列定义
  const getTableColumns = () => [
    {
      title: '句子编号',
      dataIndex: 'sentenceNo',
      key: 'sentenceNo',
      width: 80,
      align: 'center' as const
    },
    {
      title: '原始文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 200,
      ellipsis: true
    },
    {
      title: '人工标注',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 200,
      ellipsis: true
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 150,
      ellipsis: true
    },
    {
      title: '问题小类',
      dataIndex: 'minorCategory',
      key: 'minorCategory',
      width: 150,
      ellipsis: true
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100
    },
    {
      title: '复检人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 100
    }
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>结果对比</Title>
        </Header>
        <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" tip="加载对比数据中..." />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            <SwapOutlined style={{ marginRight: 8 }} />
            结果对比
          </Title>
        </div>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        {comparisonData[0] && comparisonData[1] ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 基本信息对比 */}
            <Card>
              <Row gutter={[24, 16]}>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Title level={4}>{comparisonData[0].videoName}</Title>
                    <Text type="secondary">共 {comparisonData[0].data.length} 条已复检数据</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center' }}>
                    <Title level={4}>{comparisonData[1].videoName}</Title>
                    <Text type="secondary">共 {comparisonData[1].data.length} 条已复检数据</Text>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 问题大类对比柱状图 */}
            <Card title="问题大类分布对比">
              <ReactECharts 
                option={getMajorCategoryComparisonOption()} 
                style={{ height: 400 }}
              />
            </Card>

            {/* 问题占比饼图对比 */}
            <Card title="问题占比对比">
              <Row gutter={24}>
                <Col span={12}>
                  {comparisonData[0].majorCategoryStats.length > 0 ? (
                    <ReactECharts 
                      option={getPieChartOption(comparisonData[0])} 
                      style={{ height: 400 }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
                      暂无数据
                    </div>
                  )}
                </Col>
                <Col span={12}>
                  {comparisonData[1].majorCategoryStats.length > 0 ? (
                    <ReactECharts 
                      option={getPieChartOption(comparisonData[1])} 
                      style={{ height: 400 }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
                      暂无数据
                    </div>
                  )}
                </Col>
              </Row>
            </Card>

            <Divider>原始数据明细</Divider>

            {/* 原始数据明细 - 左右分栏 */}
            <Row gutter={24}>
              <Col span={12}>
                <Card 
                  title={comparisonData[0].videoName} 
                  bordered
                  style={{ height: 600, overflow: 'hidden' }}
                  bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto', padding: 0 }}
                >
                  <Table
                    columns={getTableColumns()}
                    dataSource={comparisonData[0].data}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`
                    }}
                    scroll={{ x: 'max-content' }}
                    size="small"
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card 
                  title={comparisonData[1].videoName} 
                  bordered
                  style={{ height: 600, overflow: 'hidden' }}
                  bodyStyle={{ height: 'calc(100% - 57px)', overflow: 'auto', padding: 0 }}
                >
                  <Table
                    columns={getTableColumns()}
                    dataSource={comparisonData[1].data}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`
                    }}
                    scroll={{ x: 'max-content' }}
                    size="small"
                  />
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
              无对比数据
            </div>
          </Card>
        )}
      </Content>
    </Layout>
  );
}

