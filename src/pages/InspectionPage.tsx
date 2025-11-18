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
  Radio
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined
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
  
  const [inspectionData, setInspectionData] = useState<AnnotationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  // 提交质检
  const handleSubmit = async () => {
    const checkedItems = inspectionData.filter(item => item.isQualified !== undefined);
    
    if (checkedItems.length < inspectionData.length) {
      message.warning('请完成所有质检项');
      return;
    }

    // 计算错误率
    const failedCount = inspectionData.filter(item => !item.isQualified).length;
    const errorRate = (failedCount / inspectionData.length) * 100;

    // 保存质检结果到后端
    try {
      const { updateAnnotation } = await import('../api/database');
      
      for (const item of inspectionData) {
        await updateAnnotation(item.id, {
          isQualified: item.isQualified,
          inspector: userName
        });
      }

      if (errorRate > 2) {
        message.error(`错误率 ${errorRate.toFixed(1)}% 超过 2%，标注将被打回重新标注`);
      } else {
        message.success(`质检通过！错误率 ${errorRate.toFixed(1)}%`);
      }

      setTimeout(() => {
        navigate('/inspection-manage');
      }, 2000);
    } catch (error) {
      message.error('保存质检结果失败');
      console.error(error);
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
            style={{ marginTop: 24 }}
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
    </Layout>
  );
}

