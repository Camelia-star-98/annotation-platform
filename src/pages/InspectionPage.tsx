import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  message,
  Typography,
  Tag,
  Radio,
  Modal,
  Input
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  UserOutlined
} from '@ant-design/icons';
import ReactPlayer from 'react-player';
import { MOCK_ANNOTATED_DATA } from '../mock/data';
import type { AnnotationItem } from '../types';
import './InspectionPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function InspectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef<ReactPlayer>(null);
  
  const userName = location.state?.userName || '未知用户';
  const inspectionDataFromManage = location.state?.inspectionData || null;
  const isFromManagement = location.state?.isFromManagement || false;
  const returnToManagement = location.state?.returnToManagement || false;
  const selectedVideoId = location.state?.selectedVideoId;
  const videoName = location.state?.videoName;
  
  const [inspectionData, setInspectionData] = useState<AnnotationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitModalVisible, setIsSubmitModalVisible] = useState(false);
  const [inspectorName, setInspectorName] = useState(userName);
  const [batchInspectResult, setBatchInspectResult] = useState<'pass' | 'fail' | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // 初始化质检数据
  useEffect(() => {
    if (isFromManagement && inspectionDataFromManage) {
      // 使用从管理页面传来的数据
      setInspectionData(inspectionDataFromManage.map((item: AnnotationItem) => ({
        ...item,
        isQualified: undefined,
        inspector: userName
      })));
    } else {
      // 使用模拟数据（旧的方式）
      const sampleData = MOCK_ANNOTATED_DATA.map(item => ({
        ...item,
        isQualified: undefined,
        inspector: userName
      }));
      setInspectionData(sampleData);
    }
  }, [userName, inspectionDataFromManage, isFromManagement]);

  // 点击时间戳跳转视频
  const handleTimeClick = (startTime: number, videoUrl: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, 'seconds');
    }
  };

  // 更新质检结果
  const updateQualification = (id: string, isQualified: boolean) => {
    setInspectionData(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isQualified } : item
      )
    );
  };

  // 提交质检 - 打开弹窗
  const handleSubmit = () => {
    const checkedItems = inspectionData.filter(item => item.isQualified !== undefined);
    
    if (checkedItems.length < inspectionData.length) {
      message.warning('请完成所有质检项');
      return;
    }

    // 打开提交弹窗
    setIsSubmitModalVisible(true);
  };

  // 确认提交质检
  const handleConfirmSubmit = async () => {
    if (!inspectorName.trim()) {
      message.warning('请输入质检人姓名');
      return;
    }

    if (!batchInspectResult) {
      message.warning('请选择质检结果（通过/不通过）');
      return;
    }

    setLoading(true);

    try {
      const { updateAnnotation } = await import('../api/database');
      
      // 根据选择的质检结果，批量更新所有数据
      const isQualified = batchInspectResult === 'pass';
      
      for (const item of inspectionData) {
        await updateAnnotation(item.id, {
          isQualified: isQualified,
          inspector: inspectorName
        });
      }

      message.success(`批量质检完成！共质检 ${inspectionData.length} 条数据`);

      setTimeout(() => {
        if (returnToManagement) {
          navigate('/inspection-manage', {
            state: {
              inspectorName,
              selectedVideoId,
              videoName
            }
          });
        } else {
          navigate('/inspection-select');
        }
      }, 1500);
    } catch (error) {
      message.error('保存质检结果失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '句子编号',
      dataIndex: 'sentenceNo',
      key: 'sentenceNo',
      width: 100,
      align: 'center' as const
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 140,
      render: (text: string, record: AnnotationItem) => (
        <Button
          type="link"
          onClick={() => handleTimeClick(record.startTime, record.videoUrl)}
        >
          {text}
        </Button>
      )
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 180
    },
    {
      title: '大模型改写文本',
      dataIndex: 'aiRewrittenText',
      key: 'aiRewrittenText',
      width: 180
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 180
    },
    {
      title: '问题大类',
      dataIndex: 'majorCategory',
      key: 'majorCategory',
      width: 150,
      render: (text: string) => {
        if (!text) return '-';
        // 支持多个分类（逗号分隔）
        const categories = text.split(',').filter(Boolean);
        return (
          <Space size={[0, 4]} wrap>
            {categories.map((cat, index) => (
              <Tag key={index} color="blue">{cat}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '问题小类',
      dataIndex: 'minorCategory',
      key: 'minorCategory',
      width: 150,
      render: (text: string) => {
        if (!text) return '-';
        // 支持多个分类（逗号分隔）
        const categories = text.split(',').filter(Boolean);
        return (
          <Space size={[0, 4]} wrap>
            {categories.map((cat, index) => (
              <Tag key={index} color="cyan">{cat}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '教研备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180
    },
    {
      title: '标注人',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100
    },
    {
      title: '是否通过',
      key: 'isQualified',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: AnnotationItem) => (
        <Radio.Group
          value={record.isQualified}
          onChange={(e) => updateQualification(record.id, e.target.value)}
        >
          <Radio.Button value={true}>
            <CheckOutlined style={{ color: '#52c41a' }} />
          </Radio.Button>
          <Radio.Button value={false}>
            <CloseOutlined style={{ color: '#ff4d4f' }} />
          </Radio.Button>
        </Radio.Group>
      )
    }
  ];

  // 统计信息
  const checkedCount = inspectionData.filter(item => item.isQualified !== undefined).length;
  const passedCount = inspectionData.filter(item => item.isQualified === true).length;
  const failedCount = inspectionData.filter(item => item.isQualified === false).length;
  const errorRate = inspectionData.length > 0 ? (failedCount / checkedCount) * 100 : 0;

  return (
    <Layout className="inspection-layout">
      <Header className="inspection-header">
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
            抽样质检 - {userName}
          </Title>
        </Space>
      </Header>

      <Content className="inspection-content">
        <div className="inspection-container">
          {/* 视频播放器 */}
          <Card title="原视频" className="video-card">
            <div className="video-wrapper">
              <ReactPlayer
                ref={playerRef}
                url={inspectionData[0]?.videoUrl}
                controls
                width="100%"
                height="100%"
              />
            </div>
          </Card>

          {/* 质检表格 */}
          <Card
            title="质检内容"
            className="inspection-table-card"
            extra={
              <Space size="large">
                <span>已检查：{checkedCount} / {inspectionData.length}</span>
                <span>通过：<span style={{ color: '#52c41a' }}>{passedCount}</span></span>
                <span>不通过：<span style={{ color: '#ff4d4f' }}>{failedCount}</span></span>
                {checkedCount > 0 && (
                  <span>
                    错误率：
                    <span style={{ color: errorRate > 2 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
                      {errorRate.toFixed(1)}%
                    </span>
                  </span>
                )}
                <Button 
                  type="primary" 
                  onClick={handleSubmit}
                  disabled={checkedCount < inspectionData.length}
                >
                  提交质检
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={inspectionData}
              rowKey="id"
              scroll={{ x: 1800 }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: inspectionData.length,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`
              }}
            />
          </Card>
        </div>
      </Content>

      {/* 批量质检提交弹窗 */}
      <Modal
        title="提交质检结果"
        open={isSubmitModalVisible}
        onOk={handleConfirmSubmit}
        onCancel={() => {
          setIsSubmitModalVisible(false);
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
                即将提交 <strong style={{ color: '#1890ff', fontSize: 20 }}>{inspectionData.length}</strong> 条质检结果
              </p>
            </div>

            {/* 质检结果选择 */}
            <div>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 500, fontSize: 15 }}>
                整体质检结果 <span style={{ color: '#ff4d4f' }}>*</span>
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
                💡 提示：选择的质检结果将应用到所有质检数据
              </p>
            </div>
          </Space>
        </div>
      </Modal>
    </Layout>
  );
}

