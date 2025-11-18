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
  Checkbox,
  Modal,
  Input,
  Select,
  Statistic,
  Row,
  Col
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { AnnotationItem } from '../types';
import './InspectionManagePage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export default function InspectionManagePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从上一页传来的质检人姓名和选中的视频ID
  const defaultInspectorName = location.state?.inspectorName || '';
  const selectedVideoId = location.state?.selectedVideoId;
  const videoName = location.state?.videoName;
  
  const [allAnnotations, setAllAnnotations] = useState<AnnotationItem[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]); // 分组后的数据
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]); // 展开的行
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inspectorName, setInspectorName] = useState(defaultInspectorName);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inspected'>('pending');
  const [loading, setLoading] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [selectedVideoId]);

  // 过滤数据
  useEffect(() => {
    filterData();
  }, [allAnnotations, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { getAnnotations, getVideos } = await import('../api/database');
      
      let annotations: AnnotationItem[] = [];
      
      // 如果指定了视频ID，只加载该视频的数据
      if (selectedVideoId) {
        console.log('📹 加载视频数据:', selectedVideoId, videoName);
        annotations = await getAnnotations(selectedVideoId);
        console.log('📊 该视频的标注数据数量:', annotations.length);
        
        // 给每条标注添加视频名称
        const annotationsWithVideoName = annotations.map(item => ({
          ...item,
          videoName: videoName || '未知视频'
        }));
        
        setAllAnnotations(annotationsWithVideoName);
        message.success(`加载了视频"${videoName}"的 ${annotations.length} 条标注数据`);
      } else {
        // 否则加载所有数据（向后兼容）
        const { getAllAnnotations } = await import('../api/database');
        const [allAnnotations, videos] = await Promise.all([
          getAllAnnotations(),
          getVideos()
        ]);
        
        console.log('📊 加载的标注数据数量:', allAnnotations.length);
        console.log('🎬 加载的视频数据数量:', videos.length);
        
        // 创建视频 ID 到视频名称的映射
        const videoMap = new Map(videos.map(v => [v.id, v.name]));
        
        // 给每条标注数据添加视频名称
        const annotationsWithVideoName = allAnnotations.map(item => {
          const videoName = videoMap.get(item.videoId) || item.videoId || '未知视频';
          return {
            ...item,
            videoName
          };
        });
        
        setAllAnnotations(annotationsWithVideoName);
        message.success(`加载了 ${annotationsWithVideoName.length} 条标注数据`);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败，请检查后端服务');
    }
    setLoading(false);
  };

  const filterData = () => {
    let filtered = allAnnotations;
    
    switch (filterStatus) {
      case 'pending':
        // 已标注完成但未质检的（status为true且is_qualified为null/undefined）
        filtered = allAnnotations.filter(item => 
          item.status === true && (item.isQualified === null || item.isQualified === undefined)
        );
        break;
      case 'inspected':
        // 已质检的（is_qualified不为null/undefined）
        filtered = allAnnotations.filter(item => 
          item.isQualified !== undefined && item.isQualified !== null
        );
        break;
      case 'all':
      default:
        filtered = allAnnotations;
        break;
    }
    
    // 按视频名称分组
    const grouped = groupByVideo(filtered);
    setGroupedData(grouped);
    setFilteredData(grouped);
  };

  // 按视频分组数据
  const groupByVideo = (data: AnnotationItem[]) => {
    const videoGroups = new Map<string, AnnotationItem[]>();
    
    // 按 videoId 分组
    data.forEach(item => {
      const videoKey = item.videoId || 'unknown';
      if (!videoGroups.has(videoKey)) {
        videoGroups.set(videoKey, []);
      }
      videoGroups.get(videoKey)!.push(item);
    });
    
    // 转换为表格需要的格式
    const result: any[] = [];
    videoGroups.forEach((items, videoId) => {
      const videoName = items[0]?.videoName || videoId;
      
      // 父级行（视频）
      result.push({
        key: `video_${videoId}`,
        isGroup: true,
        videoId,
        videoName,
        itemCount: items.length,
        children: items.map(item => ({
          ...item,
          key: item.id,
          isGroup: false
        }))
      });
    });
    
    return result;
  };

  // 开始质检
  const handleStartInspection = () => {
    if (selectedRows.length === 0) {
      message.warning('请至少选择一条数据进行质检');
      return;
    }
    setIsModalVisible(true);
  };

  // 确认开始质检
  const handleConfirmStart = () => {
    if (!inspectorName.trim()) {
      message.warning('请输入质检人姓名');
      return;
    }

    const selectedData = allAnnotations.filter(item => 
      selectedRows.includes(item.id)
    );

    navigate('/inspection', {
      state: {
        userName: inspectorName,
        inspectionData: selectedData,
        isFromManagement: true
      }
    });
  };

  // 随机抽样
  const handleRandomSample = (count: number) => {
    const pendingData = allAnnotations.filter(item => 
      item.status && !item.isQualified && item.isQualified !== false
    );

    if (pendingData.length === 0) {
      message.warning('没有待质检的数据');
      return;
    }

    const sampleCount = Math.min(count, pendingData.length);
    const shuffled = [...pendingData].sort(() => 0.5 - Math.random());
    const sampled = shuffled.slice(0, sampleCount);
    
    setSelectedRows(sampled.map(item => item.id));
    message.success(`已随机抽取 ${sampleCount} 条数据`);
  };

  // 处理父级行的全选/取消
  const handleGroupSelect = (record: any, checked: boolean) => {
    console.log('🎯 手动选择父级', { record, checked });
    
    if (!record.children || record.children.length === 0) return;
    
    // 过滤出未质检的子项（isQualified 为 null 或 undefined）
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 使用 == null 同时匹配 null 和 undefined
      .map((child: any) => child.key);
    
    console.log('👶 可选的子项keys:', childKeys);
    
    if (checked) {
      // 选中：添加所有可选的子项
      const newSelectedKeys = [...new Set([...selectedRows, ...childKeys])];
      console.log('✅ 选中父级，新keys:', newSelectedKeys);
      setSelectedRows(newSelectedKeys);
    } else {
      // 取消：移除所有子项
      const newSelectedKeys = selectedRows.filter(key => !childKeys.includes(key));
      console.log('❌ 取消父级，新keys:', newSelectedKeys);
      setSelectedRows(newSelectedKeys);
    }
  };

  // 检查父级行是否被选中
  const isGroupSelected = (record: any) => {
    if (!record.children || record.children.length === 0) return false;
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 只统计未质检的
      .map((child: any) => child.key);
    if (childKeys.length === 0) return false; // 如果没有可选的子项，返回false
    return childKeys.every((key: string) => selectedRows.includes(key));
  };

  // 检查父级行是否部分选中
  const isGroupIndeterminate = (record: any) => {
    if (!record.children || record.children.length === 0) return false;
    const childKeys = record.children
      .filter((child: any) => child.isQualified == null) // 只统计未质检的
      .map((child: any) => child.key);
    if (childKeys.length === 0) return false; // 如果没有可选的子项，返回false
    const selectedCount = childKeys.filter((key: string) => selectedRows.includes(key)).length;
    return selectedCount > 0 && selectedCount < childKeys.length;
  };

  // 表格列定义
  const columns = [
    {
      title: '视频名称 / 句子编号',
      dataIndex: 'videoName',
      key: 'videoName',
      width: 300,
      render: (text: string, record: any) => {
        console.log('🎨 渲染行:', { text, isGroup: record.isGroup, record });
        
        if (record.isGroup) {
          const allChildrenSelected = isGroupSelected(record);
          const someChildrenSelected = isGroupIndeterminate(record);
          
          console.log('👨‍👩‍👧 父级行状态:', { allChildrenSelected, someChildrenSelected, videoName: text });
          
          return (
            <Space>
              <Checkbox
                checked={allChildrenSelected}
                indeterminate={someChildrenSelected}
                onChange={(e) => {
                  console.log('📦 Checkbox onChange 触发', e.target.checked);
                  handleGroupSelect(record, e.target.checked);
                }}
                onClick={(e) => {
                  console.log('🖱️ Checkbox onClick 触发');
                  e.stopPropagation();
                }}
              />
              <strong style={{ fontSize: '14px' }}>
                📹 {text} <Tag color="blue">{record.itemCount} 条</Tag>
              </strong>
            </Space>
          );
        }
        return `句子 ${record.sentenceNo}`;
      }
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 120,
      render: (text: string, record: any) => record.isGroup ? null : text
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 200,
      ellipsis: true,
      render: (text: string, record: any) => record.isGroup ? null : text
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 200,
      ellipsis: true,
      render: (text: string, record: any) => record.isGroup ? null : text
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 150,
      render: (text: string, record: any) => {
        if (record.isGroup) return null;
        return text ? <Tag color="blue">{text}</Tag> : '-';
      }
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100,
      render: (text: string, record: any) => record.isGroup ? null : text
    },
    {
      title: '标注状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: boolean, record: any) => {
        if (record.isGroup) return null;
        return status ? 
          <Tag color="success">已完成</Tag> : 
          <Tag color="default">未完成</Tag>;
      }
    },
    {
      title: '质检状态',
      key: 'inspectionStatus',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (record.isGroup) return null;
        if (record.isQualified === true) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>通过</Tag>;
        } else if (record.isQualified === false) {
          return <Tag color="error">不通过</Tag>;
        } else {
          return <Tag color="warning" icon={<ClockCircleOutlined />}>待质检</Tag>;
        }
      }
    }
  ];

  // 统计数据
  const pendingCount = allAnnotations.filter(item => 
    item.status && !item.isQualified && item.isQualified !== false
  ).length;
  
  const inspectedCount = allAnnotations.filter(item => 
    item.isQualified !== undefined
  ).length;
  
  const passedCount = allAnnotations.filter(item => 
    item.isQualified === true
  ).length;
  
  const failedCount = allAnnotations.filter(item => 
    item.isQualified === false
  ).length;

  const rowSelection = {
    selectedRowKeys: selectedRows,
    onChange: (selectedRowKeys: React.Key[]) => {
      console.log('✅ 子项选择变化:', selectedRowKeys);
      setSelectedRows(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: any) => {
      const isParent = record.isGroup === true;
      const isInspected = record.isQualified !== null && record.isQualified !== undefined;
      
      console.log('⚙️ getCheckboxProps:', { 
        key: record.key, 
        isGroup: record.isGroup,
        isQualified: record.isQualified,
        isParent,
        isInspected,
        disabled: isParent || isInspected
      });
      
      return {
        disabled: isParent || isInspected, // 父级行和已质检的都不能选
      };
    },
  };

  return (
    <Layout className="inspection-manage-layout">
      <Header className="inspection-manage-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(selectedVideoId ? '/inspection-select' : '/', { 
              state: selectedVideoId ? { inspectorName: defaultInspectorName } : undefined 
            })}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            质检数据管理{videoName && ` - ${videoName}`}{defaultInspectorName && ` - ${defaultInspectorName}`}
          </Title>
        </Space>
      </Header>

      <Content className="inspection-manage-content">
        <div className="inspection-manage-container">
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待质检数据"
                  value={pendingCount}
                  suffix="条"
                  valueStyle={{ color: '#faad14' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已质检数据"
                  value={inspectedCount}
                  suffix="条"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="质检通过"
                  value={passedCount}
                  suffix="条"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="质检不通过"
                  value={failedCount}
                  suffix="条"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 操作栏 */}
          <Card style={{ marginBottom: 16 }}>
            <Space size="large" wrap>
              <span>筛选：</span>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: 150 }}
              >
                <Option value="pending">待质检</Option>
                <Option value="inspected">已质检</Option>
                <Option value="all">全部</Option>
              </Select>

              <Button onClick={() => handleRandomSample(5)}>
                随机抽取5条
              </Button>
              <Button onClick={() => handleRandomSample(10)}>
                随机抽取10条
              </Button>
              <Button onClick={() => handleRandomSample(20)}>
                随机抽取20条
              </Button>

              <div style={{ flex: 1 }} />

              <span>已选择 {selectedRows.length} 条</span>
              <Button
                type="primary"
                onClick={handleStartInspection}
                disabled={selectedRows.length === 0}
              >
                开始质检
              </Button>
            </Space>
          </Card>

          {/* 数据表格 */}
          <Card>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={filteredData}
              rowKey="key"
              loading={loading}
              scroll={{ x: 1400 }}
              expandable={{
                defaultExpandAllRows: false,
                expandedRowKeys: expandedRowKeys,
                onExpand: (expanded, record) => {
                  if (expanded) {
                    setExpandedRowKeys([...expandedRowKeys, record.key]);
                  } else {
                    setExpandedRowKeys(expandedRowKeys.filter(k => k !== record.key));
                  }
                },
                rowExpandable: (record) => record.isGroup && record.children && record.children.length > 0
              }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个视频`
              }}
            />
          </Card>
        </div>
      </Content>

      {/* 质检人姓名输入弹窗 */}
      <Modal
        title="开始质检"
        open={isModalVisible}
        onOk={handleConfirmStart}
        onCancel={() => setIsModalVisible(false)}
        okText="开始质检"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>
                质检人姓名
              </label>
              <Input
                placeholder="请输入姓名"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                prefix={<UserOutlined />}
                onPressEnter={handleConfirmStart}
                size="large"
              />
            </div>
            <div style={{ background: '#f0f2f5', padding: 12, borderRadius: 4 }}>
              <p style={{ margin: 0, color: '#666' }}>
                即将质检 <strong style={{ color: '#1890ff' }}>{selectedRows.length}</strong> 条数据
              </p>
            </div>
          </Space>
        </div>
      </Modal>
    </Layout>
  );
}

