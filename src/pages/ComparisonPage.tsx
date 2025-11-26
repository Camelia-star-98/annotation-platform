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
  Spin,
  Tabs
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
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);

  useEffect(() => {
    if (selectedVideoIds.length < 2) {
      message.error('请至少选择2个视频进行对比');
      navigate('/');
      return;
    }
    if (selectedVideoIds.length > 6) {
      message.error('最多支持同时对比6个视频');
      navigate('/');
      return;
    }
    loadComparisonData();
  }, [selectedVideoIds]);

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      const { getVideos } = await import('../api/database');
      
      // 加载视频信息
      const allVideos = await getVideos();
      const selectedVids = allVideos.filter(v => selectedVideoIds.includes(v.id));
      
      if (selectedVids.length < 2) {
        message.error('无法加载视频信息');
        return;
      }

      console.log('📊 开始并行加载多个视频的已复检数据...');

      // 为每个视频加载数据并统计（优化：直接查询指定视频，避免加载全部数据）
      const dataPromises = selectedVids.map(async (video) => {
        // 直接查询该视频的已复检数据
        const { data: annotations, error } = await supabase
          .from('annotations')
          .select('*')
          .eq('video_id', video.id)
          .eq('review_status', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error(`视频"${video.name}"查询失败:`, error);
          return null;
        }
        
        if (!annotations || annotations.length === 0) {
          message.warning(`视频"${video.name}"暂无已复检数据`);
          return null;
        }

        console.log(`  - 视频"${video.name}"加载了 ${annotations.length} 条已复检数据`);

        // 统计问题分类
        const majorCategoryMap = new Map<string, number>();
        const minorCategoryMap = new Map<string, number>();

        annotations.forEach(item => {
          // 统计大类
          if (item.major_category && item.major_category.trim()) {
            const majors = item.major_category.split(',').map(c => c.trim()).filter(c => c);
            majors.forEach(major => {
              majorCategoryMap.set(major, (majorCategoryMap.get(major) || 0) + 1);
            });
          }

          // 统计小类
          if (item.minor_category && item.minor_category.trim()) {
            const minors = item.minor_category.split(',').map(c => c.trim()).filter(c => c);
            minors.forEach(minor => {
              minorCategoryMap.set(minor, (minorCategoryMap.get(minor) || 0) + 1);
            });
          }
        });

        // 转换数据格式
        const formattedData = annotations.map(item => ({
          id: item.id || '',
          videoId: item.video_id || '',
          sentenceNo: item.sentence_no || 0,
          timeRange: item.time_range || '',
          startTime: item.start_time,
          endTime: item.end_time,
          originalText: item.original_text || '',
          aiRewrittenText: item.ai_rewritten_text || '',
          humanAnnotatedText: item.human_annotated_text || '',
          majorCategory: item.major_category || '',
          minorCategory: item.minor_category || '',
          remark: item.remark || '',
          status: item.status || false,
          annotator: item.annotator || '',
          isQualified: item.is_qualified,
          inspector: item.inspector || '',
          reviewer: item.reviewer || '',
          reviewStatus: item.review_status,
          videoName: video.name || '未命名视频',
          videoUrl: item.video_url || '',
          subject: item.subject || ''
        }));

        return {
          videoId: video.id,
          videoName: video.name || '未命名视频',
          data: formattedData,
          majorCategoryStats: Array.from(majorCategoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count),
          minorCategoryStats: Array.from(minorCategoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
        };
      });

      const results = await Promise.all(dataPromises);
      const validResults = results.filter(r => r !== null) as ComparisonData[];
      setComparisonData(validResults);
      
      console.log('✅ 所有视频数据加载完成');
      message.success(`数据加载完成，共 ${validResults.length} 个视频`);
    } catch (error) {
      console.error('加载对比数据失败:', error);
      message.error('加载对比数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成问题大类对比图表配置
  const getMajorCategoryComparisonOption = () => {
    if (comparisonData.length === 0) return {};

    // 获取所有大类（合并所有任务的）
    const allCategories = new Set<string>();
    comparisonData.forEach(data => {
      data.majorCategoryStats.forEach(s => allCategories.add(s.category));
    });
    
    const categories = Array.from(allCategories);
    
    // 为每个视频构建数据
    const series = comparisonData.map((data, index) => {
      const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];
      return {
        name: data.videoName,
        type: 'bar',
        data: categories.map(cat => {
          const stat = data.majorCategoryStats.find(s => s.category === cat);
          return stat ? stat.count : 0;
        }),
        itemStyle: { color: colors[index % colors.length] }
      };
    });

    return {
      title: {
        text: '问题大类分布对比',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: comparisonData.map(d => d.videoName),
        bottom: 0,
        type: 'scroll'
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
      series: series
    };
  };

  // 生成问题占比对比（饼图）- 多个视频使用环形图
  const getPieChartsOption = () => {
    if (comparisonData.length === 0) return {};

    // 为多个视频生成多个环形图
    const radius = comparisonData.length === 2 
      ? [['30%', '50%'], ['30%', '50%']]
      : comparisonData.length === 3
      ? [['25%', '40%'], ['25%', '40%'], ['25%', '40%']]
      : [['20%', '35%'], ['20%', '35%'], ['20%', '35%'], ['20%', '35%']];
    
    const centerPositions = comparisonData.length === 2
      ? [['25%', '50%'], ['75%', '50%']]
      : comparisonData.length === 3
      ? [['20%', '50%'], ['50%', '50%'], ['80%', '50%']]
      : comparisonData.length === 4
      ? [['25%', '35%'], ['75%', '35%'], ['25%', '75%'], ['75%', '75%']]
      : comparisonData.length === 5
      ? [['20%', '30%'], ['50%', '30%'], ['80%', '30%'], ['35%', '70%'], ['65%', '70%']]
      : [['20%', '30%'], ['50%', '30%'], ['80%', '30%'], ['20%', '70%'], ['50%', '70%'], ['80%', '70%']];

    const series = comparisonData.map((data, index) => ({
      name: data.videoName,
      type: 'pie',
      radius: radius[index] || ['20%', '35%'],
      center: centerPositions[index] || ['50%', '50%'],
      data: data.majorCategoryStats.map(item => ({
        value: item.count,
        name: item.category
      })),
      label: {
        formatter: '{b}\n{d}%',
        fontSize: 10
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }));

    return {
      title: comparisonData.map((data, index) => ({
        text: data.videoName,
        left: centerPositions[index][0],
        top: comparisonData.length > 3 && index >= 3 ? '55%' : '3%',
        textAlign: 'center',
        textStyle: {
          fontSize: 12,
          fontWeight: 'normal'
        }
      })),
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      series: series
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
            结果对比（{comparisonData.length} 个视频）
          </Title>
        </div>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        {comparisonData.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 基本信息对比 */}
            <Card>
              <Row gutter={[16, 16]}>
                {comparisonData.map((data, index) => (
                  <Col span={24 / Math.min(comparisonData.length, 4)} key={data.videoId}>
                    <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                      <Title level={5} style={{ marginBottom: 4 }}>{data.videoName}</Title>
                      <Text type="secondary">共 {data.data.length} 条已复检数据</Text>
                    </div>
                  </Col>
                ))}
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
              <ReactECharts 
                option={getPieChartsOption()} 
                style={{ height: comparisonData.length > 3 ? 600 : 400 }}
              />
            </Card>

            <Divider>原始数据明细</Divider>

            {/* 原始数据明细 - 使用Tabs切换 */}
            <Card>
              <Tabs
                items={comparisonData.map((data, index) => ({
                  key: data.videoId,
                  label: `${data.videoName} (${data.data.length}条)`,
                  children: (
                    <Table
                      columns={getTableColumns()}
                      dataSource={data.data}
                      rowKey="id"
                      pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`
                      }}
                      scroll={{ x: 'max-content' }}
                      size="small"
                    />
                  )
                }))}
              />
            </Card>
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
