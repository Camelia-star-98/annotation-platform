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
  Input,
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import ReactPlayer from 'react-player';
import { MOCK_ANNOTATED_DATA } from '../mock/data';
import type { AnnotationItem } from '../types';
import AnnotationHistoryModal from '../components/AnnotationHistoryModal';
import './InspectionPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function InspectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef<ReactPlayer>(null);
  
  const defaultUserName = location.state?.userName || '';
  const inspectionDataFromManage = location.state?.inspectionData || null;
  const isFromManagement = location.state?.isFromManagement || false;
  
  const [inspectionData, setInspectionData] = useState<AnnotationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [inspectorName, setInspectorName] = useState(defaultUserName); // 质检人姓名
  const [nameInputValue, setNameInputValue] = useState(defaultUserName); // 模态框中的输入值
  const [isNameModalVisible, setIsNameModalVisible] = useState(false); // 是否显示姓名输入模态框
  const pageSize = 20;
  
  // 🆕 历史版本查看
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentAnnotationId, setCurrentAnnotationId] = useState<string>('');

  // 页面加载时检查是否需要填写质检人姓名
  useEffect(() => {
    if (!defaultUserName || defaultUserName.trim() === '') {
      setIsNameModalVisible(true);
    }
  }, [defaultUserName]);

  // 初始化质检数据
  useEffect(() => {
    if (isFromManagement && inspectionDataFromManage) {
      // 使用从管理页面传来的数据
      setInspectionData(inspectionDataFromManage.map((item: AnnotationItem) => ({
        ...item,
        isQualified: undefined,
        inspector: inspectorName
      })));
    } else {
      // 使用模拟数据（旧的方式）
      const sampleData = MOCK_ANNOTATED_DATA.map(item => ({
        ...item,
        isQualified: undefined,
        inspector: inspectorName
      }));
      setInspectionData(sampleData);
    }
  }, [inspectorName, inspectionDataFromManage, isFromManagement]);

  // 点击时间戳跳转视频
  const handleTimeClick = (startTime: number, videoUrl: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, 'seconds');
    }
  };

  // 确认质检人姓名
  const handleConfirmName = () => {
    if (!nameInputValue || nameInputValue.trim() === '') {
      message.warning('请输入质检人姓名');
      return;
    }
    setInspectorName(nameInputValue.trim());
    setIsNameModalVisible(false);
    message.success('质检人姓名已设置');
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
    // 验证质检人姓名
    if (!inspectorName || inspectorName.trim() === '') {
      message.warning('请输入质检人姓名');
      return;
    }

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
      
      console.log('📤 开始提交质检数据，共', inspectionData.length, '条');
      console.log('📤 质检人姓名:', inspectorName.trim());
      
      let successCount = 0;
      let failCount = 0;
      
      // 先查询所有数据的当前 rejection_count
      const { supabase } = await import('../api/supabase');
      const annotationIds = inspectionData.map(item => item.id);
      const { data: currentAnnotations } = await supabase
        .from('annotations')
        .select('id, rejection_count')
        .in('id', annotationIds);
      
      const rejectionCountMap = new Map<string, number>();
      currentAnnotations?.forEach(ann => {
        rejectionCountMap.set(ann.id, ann.rejection_count || 0);
      });
      
      for (const item of inspectionData) {
        const updateData: any = {
          isQualified: item.isQualified,
          inspector: inspectorName.trim()
        };
        
        // 如果质检不通过，增加 rejection_count 并记录到 rejected_annotations 表
        if (item.isQualified === false) {
          const currentCount = rejectionCountMap.get(item.id) || 0;
          updateData.rejectionCount = currentCount + 1;
          console.log(`📝 数据 ${item.id} 被打回，rejection_count: ${currentCount} -> ${updateData.rejectionCount}`);
          
          // 🆕 将被打回的数据记录到 rejected_annotations 表（所有人可见，便于相互学习）
          try {
            const { error: insertError } = await supabase
              .from('rejected_annotations')
              .insert({
                annotation_id: item.id,
                video_id: item.videoId,
                video_name: item.videoName,
                subject: item.subject,
                sentence_no: item.sentenceNo,
                time_range: item.timeRange,
                start_time: item.startTime,
                end_time: item.endTime,
                original_text: item.originalText,
                ai_rewritten_text: item.aiRewrittenText,
                human_annotated_text: item.humanAnnotatedText,
                major_category: item.majorCategory || '',
                minor_category: item.minorCategory || '',
                remark: item.remark || '',
                annotator: item.annotator || '',
                inspector: inspectorName.trim(),
                rejection_count: updateData.rejectionCount,
                is_resubmitted: false,
                rejected_at: new Date().toISOString()
              });
            
            if (insertError) {
              console.error('❌ 写入 rejected_annotations 失败:', insertError);
            } else {
              console.log(`✅ 已将数据 ${item.id} 记录到 rejected_annotations 表`);
            }
          } catch (rejectionError) {
            console.error('❌ 记录打回数据异常:', rejectionError);
          }
        }
        
        const success = await updateAnnotation(item.id, updateData);
        
        if (success) {
          successCount++;
        } else {
          failCount++;
          console.error('❌ 更新失败的数据ID:', item.id);
        }
      }
      
      console.log('✅ 质检数据提交完成:', {
        总数: inspectionData.length,
        成功: successCount,
        失败: failCount
      });

      if (failCount > 0) {
        message.error(`质检完成，但有 ${failCount} 条数据保存失败`);
      } else if (errorRate > 2) {
        message.error(`错误率 ${errorRate.toFixed(1)}% 超过 2%，标注将被打回重新标注`);
      } else {
        message.success(`质检完成！错误率 ${errorRate.toFixed(1)}%，共提交 ${successCount} 条数据`);
      }

      setTimeout(() => {
        navigate('/inspection-manage');
      }, 2000);
    } catch (error) {
      message.error('保存质检结果失败');
      console.error('❌ 提交质检数据异常:', error);
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
      width: 100,
      render: (text: string) => {
        // 如果标注人为空、null 或 'unknown'，显示为"未标注"
        if (!text || text === 'unknown' || text.trim() === '') {
          return <span style={{ color: '#999' }}>未标注</span>;
        }
        return text;
      }
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
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: AnnotationItem) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => {
            setCurrentAnnotationId(record.id);
            setHistoryModalVisible(true);
          }}
        >
          历史
        </Button>
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
      {/* 质检人姓名输入模态框 */}
      <Modal
        title="请输入质检人姓名"
        open={isNameModalVisible}
        onOk={handleConfirmName}
        closable={false}
        maskClosable={false}
        okText="确认"
        cancelButtonProps={{ style: { display: 'none' } }}
        okButtonProps={{ disabled: !nameInputValue || nameInputValue.trim() === '' }}
      >
        <Input
          placeholder="请输入质检人姓名"
          value={nameInputValue}
          onChange={(e) => setNameInputValue(e.target.value)}
          onPressEnter={handleConfirmName}
          autoFocus
          maxLength={50}
        />
      </Modal>

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
            抽样质检 {inspectorName && `- ${inspectorName}`}
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
              <Space size="large" direction="vertical" align="end">
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
                </Space>
                <Space>
                  <span>质检人：<strong>{inspectorName || '未填写'}</strong></span>
                <Button 
                  type="primary" 
                  onClick={handleSubmit}
                    disabled={checkedCount < inspectionData.length || !inspectorName.trim()}
                >
                  提交质检
                </Button>
                </Space>
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
      
      {/* 🆕 历史版本查看弹窗 */}
      <AnnotationHistoryModal
        visible={historyModalVisible}
        onClose={() => {
          setHistoryModalVisible(false);
          setCurrentAnnotationId('');
        }}
        annotationId={currentAnnotationId}
      />
    </Layout>
  );
}

