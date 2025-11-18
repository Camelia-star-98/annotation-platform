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
  Col,
  Radio
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { AnnotationItem } from '../types';
import './InspectionManagePage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export default function InspectionManagePage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从上一页传来的质检人姓名、选中的视频ID、抽样比例
  const defaultInspectorName = location.state?.inspectorName || '';
  const selectedVideoId = location.state?.selectedVideoId;
  const videoName = location.state?.videoName;
  const samplePercentage = location.state?.samplePercentage || 100; // 默认100%（全部）
  
  const [allAnnotations, setAllAnnotations] = useState<AnnotationItem[]>([]);
  const [groupedData, setGroupedData] = useState<any[]>([]); // 分组后的数据
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]); // 展开的行
  const [isBatchInspectModalVisible, setIsBatchInspectModalVisible] = useState(false);
  const [batchInspectResult, setBatchInspectResult] = useState<'pass' | 'fail' | null>(null);
  const [inspectorName, setInspectorName] = useState(defaultInspectorName);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'inspected'>('pending');
  const [loading, setLoading] = useState(false);
  const [sampledCount, setSampledCount] = useState(0); // 抽样数量

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
        console.log('🎲 抽样比例:', samplePercentage + '%');
        
        // 获取视频信息（包括URL）
        const allVideos = await getVideos();
        const currentVideo = allVideos.find(v => v.id === selectedVideoId);
        const videoUrl = currentVideo?.url || '';
        
        console.log('🎬 视频URL:', videoUrl);
        
        annotations = await getAnnotations(selectedVideoId);
        console.log('📊 该视频的标注数据数量:', annotations.length);
        
        // 过滤出待质检的数据（已标注但未质检）
        const pendingAnnotations = annotations.filter(
          item => item.status === true && !item.inspector
        );
        
        console.log('⏳ 待质检数据数量:', pendingAnnotations.length);
        
        // 实施抽样（如果不是100%）
        let sampledAnnotations = pendingAnnotations;
        if (samplePercentage < 100) {
          const calculatedSize = Math.ceil(pendingAnnotations.length * samplePercentage / 100);
          // 确保至少抽取1条数据
          const sampleSize = Math.max(1, calculatedSize);
          
          // Fisher-Yates 洗牌算法随机抽样
          const shuffled = [...pendingAnnotations];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          
          sampledAnnotations = shuffled.slice(0, sampleSize);
          console.log('🎯 抽样后数据数量:', sampledAnnotations.length, '(保证最少1条)');
          setSampledCount(sampledAnnotations.length);
        } else {
          setSampledCount(pendingAnnotations.length);
        }
        
        // 给每条标注添加视频名称和视频URL
        const annotationsWithVideoName = sampledAnnotations.map(item => ({
          ...item,
          videoName: videoName || '未知视频',
          videoUrl: videoUrl // 添加视频URL
        }));
        
        setAllAnnotations(annotationsWithVideoName);
        
        if (samplePercentage < 100) {
          message.success(
            `已按 ${samplePercentage}% 比例抽样，从 ${pendingAnnotations.length} 条中抽取了 ${sampledAnnotations.length} 条数据`
          );
        } else {
          message.success(`加载了视频"${videoName}"的 ${sampledAnnotations.length} 条待质检数据`);
        }
      } else {
        // 否则加载所有数据（向后兼容）
        const { getAllAnnotations } = await import('../api/database');
        const [allAnnotations, videos] = await Promise.all([
          getAllAnnotations(),
          getVideos()
        ]);
        
        console.log('📊 加载的标注数据数量:', allAnnotations.length);
        console.log('🎬 加载的视频数据数量:', videos.length);
        
        // 创建视频 ID 到视频信息的映射
        const videoMap = new Map(videos.map(v => [v.id, { name: v.name, url: v.url }]));
        
        // 给每条标注数据添加视频名称和URL
        const annotationsWithVideoName = allAnnotations.map(item => {
          const videoInfo = videoMap.get(item.videoId);
          const videoName = videoInfo?.name || item.videoId || '未知视频';
          const videoUrl = videoInfo?.url || '';
          return {
            ...item,
            videoName,
            videoUrl
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
        // 已标注完成但未质检的（status为true且没有质检人）
        filtered = allAnnotations.filter(item => 
          item.status === true && !item.inspector
        );
        break;
      case 'inspected':
        // 已质检的（有质检人）
        filtered = allAnnotations.filter(item => 
          item.inspector && item.inspector.trim() !== ''
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

  // 开始质检 - 跳转到质检页面
  const handleStartInspection = () => {
    if (selectedRows.length === 0) {
      message.warning('请至少选择一条数据进行质检');
      return;
    }

    const selectedData = allAnnotations.filter(item => 
      selectedRows.includes(item.id)
    );

    navigate('/inspection', {
      state: {
        userName: inspectorName || '质检员',
        inspectionData: selectedData,
        isFromManagement: true,
        returnToManagement: true, // 标记从管理页面来，返回时需要显示提交弹窗
        selectedVideoId,
        videoName
      }
    });
  };

  // 批量质检确认
  const handleBatchInspectConfirm = async () => {
    if (!batchInspectResult) {
      message.warning('请选择质检结果（通过/不通过）');
      return;
    }

    if (!inspectorName.trim()) {
      message.warning('请输入质检人姓名');
      return;
    }

    setLoading(true);
    try {
      const { updateAnnotation } = await import('../api/database');
      
      // 批量更新选中的数据
      const updatePromises = selectedRows.map(id => 
        updateAnnotation(id, {
          isQualified: batchInspectResult === 'pass',
          inspector: inspectorName
        })
      );

      await Promise.all(updatePromises);

      message.success(`批量质检完成！共质检 ${selectedRows.length} 条数据`);
      
      // 重新加载数据
      await loadData();
      
      // 清空选择
      setSelectedRows([]);
      setBatchInspectResult(null);
      setIsBatchInspectModalVisible(false);
      
    } catch (error) {
      console.error('批量质检失败:', error);
      message.error('批量质检失败，请重试');
    } finally {
      setLoading(false);
    }
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
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (record.isGroup) return null;
        if (record.inspector) {
          // 已质检
          if (record.isQualified === true) {
            return <Tag color="success" icon={<CheckCircleOutlined />}>✅ 通过</Tag>;
          } else if (record.isQualified === false) {
            return <Tag color="error">❌ 不通过</Tag>;
          }
        }
        // 未质检
        return <Tag color="orange" icon={<ClockCircleOutlined />}>⏳ 待质检</Tag>;
      }
    },
    {
      title: '质检人',
      dataIndex: 'inspector',
      key: 'inspector',
      width: 120,
      align: 'center' as const,
      render: (inspector: string, record: any) => {
        if (record.isGroup) return null;
        if (inspector) {
          return (
            <Tag color="blue" icon={<UserOutlined />}>
              {inspector}
            </Tag>
          );
        }
        return <Tag color="default">未质检</Tag>;
      }
    }
  ];

  // 统计数据 - 基于当前筛选后的数据（抽样后的数据）
  const pendingCount = filteredData.filter(item => 
    !item.isGroup && item.status === true && !item.inspector
  ).length;
  
  const inspectedCount = filteredData.filter(item => 
    !item.isGroup && item.inspector && item.inspector.trim() !== ''
  ).length;
  
  const passedCount = filteredData.filter(item => 
    !item.isGroup && item.isQualified === true && item.inspector
  ).length;
  
  const failedCount = filteredData.filter(item => 
    !item.isGroup && item.isQualified === false && item.inspector
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
          {/* 抽样信息提示 */}
          {samplePercentage < 100 && sampledCount > 0 && (
            <Card 
              style={{ 
                marginBottom: 16, 
                background: '#e6f7ff', 
                borderColor: '#91d5ff' 
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🎲</span>
                  <span style={{ fontWeight: 500, color: '#0050b3' }}>
                    抽样质检模式：已按 {samplePercentage}% 比例随机抽取
                  </span>
                </div>
                <div style={{ color: '#096dd9', fontSize: 13 }}>
                  本次抽样数量：<strong>{sampledCount}</strong> 条 | 
                  抽样算法：Fisher-Yates 随机洗牌
                </div>
                <div style={{ color: '#fa8c16', fontSize: 12, marginTop: 4 }}>
                  ⚠️ 注意：只有被抽到的数据会被质检，其余数据仍为"待质检"状态，需要后续再次抽样质检
                </div>
              </Space>
            </Card>
          )}
          
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-待质检" : "待质检数据"}
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
                  title={samplePercentage < 100 ? "本次抽样-已质检" : "已质检数据"}
                  value={inspectedCount}
                  suffix="条"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={samplePercentage < 100 ? "本次抽样-通过" : "质检通过"}
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
                  title={samplePercentage < 100 ? "本次抽样-不通过" : "质检不通过"}
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

      {/* 批量质检弹窗（合并了输入姓名和选择结果） */}
      <Modal
        title="批量质检"
        open={isBatchInspectModalVisible}
        onOk={handleBatchInspectConfirm}
        onCancel={() => {
          setIsBatchInspectModalVisible(false);
          setBatchInspectResult(null);
        }}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={loading}
        width={520}
      >
        <div style={{ padding: '20px 0' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 质检人姓名输入 */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 15 }}>
                质检人姓名 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Input
                placeholder="请输入质检人姓名"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                size="large"
                style={{ fontSize: 15 }}
              />
            </div>

            {/* 统计信息 */}
            <div style={{ background: '#e6f7ff', padding: 16, borderRadius: 8, border: '1px solid #91d5ff' }}>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                即将质检 <strong style={{ color: '#1890ff', fontSize: 20 }}>{selectedRows.length}</strong> 条数据
              </p>
            </div>

            {/* 质检结果选择 */}
            <div>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 500, fontSize: 15 }}>
                质检结果 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Radio.Group
                value={batchInspectResult}
                onChange={(e) => setBatchInspectResult(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Radio 
                    value="pass" 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      marginRight: 0
                    }}
                  >
                    <Space>
                      <CheckOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>通过</span>
                    </Space>
                  </Radio>
                  <Radio 
                    value="fail" 
                    style={{ 
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      marginRight: 0
                    }}
                  >
                    <Space>
                      <CloseOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>不通过</span>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {/* 提示信息 */}
            <div style={{ background: '#fffbe6', padding: 12, borderRadius: 4, border: '1px solid #ffe58f' }}>
              <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
                💡 提示：批量质检将对所有选中的数据应用相同的质检结果
              </p>
            </div>
          </Space>
        </div>
      </Modal>
    </Layout>
  );
}

