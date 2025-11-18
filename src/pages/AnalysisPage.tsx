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
  message
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
  
  const selectedVideos = location.state?.selectedVideos || [];
  const [allSubjectsData, setAllSubjectsData] = useState<any[]>([]);
  const [singleSubjectData, setSingleSubjectData] = useState<any[]>([]);
  const [detailData, setDetailData] = useState<AnnotationItem[]>([]);

  // 初始化数据
  useEffect(() => {
    // 使用实际数据计算统计
    const allSubjects = calculateStatistics(MOCK_ANNOTATED_DATA, 'majorCategory');
    const singleSubject = calculateStatistics(MOCK_ANNOTATED_DATA, 'minorCategory');

    setAllSubjectsData(allSubjects);
    setSingleSubjectData(singleSubject);
    setDetailData(MOCK_ANNOTATED_DATA);
  }, [selectedVideos]);

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
  const selectedVideoNames = MOCK_VIDEOS
    .filter(v => selectedVideos.includes(v.id))
    .map(v => v.name);

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
            结果分析
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
          {/* 数据来源 */}
          <Card title="数据来源" style={{ marginBottom: 24 }}>
            <div className="video-sources">
              {selectedVideoNames.length > 0 ? (
                selectedVideoNames.map((name, index) => (
                  <Tag key={index} color="blue" style={{ marginBottom: 8 }}>
                    {name}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">暂无选中的视频</Text>
              )}
            </div>
          </Card>

          {/* 图表展示 */}
          <Row gutter={24} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card>
                <ReactECharts
                  option={allSubjectsOption}
                  style={{ height: '400px' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card>
                <ReactECharts
                  option={singleSubjectOption}
                  style={{ height: '400px' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              </Card>
            </Col>
          </Row>

          {/* 详细问题汇总 */}
          <Card title="各大类问题汇总">
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

