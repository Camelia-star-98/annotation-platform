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
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
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

  // 初始化复检数据和分类
  useEffect(() => {
    loadCategories();
    if (videoId && annotatorName) {
      loadReviewData();
    }
  }, [videoId, annotatorName]);

  // 加载问题分类
  const loadCategories = async () => {
    try {
      const { getProblemCategories } = await import('../api/database');
      const loadedCategories = await getProblemCategories();
      setCategories(loadedCategories);
      console.log('✅ 加载了', loadedCategories.length, '个问题分类');
      if (loadedCategories.length === 0) {
        console.warn('⚠️ 未加载到任何问题分类，可能是网络问题或数据库为空');
      }
    } catch (error) {
      console.error('获取问题分类失败:', error instanceof Error ? { message: error.message, details: error } : error);
      message.error('加载问题分类失败，请检查网络连接');
    }
  };

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const { getAnnotations } = await import('../api/database');
      
      // 获取指定视频的所有标注数据
      const annotations = await getAnnotations(videoId);
      
      // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
      // 优先保留有质检状态的数据，如果都有质检状态则保留最新的
      const deduplicatedMap = new Map<string, any>();
      
      annotations.forEach(ann => {
        const key = `${ann.videoId}_${ann.sentenceNo}_${ann.annotator}`;
        const existing = deduplicatedMap.get(key);
        
        if (!existing) {
          deduplicatedMap.set(key, ann);
        } else {
          // 优先保留有质检状态的数据
          const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && existing.isQualified === true;
          const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && ann.isQualified === true;
          
          if (currentHasInspection && !existingHasInspection) {
            // 当前数据有质检状态，旧数据没有，保留当前数据
            deduplicatedMap.set(key, ann);
          } else if (existingHasInspection && !currentHasInspection) {
            // 旧数据有质检状态，当前数据没有，保留旧数据
            // 不做任何操作
          } else {
            // 都有或都没有质检状态，保留最新的（按 updated_at，但 AnnotationItem 可能没有这个字段，所以按 ID 或其他逻辑）
            // 如果都有质检状态，优先保留最新的
            deduplicatedMap.set(key, ann); // 简单策略：保留后遇到的（通常是更新的）
          }
        }
      });
      
      const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
      
      // 🔧 抽检逻辑：检查该标注人是否有至少一条质检通过的数据
      const hasQualifiedData = deduplicatedAnnotations.some(item => {
        const hasHumanText = item.humanAnnotatedText && item.humanAnnotatedText.trim() !== '';
        const isQualified = item.inspector && item.inspector.trim() !== '' && item.isQualified === true;
        return item.annotator === annotatorName && hasHumanText && isQualified;
      });
      
      // 🔧 新逻辑：如果该标注人有质检通过的数据（抽检通过），则加载所有有标注文本的数据
      // 否则只加载质检通过的数据（旧逻辑）
      const annotatorData = deduplicatedAnnotations.filter(item => {
        if (item.annotator !== annotatorName) return false;
        
        const hasHumanText = item.humanAnnotatedText && item.humanAnnotatedText.trim() !== '';
        if (!hasHumanText) return false; // 没有标注文本的不加载
        
        // 如果该标注人通过了抽检，加载所有有标注文本的数据
        if (hasQualifiedData) {
          return true;
        }
        
        // 否则只加载质检通过的数据（兼容旧逻辑）
        return item.inspector && item.inspector.trim() !== '' && item.isQualified === true;
      });
      
      const totalForAnnotator = deduplicatedAnnotations.filter(item => item.annotator === annotatorName).length;
      const originalTotal = annotations.filter(item => item.annotator === annotatorName).length;
      const withHumanText = deduplicatedAnnotations.filter(item => {
        const hasHumanText = item.humanAnnotatedText && item.humanAnnotatedText.trim() !== '';
        return item.annotator === annotatorName && hasHumanText;
      }).length;
      const withInspector = deduplicatedAnnotations.filter(item => 
        item.annotator === annotatorName && item.inspector && item.inspector.trim() !== ''
      ).length;
      const qualified = deduplicatedAnnotations.filter(item => 
        item.annotator === annotatorName && item.isQualified === true
      ).length;
      const qualifiedWithInspector = deduplicatedAnnotations.filter(item => 
        item.annotator === annotatorName && 
        item.inspector && 
        item.inspector.trim() !== '' &&
        item.isQualified === true
      ).length;
      
      console.log('📋 复检数据筛选 (抽检逻辑):', {
        videoId,
        videoName,
        annotatorName,
        原始总数: originalTotal,
        去重后总数: totalForAnnotator,
        去除了: originalTotal - totalForAnnotator,
        有标注文本: withHumanText,
        有质检人: withInspector,
        质检通过: qualified,
        有质检人且通过: qualifiedWithInspector,
        该标注人是否通过抽检: hasQualifiedData,
        最终筛选结果: annotatorData.length,
        说明: hasQualifiedData ? '抽检通过，加载所有有标注文本的数据' : '未通过抽检或无质检数据，只加载质检通过的数据'
      });
      
      setReviewData(annotatorData);
      if (annotatorData.length === 0) {
        const inspectedCount = deduplicatedAnnotations.filter(
          item => item.annotator === annotatorName && item.inspector && item.inspector.trim() !== ''
        ).length;
        
        if (totalForAnnotator === 0) {
          message.warning(`未找到${annotatorName}的标注数据，请检查视频ID和标注人姓名`);
        } else if (inspectedCount === 0) {
          message.warning(`未找到${annotatorName}的已质检数据，请先完成质检`);
        } else if (!hasQualifiedData) {
          message.warning(`${annotatorName}没有质检通过的数据，无法进入复检流程`);
        } else {
          message.warning(`未找到${annotatorName}的待复检数据`);
        }
      } else {
        const msg = hasQualifiedData 
          ? `加载了${annotatorName}的 ${annotatorData.length} 条待复检数据（抽检通过，包含所有有标注的内容）`
          : `加载了${annotatorName}的 ${annotatorData.length} 条已质检数据`;
        message.success(msg);
      }
    } catch (error) {
      console.error('获取标注数据失败:', error instanceof Error ? { message: error.message, details: error } : error);
      message.error('加载复检数据失败，请检查网络连接或稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 构建级联选择器选项
  const categoryOptions = (categories || []).map(cat => ({
    value: cat.majorCategory,
    label: cat.majorCategory,
    children: (cat.minorCategories || []).map(sub => ({
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

  // 处理问题分类选择（支持多选，但有互斥规则）
  const handleCategoryChange = (id: string, value: [string, string][] | null) => {
    if (value && value.length > 0) {
      const EXCLUSIVE_MINOR = '老师说话句意不通'; // 完全互斥的小类
      const EXCLUSIVE_MAJORS = ['人工个性化改写', '需要删除']; // 内部互斥的大类列表
      
      // 检查是否包含"老师说话句意不通"
      const hasExclusiveMinor = value.some(v => v[1] === EXCLUSIVE_MINOR);
      
      let finalValue = value;
      let warningMessage = '';
      
      // 规则1：如果选择了"老师说话句意不通"，只保留这一项
      if (hasExclusiveMinor) {
        finalValue = value.filter(v => v[1] === EXCLUSIVE_MINOR);
        
        if (value.length > 1) {
          warningMessage = '「老师说话句意不通」不能与其他问题分类同时选择，已自动清除其他选项';
        }
      } else {
        // 规则2：检查每个互斥大类，如果该大类有多个小类被选中，只保留最新的
        EXCLUSIVE_MAJORS.forEach(majorCategory => {
          const itemsOfThisMajor = value.filter(v => v[0] === majorCategory);
          
          if (itemsOfThisMajor.length > 1) {
            // 保留最新选择的小类
            const latestItem = itemsOfThisMajor[itemsOfThisMajor.length - 1];
            
            // 移除该大类的所有旧选项，保留最新的
            finalValue = finalValue.filter(v => v[0] !== majorCategory);
            finalValue.push(latestItem);
            
            warningMessage = `「${majorCategory}」大类下的小类不能同时选择，已自动保留最新选项`;
          }
        });
        
        // 规则3：移除"老师说话句意不通"（如果之前选了其他的）
        finalValue = finalValue.filter(v => v[1] !== EXCLUSIVE_MINOR);
      }
      
      // 显示警告信息
      if (warningMessage) {
        message.warning(warningMessage);
      }
      
      // 提取所有选中的大类和小类
      const majorCategories = finalValue.map(v => v[0]);
      const minorCategories = finalValue.map(v => v[1]);
      
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
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入类别名称');
      return;
    }

    try {
      const { addProblemCategory } = await import('../api/database');

      if (newCategoryType === 'major') {
        // 新建大类（添加一个默认小类）
        if (categories.some(cat => cat.majorCategory === newCategoryName)) {
          message.warning('该大类已存在');
          return;
        }
        
        // 保存到数据库
        const success = await addProblemCategory(newCategoryName, '默认分类');
        if (success) {
          // 重新加载分类
          await loadCategories();
          message.success('大类创建成功');
        } else {
          message.error('创建失败，请重试');
        }
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
        
        // 保存到数据库
        const success = await addProblemCategory(selectedMajorForMinor, newCategoryName);
        if (success) {
          // 重新加载分类
          await loadCategories();
          message.success('小类创建成功');
        } else {
          message.error('创建失败，请重试');
        }
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error('创建类别失败:', error);
      message.error('创建类别失败');
    }
  };

  // 提交复检 - 第一步：打开复检人姓名输入弹窗
  const handleSubmit = () => {
    console.log('🔵 handleSubmit 被调用');
    console.log('📊 当前状态:', {
      reviewDataCount: reviewData.length,
      filteredDataCount: filteredData.length,
      reviewedCount: reviewData.filter(item => item.status).length,
      videoId,
      videoName,
      annotatorName
    });
    
    const reviewedCount = reviewData.filter(item => item.status).length;
    
    if (reviewedCount === 0) {
      console.warn('⚠️ 没有已复检的数据');
      message.warning('请至少复检一条数据');
      return;
    }
    
    console.log('✅ 准备打开复检人姓名输入弹窗，已复检数量:', reviewedCount);
    setIsReviewerModalVisible(true);
  };

  // 提交复检 - 第二步：确认提交并保存到数据库
  const confirmSubmit = async () => {
    console.log('🔵 confirmSubmit 被调用');
    
    if (!reviewerName.trim()) {
      console.warn('⚠️ 复检人姓名为空');
      message.warning('请输入复检人姓名');
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 1. 获取所有已复检的数据ID
      const reviewedItems = reviewData.filter(item => item.status);
      const reviewedIds = reviewedItems.map(item => item.id);
      
      if (reviewedIds.length === 0) {
        throw new Error('没有已复检的数据');
      }
      
      console.log('📝 准备保存复检结果:', {
        videoId,
        videoName,
        annotatorName,
        reviewerName,
        reviewedCount: reviewedItems.length,
        reviewedIds: reviewedIds.slice(0, 5) // 只显示前5个ID
      });

      // 2. 批量更新复检状态、备注、问题分类和文本内容
      // 使用循环来保存每条数据（因为备注、分类和文本可能不同）
      const updatePromises = reviewedItems.map((item, index) => {
        const updateData = {
            reviewer: reviewerName,
            review_status: true,
            status: true,
            remark: item.remark || '', // 保存备注
            major_category: item.majorCategory || '', // 保存问题大类
          minor_category: item.minorCategory || '', // 保存问题小类
          original_text: item.originalText || '', // 保存修改后的原文文本
          ai_rewritten_text: item.aiRewrittenText || '', // 保存修改后的大模型改写文本
          human_annotated_text: item.humanAnnotatedText || '' // 保存修改后的人工标注文本
        };
        
        console.log(`📦 更新第 ${index + 1} 条数据 (ID: ${item.id}):`, updateData);
        
        return supabase
          .from('annotations')
          .update(updateData)
          .eq('id', item.id);
      });

      console.log('⏳ 开始批量更新，共', updatePromises.length, '条数据');
      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        console.error('❌ 部分更新失败:', errors);
        errors.forEach((err, index) => {
          console.error(`错误 ${index + 1}:`, err.error);
        });
        throw new Error(`部分数据更新失败，共 ${errors.length} 条失败`);
      }

      console.log('✅ 批量更新成功，共更新', reviewedIds.length, '条数据');

      // 3. 🔧 检查该视频的所有标注人的所有数据是否都复检完成
      // 注意：一个视频可能有多个标注人，只有所有标注人的所有数据都复检完成，才标记视频为完成
      const { data: allVideoAnnotations, error: checkError } = await supabase
        .from('annotations')
        .select('annotator, review_status, human_annotated_text, inspector, is_qualified')
        .eq('video_id', videoId)
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .neq('annotator', 'unknown');
      
      if (checkError) {
        console.error('❌ 检查视频完成状态失败:', checkError);
      } else if (allVideoAnnotations && allVideoAnnotations.length > 0) {
        // 使用和 ReviewSelectPage 相同的抽检逻辑
        // 按标注人分组，检查每个标注人是否都完成了复检
        const annotatorMap = new Map<string, { total: number; reviewed: number; hasQualified: boolean }>();
        
        allVideoAnnotations.forEach(ann => {
          const annotator = ann.annotator;
          const hasHumanText = ann.human_annotated_text && ann.human_annotated_text.trim() !== '';
          
          if (!annotatorMap.has(annotator)) {
            annotatorMap.set(annotator, { total: 0, reviewed: 0, hasQualified: false });
          }
          
          const stats = annotatorMap.get(annotator)!;
          
          // 检查该标注人是否有质检通过的数据（抽检逻辑）
          const isQualified = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
          if (hasHumanText && isQualified) {
            stats.hasQualified = true;
          }
          
          // 统计有标注文本的数据
          if (hasHumanText) {
            stats.total++;
            if (ann.review_status === true) {
              stats.reviewed++;
            }
          }
        });
        
        // 检查每个标注人是否都完成了复检
        let allAnnotatorsCompleted = true;
        const annotatorStatus: string[] = [];
        
        annotatorMap.forEach((stats, annotator) => {
          // 只有通过抽检的标注人才需要复检
          if (stats.hasQualified) {
            const isCompleted = stats.reviewed === stats.total && stats.total > 0;
            annotatorStatus.push(`${annotator}: ${stats.reviewed}/${stats.total} ${isCompleted ? '✅' : '⏳'}`);
            
            if (!isCompleted) {
              allAnnotatorsCompleted = false;
            }
          } else {
            annotatorStatus.push(`${annotator}: 未通过抽检，无需复检`);
          }
        });
        
        console.log('📊 视频复检状态:', {
          videoId,
          标注人状态: annotatorStatus,
          所有标注人都完成: allAnnotatorsCompleted
        });
        
        if (allAnnotatorsCompleted) {
          console.log('✅ 该视频的所有标注人都已完成复检，标记视频为完成状态');
        
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
            message.warning('复检数据已保存，但更新视频状态失败');
          } else {
            console.log('✅ 视频已标记为完成');
          }
        } else {
          console.log('⏳ 该视频还有其他标注人未完成复检，暂不标记为完成');
        }
      }

      message.success(`复检完成！共复检 ${reviewedItems.length} 条数据，复检人：${reviewerName}`);
      setIsReviewerModalVisible(false);
      
      setTimeout(() => {
        navigate('/review-select');
      }, 1500);
    } catch (error) {
      console.error('❌ 提交复检失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`提交复检失败：${errorMessage}`);
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
      width: 180,
      render: (text: string, record: AnnotationItem) => {
        return (
          <Input.TextArea
            value={text || ''}
            onChange={(e) => updateReview(record.id, 'originalText', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder="原文文本"
            style={{ fontSize: '13px' }}
          />
        );
      }
    },
    {
      title: '大模型改写文本',
      dataIndex: 'aiRewrittenText',
      key: 'aiRewrittenText',
      width: 180,
      render: (text: string, record: AnnotationItem) => {
        return (
          <Input.TextArea
            value={text || ''}
            onChange={(e) => updateReview(record.id, 'aiRewrittenText', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder="大模型改写文本"
            style={{ fontSize: '13px' }}
          />
        );
      }
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 180,
      render: (text: string, record: AnnotationItem) => {
        return (
          <Input.TextArea
            value={text || ''}
            onChange={(e) => updateReview(record.id, 'humanAnnotatedText', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder="人工标注文本"
            style={{ fontSize: '13px' }}
          />
        );
      }
    },
    {
      title: '问题分类',
      key: 'category',
      width: 280,
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
            maxTagCount={2}
            displayRender={(labels) => labels.join(' / ')}
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
                  <Button 
                    type="primary" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔘 提交复检按钮被点击');
                      handleSubmit();
                    }}
                    disabled={loading}
                  >
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

