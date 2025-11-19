import { useState, useEffect } from 'react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Typography,
  Table,
  message,
  Divider
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, BarChartOutlined, PieChartOutlined, TableOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { AnnotationItem } from '../types';
import './AnalysisPage.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface MajorCategoryStats {
  majorCategory: string;
  count: number;
}

interface MinorCategoryStats {
  minorCategory: string;
  majorCategory: string;
  count: number;
}

interface SubjectDetailStats {
  majorCategory: string;
  minorCategory: string;
  [subject: string]: string | number; // 动态的科目列数据
}

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const selectedVideoIds = location.state?.selectedVideos || [];
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 统计数据
  const [majorCategoryStats, setMajorCategoryStats] = useState<MajorCategoryStats[]>([]);
  const [minorCategoryStats, setMinorCategoryStats] = useState<MinorCategoryStats[]>([]);
  const [subjectDetailStats, setSubjectDetailStats] = useState<SubjectDetailStats[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [rawData, setRawData] = useState<AnnotationItem[]>([]); // 添加原始数据状态

  // 加载数据
  useEffect(() => {
    loadData();
  }, [selectedVideoIds]);

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
      
      // 创建视频ID到科目的映射
      const videoSubjectMap = new Map<string, string>();
      selectedVids.forEach(v => {
        const subject = v.subject || '未知';
        videoSubjectMap.set(v.id, subject);
      });
      
      // 加载所有标注数据（只统计已复检完成的数据）
      const allAnnotations = await getAllAnnotations();
      const filteredData = allAnnotations.filter(item => 
        selectedVideoIds.includes(item.videoId) && 
        item.reviewStatus === true &&
        item.majorCategory && 
        item.minorCategory
      ).map(item => ({
        ...item,
        subject: videoSubjectMap.get(item.videoId) || '未知'
      }));
      
      console.log('📊 已复检数据数量:', filteredData.length);
      
      if (filteredData.length === 0) {
        message.warning('所选视频暂无已复检完成的数据');
        setLoading(false);
        return;
      }
      
      // 保存原始数据（包含科目信息）
      setRawData(filteredData);
      
      // 统计数据
      calculateStatistics(filteredData);
      
      message.success(`加载了 ${filteredData.length} 条已复检数据`);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data: AnnotationItem[]) => {
    // 1. 统计全学科问题大类
    const majorMap = new Map<string, number>();
    data.forEach(item => {
      const majors = item.majorCategory.split(',').map(m => m.trim()).filter(m => m);
      majors.forEach(major => {
        majorMap.set(major, (majorMap.get(major) || 0) + 1);
      });
    });
    
    const majorStats: MajorCategoryStats[] = Array.from(majorMap.entries()).map(([majorCategory, count]) => ({
      majorCategory,
      count
    })).sort((a, b) => b.count - a.count);
    
    setMajorCategoryStats(majorStats);
    
    // 2. 统计全学科问题小类（包含所属大类）
    const minorMap = new Map<string, { majorCategory: string; count: number }>();
    data.forEach(item => {
      const majors = item.majorCategory.split(',').map(m => m.trim()).filter(m => m);
      const minors = item.minorCategory.split(',').map(m => m.trim()).filter(m => m);
      
      // 假设大类和小类按顺序对应
      minors.forEach((minor, index) => {
        const major = majors[index] || majors[0] || '未知';
        const key = `${major}|${minor}`;
        
        if (!minorMap.has(key)) {
          minorMap.set(key, { majorCategory: major, count: 0 });
        }
        minorMap.set(key, {
          majorCategory: major,
          count: minorMap.get(key)!.count + 1
        });
      });
    });
    
    const minorStats: MinorCategoryStats[] = Array.from(minorMap.entries()).map(([key, value]) => ({
      minorCategory: key.split('|')[1],
      majorCategory: value.majorCategory,
      count: value.count
    })).sort((a, b) => b.count - a.count);
    
    setMinorCategoryStats(minorStats);
    
    // 3. 统计每个科目的问题明细
    const subjects = Array.from(new Set(data.map(item => item.subject).filter(s => s && s !== '未知')));
    setAvailableSubjects(subjects);
    
    // 创建问题类别结构
    const categoryStructure = new Map<string, Set<string>>(); // major -> Set of minors
    data.forEach(item => {
      const majors = item.majorCategory.split(',').map(m => m.trim()).filter(m => m);
      const minors = item.minorCategory.split(',').map(m => m.trim()).filter(m => m);
      
      minors.forEach((minor, index) => {
        const major = majors[index] || majors[0] || '未知';
        if (!categoryStructure.has(major)) {
          categoryStructure.set(major, new Set());
        }
        categoryStructure.get(major)!.add(minor);
      });
    });
    
    // 统计每个科目的每个小类问题数量
    const detailStatsMap = new Map<string, SubjectDetailStats>();
    
    categoryStructure.forEach((minors, major) => {
      minors.forEach(minor => {
        const key = `${major}|${minor}`;
        
        if (!detailStatsMap.has(key)) {
          const row: SubjectDetailStats = {
            majorCategory: major,
            minorCategory: minor
          };
          
          subjects.forEach(subject => {
            row[subject] = 0;
          });
          
          detailStatsMap.set(key, row);
        }
        
        // 统计每个科目的问题数
        data.forEach(item => {
          if (!item.subject || item.subject === '未知') return;
          
          const itemMajors = item.majorCategory.split(',').map(m => m.trim());
          const itemMinors = item.minorCategory.split(',').map(m => m.trim());
          
          itemMinors.forEach((itemMinor, index) => {
            const itemMajor = itemMajors[index] || itemMajors[0];
            if (itemMajor === major && itemMinor === minor) {
              const row = detailStatsMap.get(key)!;
              row[item.subject] = (row[item.subject] as number) + 1;
            }
          });
        });
      });
    });
    
    const detailStats = Array.from(detailStatsMap.values());
    setSubjectDetailStats(detailStats);
    
    console.log('📊 大类统计:', majorStats);
    console.log('📊 小类统计:', minorStats);
    console.log('📊 科目明细:', detailStats);
  };

  // 全学科大类问题饼状图配置
  const getMajorCategoryPieOption = () => {
    return {
      title: {
        text: '全学科问题大类占比',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 18,
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
        data: majorCategoryStats.map(item => item.majorCategory)
      },
      series: [
        {
          name: '问题大类',
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
            formatter: '{b}: {c}条'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          data: majorCategoryStats.map(item => ({
            value: item.count,
            name: item.majorCategory
          }))
        }
      ]
    };
  };

  // 全学科小类问题柱状图配置
  const getMinorCategoryBarOption = () => {
    return {
      title: {
        text: '全学科问题小类占比',
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const item = params[0];
          const stat = minorCategoryStats[item.dataIndex];
          return `${stat.minorCategory}<br/>所属大类: ${stat.majorCategory}<br/>数量: ${item.value}条`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: minorCategoryStats.map(item => item.minorCategory),
        axisLabel: {
          interval: 0,
          rotate: 45,
          fontSize: 11
        }
      },
      yAxis: {
        type: 'value',
        name: '问题数量（条）',
        minInterval: 1
      },
      series: [
        {
          name: '问题数量',
          type: 'bar',
          data: minorCategoryStats.map(item => item.count),
          itemStyle: {
            color: '#5470c6'
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        }
      ]
    };
  };

  // 单科问题占比表格列配置
  const getSubjectTableColumns = () => {
    const columns = [
      {
        title: '问题大类',
        dataIndex: 'majorCategory',
        key: 'majorCategory',
        width: 150,
        fixed: 'left' as const
      },
      {
        title: '问题小类',
        dataIndex: 'minorCategory',
        key: 'minorCategory',
        width: 200,
        fixed: 'left' as const
      }
    ];
    
    // 动态添加科目列
    availableSubjects.forEach(subject => {
      columns.push({
        title: subject,
        dataIndex: subject,
        key: subject,
        width: 100,
        render: (value: number) => value > 0 ? <span style={{ fontWeight: 500 }}>{value}</span> : <span style={{ color: '#ccc' }}>0</span>
      } as any);
    });
    
    return columns;
  };

  // 导出CSV
  const handleExport = () => {
    // 构建CSV数据
    const csvData: any[] = [];
    
    // 添加表头
    const headers = ['问题大类', '问题小类', ...availableSubjects];
    csvData.push(headers);
    
    // 添加数据行
    subjectDetailStats.forEach(row => {
      const dataRow = [
        row.majorCategory,
        row.minorCategory,
        ...availableSubjects.map(subject => row[subject] || 0)
      ];
      csvData.push(dataRow);
    });
    
    // 转换为CSV字符串
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `问题统计分析_${new Date().toLocaleDateString()}.csv`;
    link.click();
    
    message.success('导出成功！');
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
            数据分析
          </Title>
        </Space>
      </Header>

      <Content className="analysis-content">
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px' }}>
          {/* 数据来源 */}
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>数据来源</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            <Space wrap>
              <Text strong>已选择视频：</Text>
              {videos.map(video => (
                <Space key={video.id}>
                  <Text>{video.name}</Text>
                  {video.subject ? (
                    <Tag color="green">{video.subject}</Tag>
                  ) : (
                    <Tag color="red">未设置科目</Tag>
                  )}
                </Space>
              ))}
            </Space>
          </Card>

          {/* 1. 全学科问题大类占比（饼状图） */}
          <Card 
            title={
              <Space>
                <PieChartOutlined />
                <span>全学科问题大类占比</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            {majorCategoryStats.length > 0 ? (
              <ReactECharts 
                option={getMajorCategoryPieOption()} 
                style={{ height: '500px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 2. 全学科问题小类占比（柱状图） */}
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>全学科问题小类占比</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            {minorCategoryStats.length > 0 ? (
              <ReactECharts 
                option={getMinorCategoryBarOption()} 
                style={{ height: '500px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 3. 单科问题占比（表格） */}
          <Card 
            title={
              <Space>
                <TableOutlined />
                <span>单科问题明细统计</span>
              </Space>
            }
            extra={
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={subjectDetailStats.length === 0}
              >
                导出CSV
              </Button>
            }
            loading={loading}
          >
            <Table
              columns={getSubjectTableColumns()}
              dataSource={subjectDetailStats}
              rowKey={(record) => `${record.majorCategory}_${record.minorCategory}`}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 项`
              }}
              scroll={{ x: 'max-content' }}
              bordered
              size="middle"
            />
          </Card>

          {/* 4. 原始数据明细（新增） */}
          <Card 
            title={
              <Space>
                <TableOutlined />
                <span>原始数据明细</span>
                <Tag color="blue">{rawData.length} 条</Tag>
              </Space>
            }
            loading={loading}
          >
            <Table
              columns={[
                {
                  title: '句子编号',
                  dataIndex: 'sentenceNo',
                  key: 'sentenceNo',
                  width: 100,
                  sorter: (a, b) => (a.sentenceNo || 0) - (b.sentenceNo || 0)
                },
                {
                  title: '科目',
                  dataIndex: 'subject',
                  key: 'subject',
                  width: 100,
                  render: (subject: string) => (
                    <Tag color={subject === '未知' ? 'red' : 'green'}>
                      {subject}
                    </Tag>
                  ),
                  filters: availableSubjects.map(s => ({ text: s, value: s })),
                  onFilter: (value, record) => record.subject === value
                },
                {
                  title: '视频名称',
                  dataIndex: 'videoName',
                  key: 'videoName',
                  width: 200,
                  ellipsis: true
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
                  width: 250,
                  ellipsis: true
                },
                {
                  title: '大模型改写文本',
                  dataIndex: 'aiRewrittenText',
                  key: 'aiRewrittenText',
                  width: 250,
                  ellipsis: true
                },
                {
                  title: '人工标注文本',
                  dataIndex: 'humanAnnotatedText',
                  key: 'humanAnnotatedText',
                  width: 250,
                  ellipsis: true
                },
                {
                  title: '问题大类',
                  dataIndex: 'majorCategory',
                  key: 'majorCategory',
                  width: 150,
                  render: (text: string) => (
                    <Space direction="vertical" size={2}>
                      {text.split(',').map((cat, idx) => (
                        <Tag key={idx} color="blue">{cat}</Tag>
                      ))}
                    </Space>
                  )
                },
                {
                  title: '问题小类',
                  dataIndex: 'minorCategory',
                  key: 'minorCategory',
                  width: 150,
                  render: (text: string) => (
                    <Space direction="vertical" size={2}>
                      {text.split(',').map((cat, idx) => (
                        <Tag key={idx} color="cyan">{cat}</Tag>
                      ))}
                    </Space>
                  )
                },
                {
                  title: '标注人',
                  dataIndex: 'annotator',
                  key: 'annotator',
                  width: 100
                },
                {
                  title: '质检人',
                  dataIndex: 'inspector',
                  key: 'inspector',
                  width: 100
                },
                {
                  title: '复检人',
                  dataIndex: 'reviewer',
                  key: 'reviewer',
                  width: 100
                }
              ]}
              dataSource={rawData}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`
              }}
              scroll={{ x: 'max-content' }}
              bordered
              size="small"
            />
          </Card>
        </div>
      </Content>
    </Layout>
  );
}
