import { useState, useEffect } from 'react';
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
import { PROBLEM_CATEGORIES } from '../mock/data';
import type { AnnotationItem, ProblemCategory } from '../types';
import './ReviewPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从路由获取视频ID、视频名称和标注人姓名
  const videoId = location.state?.videoId;
  const videoName = location.state?.videoName;
  const annotatorName = location.state?.annotatorName;
  
  const [reviewData, setReviewData] = useState<AnnotationItem[]>([]);
  const [categories, setCategories] = useState<ProblemCategory[]>(PROBLEM_CATEGORIES);
  const [selectedMajorCategory, setSelectedMajorCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  // 处理问题分类选择
  const handleCategoryChange = (id: string, value: [string, string] | null) => {
    if (value) {
      updateReview(id, 'majorCategory', value[0]);
      updateReview(id, 'minorCategory', value[1]);
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

  // 提交复检
  const handleSubmit = () => {
    const reviewedCount = filteredData.filter(item => item.status).length;
    message.success(`复检完成！共复检 ${reviewedCount} 条数据`);
    setTimeout(() => {
      navigate('/');
    }, 1500);
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
      render: (_: any, record: AnnotationItem) => (
        <Cascader
          options={categoryOptions}
          onChange={(value) => handleCategoryChange(record.id, value as [string, string] | null)}
          value={
            record.majorCategory && record.minorCategory
              ? [record.majorCategory, record.minorCategory]
              : undefined
          }
          placeholder="选择问题大类和小类"
          style={{ width: '100%' }}
          showSearch
        />
      )
    },
    {
      title: '教研备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180
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
          {/* 筛选和操作栏 */}
          <Card style={{ marginBottom: 24 }}>
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
    </Layout>
  );
}

