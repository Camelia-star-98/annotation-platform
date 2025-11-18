import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  message,
  Typography,
  Cascader,
  Checkbox,
  Modal,
  Input,
  Select,
  Tag
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import ReactPlayer from 'react-player';
import { PROBLEM_CATEGORIES } from '../mock/data';
import type { AnnotationItem, ProblemCategory } from '../types';
import './ReviewPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const playerRef = useRef<ReactPlayer>(null);
  
  // 从路由获取视频ID、视频名称和标注人姓名
  const videoId = location.state?.videoId;
  const videoName = location.state?.videoName;
  const annotatorName = location.state?.annotatorName;
  
  const [reviewData, setReviewData] = useState<AnnotationItem[]>([]);
  const [categories, setCategories] = useState<ProblemCategory[]>(PROBLEM_CATEGORIES);
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isReviewerModalVisible, setIsReviewerModalVisible] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'major' | 'minor'>('major');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedMajorForMinor, setSelectedMajorForMinor] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20; // 改为20条每页

  // 初始化复检数据
  useEffect(() => {
    if (videoId && annotatorName) {
      loadReviewData();
    }
  }, [videoId, annotatorName]);

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const { getAnnotations } = await import('../api/database');
      
      // 获取指定视频的所有标注数据
      const annotations = await getAnnotations(videoId);
      
      // 过滤出指定标注人的数据
      const annotatorData = annotations.filter(
        item => item.annotator === annotatorName
      );
      
      console.log('📋 复检数据:', {
        videoId,
        videoName,
        annotatorName,
        total: annotations.length,
        filtered: annotatorData.length
      });
      
      setReviewData(annotatorData);
      message.success(`加载了${annotatorName}的 ${annotatorData.length} 条标注数据`);
    } catch (error) {
      console.error('加载复检数据失败:', error);
      message.error('加载复检数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 构建级联选择器选项
  const categoryOptions = categories.map(cat => ({
    value: cat.majorCategory,
    label: cat.majorCategory,
    children: cat.minorCategories.map(sub => ({
      value: sub,
      label: sub
    }))
  }));

  // 过滤数据
  const filteredData = selectedMajorCategory === 'all'
    ? reviewData
    : reviewData.filter(item => item.majorCategory === selectedMajorCategory);

  // 更新复检项
  const updateReview = (id: string, field: string, value: any) => {
    setReviewData(prev =>
      prev.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 处理问题分类选择（支持多选）
  const handleCategoryChange = (id: string, value: [string, string][] | null) => {
    if (value && value.length > 0) {
      // 提取所有选中的大类和小类
      const majorCategories = value.map(v => v[0]);
      const minorCategories = value.map(v => v[1]);
      
      // 使用逗号分隔存储多个分类
      updateReview(id, 'majorCategory', [...new Set(majorCategories)].join(','));
      updateReview(id, 'minorCategory', minorCategories.join(','));
    } else {
      updateReview(id, 'majorCategory', '');
      updateReview(id, 'minorCategory', '');
    }
  };

  // 打开新建类别弹窗
  const openNewCategoryModal = () => {
    setNewCategoryName('');
    setSelectedMajorForMinor('');
    setIsModalVisible(true);
  };

  // 新建类别
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入类别名称');
      return;
    }

    if (newCategoryType === 'major') {
      // 新建大类
      if (categories.some(cat => cat.majorCategory === newCategoryName)) {
        message.warning('该大类已存在');
        return;
      }
      setCategories([...categories, {
        majorCategory: newCategoryName,
        minorCategories: []
      }]);
      message.success('大类创建成功');
    } else {
      // 新建小类
      if (!selectedMajorForMinor) {
        message.warning('请选择所属大类');
        return;
      }
      const major = categories.find(cat => cat.majorCategory === selectedMajorForMinor);
      if (major && major.minorCategories.includes(newCategoryName)) {
        message.warning('该小类已存在');
        return;
      }
      setCategories(prev => prev.map(cat =>
        cat.majorCategory === selectedMajorForMinor
          ? { ...cat, minorCategories: [...cat.minorCategories, newCategoryName] }
          : cat
      ));
      message.success('小类创建成功');
    }

    setIsModalVisible(false);
  };

  // 提交复检 - 第一步：打开复检人姓名输入弹窗
  const handleSubmit = () => {
    const reviewedCount = reviewData.filter(item => item.status).length;
    
    if (reviewedCount === 0) {
      message.warning('请至少复检一条数据');
      return;
    }
    
    setIsReviewerModalVisible(true);
  };

  // 提交复检 - 第二步：确认提交并保存到数据库
  const confirmSubmit = async () => {
    if (!reviewerName.trim()) {
      message.warning('请输入复检人姓名');
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 1. 获取所有已复检的数据ID
      const reviewedItems = reviewData.filter(item => item.status);
      const reviewedIds = reviewedItems.map(item => item.id);
      
      console.log('📝 准备保存复检结果:', {
        videoId,
        videoName,
        annotatorName,
        reviewerName,
        reviewedCount: reviewedItems.length,
        reviewedIds
      });

      // 2. 批量更新复检状态和备注
      // 使用循环来保存每条数据的备注（因为备注可能不同）
      const updatePromises = reviewedItems.map(item => 
        supabase
          .from('annotations')
          .update({
            reviewer: reviewerName,
            review_status: true,
            status: true,
            remark: item.remark || '' // 保存备注
          })
          .eq('id', item.id)
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        console.error('❌ 部分更新失败:', errors);
        throw new Error('部分数据更新失败');
      }

      console.log('✅ 批量更新成功，共更新', reviewedIds.length, '条数据');

      // 3. 检查该视频的该标注人是否所有数据都复检完成
      const allReviewed = reviewData.every(item => item.status);
      
      if (allReviewed) {
        console.log('✅ 该标注人的所有数据已复检完成，标记视频为完成状态');
        
        // 标记视频为已完成
        const { error: videoError } = await supabase
          .from('videos')
          .update({
            is_completed: true,
            review_completed_at: new Date().toISOString()
          })
          .eq('id', videoId);

        if (videoError) {
          console.error('❌ 更新视频状态失败:', videoError);
        } else {
          console.log('✅ 视频已标记为完成');
        }
      }

      message.success(`复检完成！共复检 ${reviewedItems.length} 条数据，复检人：${reviewerName}`);
      setIsReviewerModalVisible(false);
      
      setTimeout(() => {
        navigate('/review-select');
      }, 1500);
    } catch (error) {
      console.error('❌ 提交复检失败:', error);
      message.error('提交复检失败，请重试');
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
      width: 140
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 80,
      render: (text: string) => <Tag color="purple">{text}</Tag>
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
      title: '问题分类',
      key: 'category',
      width: 250,
      render: (_: any, record: AnnotationItem) => {
        // 将存储的逗号分隔字符串转换为数组格式
        let currentValue: [string, string][] | undefined;
        if (record.majorCategory && record.minorCategory) {
          const majors = record.majorCategory.split(',').filter(Boolean);
          const minors = record.minorCategory.split(',').filter(Boolean);
          
          // 组合成 [[大类1, 小类1], [大类2, 小类2], ...] 格式
          currentValue = minors.map((minor, index) => {
            // 找到该小类对应的大类
            const matchedCategory = categories.find(cat => 
              cat.minorCategories.includes(minor)
            );
            return [matchedCategory?.majorCategory || majors[0] || '', minor];
          });
        }
        
        return (
          <Cascader
            options={categoryOptions}
            onChange={(value) => handleCategoryChange(record.id, value as [string, string][] | null)}
            value={currentValue}
            placeholder="选择问题大类和小类（可多选）"
            style={{ width: '100%' }}
            showSearch
            multiple
            maxTagCount="responsive"
            size="small"
          />
        );
      }
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (text: string, record: AnnotationItem) => {
        return (
          <Input.TextArea
            value={text || ''}
            onChange={(e) => updateReview(record.id, 'remark', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder="添加备注..."
            style={{ fontSize: '13px' }}
          />
        );
      }
    },
    {
      title: '复检状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (checked: boolean, record: AnnotationItem) => (
        <Checkbox
          checked={checked}
          onChange={(e) => updateReview(record.id, 'status', e.target.checked)}
        />
      )
    }
  ];

  const reviewedCount = filteredData.filter(item => item.status).length;

  return (
    <Layout className="review-layout">
      <Header className="review-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/review-select')}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            产品复检{videoName && ` - ${videoName}`}{annotatorName && ` - ${annotatorName}`}
          </Title>
        </Space>
      </Header>

      <Content className="review-content">
        <div className="review-container">
          {/* 视频播放器 */}
          <Card title="原视频" className="video-card">
            <div className="video-wrapper">
              <ReactPlayer
                ref={playerRef}
                url={reviewData[0]?.videoUrl}
                controls
                width="100%"
                height="100%"
              />
            </div>
          </Card>

          {/* 右侧：筛选和表格 */}
          <div className="review-table-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 筛选和操作栏 */}
            <Card>
              <Space size="large">
                <span>问题大类筛选：</span>
                <Select
                  value={selectedMajorCategory}
                  onChange={setSelectedMajorCategory}
                  style={{ width: 200 }}
                >
                  <Option value="all">全部</Option>
                  {categories.map(cat => (
                    <Option key={cat.majorCategory} value={cat.majorCategory}>
                      {cat.majorCategory}
                    </Option>
                  ))}
                </Select>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={openNewCategoryModal}
                >
                  新建类别
                </Button>
              </Space>
            </Card>

            {/* 复检表格 */}
            <Card
              title={`复检内容 - ${selectedMajorCategory === 'all' ? '全部' : selectedMajorCategory}`}
              extra={
                <Space>
                  <span>已复检：{reviewedCount} / {filteredData.length}</span>
                  <Button type="primary" onClick={handleSubmit}>
                    提交复检
                  </Button>
                </Space>
              }
            >
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 1600 }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: filteredData.length,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`
              }}
            />
          </Card>
          </div>
        </div>
      </Content>

      {/* 新建类别弹窗 */}
      <Modal
        title="新建类别"
        open={isModalVisible}
        onOk={handleCreateCategory}
        onCancel={() => setIsModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>类别类型</label>
            <Select
              value={newCategoryType}
              onChange={setNewCategoryType}
              style={{ width: '100%' }}
            >
              <Option value="major">问题大类</Option>
              <Option value="minor">问题小类</Option>
            </Select>
          </div>

          {newCategoryType === 'minor' && (
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>所属大类</label>
              <Select
                value={selectedMajorForMinor}
                onChange={setSelectedMajorForMinor}
                placeholder="选择所属大类"
                style={{ width: '100%' }}
              >
                {categories.map(cat => (
                  <Option key={cat.majorCategory} value={cat.majorCategory}>
                    {cat.majorCategory}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>类别名称</label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="请输入类别名称"
            />
          </div>
        </Space>
      </Modal>

      {/* 复检人姓名输入弹窗 */}
      <Modal
        title="提交复检"
        open={isReviewerModalVisible}
        onOk={confirmSubmit}
        onCancel={() => setIsReviewerModalVisible(false)}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={loading}
      >
        <div style={{ padding: '20px 0' }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            复检人姓名 <span style={{ color: 'red' }}>*</span>
          </label>
          <Input
            placeholder="请输入复检人姓名"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            onPressEnter={confirmSubmit}
            size="large"
          />
          <div style={{ marginTop: 16, color: '#666', fontSize: '14px' }}>
            <p>即将提交 <strong>{reviewData.filter(item => item.status).length}</strong> 条复检数据</p>
            <p>视频：{videoName}</p>
            <p>标注人：{annotatorName}</p>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

