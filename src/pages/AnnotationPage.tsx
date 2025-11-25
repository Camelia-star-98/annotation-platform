import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Select,
  Input,
  Checkbox,
  Button,
  Space,
  message,
  Typography,
  Cascader,
  Tag
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactPlayer from 'react-player';
import { generateMockAnnotations } from '../mock/data';
import type { AnnotationItem, ProblemCategory } from '../types';
import { getVideos, saveAnnotations, getProblemCategories } from '../api/database';
import { supabase } from '../api/supabase';
import './AnnotationPage.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

export default function AnnotationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef<ReactPlayer>(null);
  
  // 支持三种模式：
  // 1. 旧模式：从主页传入 videos 数组
  // 2. 新模式：从任务列表传入 videoId、videoName、annotatorName
  // 3. 重标模式：isReannotation=true, focusItemId 指定要重新标注的项
  const userName = location.state?.annotatorName || location.state?.userName || '未知用户';
  const videos = location.state?.videos || [];
  const videoId = location.state?.videoId;
  const videoName = location.state?.videoName;
  const uploadedAnnotations = location.state?.annotations || null;
  const isUploadMode = location.state?.isUploadMode || false;
  const isReannotation = location.state?.isReannotation || false;
  const focusItemId = location.state?.focusItemId || null;
  
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const pageSize = 20; // 修改为每页20条

  // 加载问题分类
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const loadedCategories = await getProblemCategories();
      setCategories(loadedCategories);
      console.log('✅ 加载了', loadedCategories.length, '个问题分类');
    } catch (error) {
      console.error('加载问题分类失败:', error);
      message.error('加载问题分类失败');
    }
  };

  // 加载视频数据（新模式）
  useEffect(() => {
    if (videoId && !videos.length) {
      loadVideoData(videoId);
    }
  }, [videoId]);

  const loadVideoData = async (id: string) => {
    setLoading(true);
    try {
      // 获取视频信息
      const allVideos = await getVideos();
      const video = allVideos.find(v => v.id === id);
      
      if (video) {
        setCurrentVideo(video);
      }
      
      // 获取当前标注人的标注数据
      console.log('🔍 查询标注数据 - 视频ID:', id, '标注人:', userName);
      const { data: myAnnotations, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('video_id', id)
        .eq('annotator', userName)
        .order('sentence_no', { ascending: true });

      if (error) {
        console.error('❌ 获取标注数据失败:', error);
        throw error;
      }

      console.log('📊 找到的标注数据:', myAnnotations?.length || 0, '条');
      
      if (myAnnotations && myAnnotations.length > 0) {
        // 已有标注数据，加载自己的标注
        console.log('✅ 找到您的标注数据:', myAnnotations.length, '条');
        console.log('📝 第一条数据示例:', myAnnotations[0]);
        
        const formattedData = myAnnotations.map(item => ({
          id: item.id,
          videoId: item.video_id,
          sentenceNo: item.sentence_no,
          timeRange: item.time_range,
          startTime: item.start_time,
          endTime: item.end_time,
          originalText: item.original_text,
          aiRewrittenText: item.ai_rewritten_text,
          humanAnnotatedText: item.human_annotated_text,
          majorCategory: item.major_category || '',
          minorCategory: item.minor_category || '',
          remark: item.remark || '',
          status: item.status || false,
          annotator: item.annotator || '',
          isQualified: item.is_qualified,
          inspector: item.inspector || '',
          reviewer: item.reviewer || '',
          reviewStatus: item.review_status,
          videoUrl: video?.url || '',
          videoName: video?.name || '',
          subject: video?.subject || ''
        }));
        
        console.log('📊 格式化后的数据示例:', formattedData[0]);
        
        setAnnotations(formattedData);
        message.success(`加载了您的标注数据：${formattedData.length} 条`);
        
        // 额外检查：如果第一条数据的原文为空，显示警告
        if (formattedData.length > 0 && !formattedData[0].originalText) {
          console.error('⚠️ 警告：第一条数据的原文为空！');
          console.error('原始数据:', myAnnotations[0]);
          console.error('格式化数据:', formattedData[0]);
          message.warning('数据加载异常：原文为空，请检查数据库');
        }
      } else {
        // 第一次标注，加载原始数据模板（任意一个标注人的数据作为模板，或者从上传的数据）
        console.log('🆕 第一次标注，加载原始数据模板');
        console.log('🔍 查询模板数据 - video_id:', id);
        
        // 优先获取没有标注人（annotator为空）的原始数据作为模板
        // 如果没有，则获取最早上传的数据作为模板
        const { data: templateData, error: templateError } = await supabase
          .from('annotations')
          .select('*')
          .eq('video_id', id)
          .or('annotator.is.null,annotator.eq.')  // 优先选择没有标注人的原始数据
          .order('created_at', { ascending: true })  // 按创建时间升序，取最早的
          .limit(200);

        // 如果没有原始数据，则使用任意标注人的数据作为模板
        let finalTemplateData = templateData;
        if (!templateData || templateData.length === 0) {
          console.log('⚠️ 没有找到原始模板数据，使用第一个标注人的数据');
          const { data: fallbackData } = await supabase
            .from('annotations')
            .select('*')
            .eq('video_id', id)
            .order('created_at', { ascending: true })
            .limit(200);
          finalTemplateData = fallbackData;
        }

        if (templateError) {
          console.error('❌ 查询模板数据失败:', templateError);
        }
        
        console.log('📦 模板数据返回:', finalTemplateData?.length || 0, '条');
        if (finalTemplateData && finalTemplateData.length > 0) {
          console.log('📝 模板数据第一条:', finalTemplateData[0]);
          console.log('📝 human_annotated_text:', finalTemplateData[0].human_annotated_text);
        }

        if (finalTemplateData && finalTemplateData.length > 0) {
          // 使用模板数据，保留所有字段（包括 human_annotated_text）
          const newAnnotations = finalTemplateData.map((item, index) => ({
            id: `${id}_${item.sentence_no || index + 1}_${userName}`, // 新ID包含当前标注人
            videoId: id,
            sentenceNo: item.sentence_no,
            timeRange: item.time_range,
            startTime: item.start_time,
            endTime: item.end_time,
            originalText: item.original_text,
            aiRewrittenText: item.ai_rewritten_text,
            humanAnnotatedText: item.human_annotated_text || '', // ✅ 保留原始的人工改写文本作为初始值
            majorCategory: item.major_category || '',
            minorCategory: item.minor_category || '',
            remark: item.remark || '',
            status: false, // 标注状态默认为未完成
            annotator: userName,
            isQualified: undefined,
            inspector: '',
            reviewer: '',
            reviewStatus: undefined,
            videoUrl: video?.url || '',
            videoName: video?.name || '',
            subject: video?.subject || ''
          }));
          
          console.log('📋 格式化后的第一条数据:', newAnnotations[0]);
          console.log('📋 humanAnnotatedText 值:', newAnnotations[0]?.humanAnnotatedText);
          
          setAnnotations(newAnnotations);
          message.info(`首次标注：加载了 ${newAnnotations.length} 条待标注数据（含参考答案）`);
        } else {
          message.warning('该视频暂无标注数据模板');
        }
      }
    } catch (error) {
      console.error('加载视频数据失败:', error);
      message.error('加载视频数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据（旧模式 - 仅在没有 videoId 时使用）
  useEffect(() => {
    console.log('🔄 旧模式 useEffect 触发');
    console.log('videoId:', videoId);
    console.log('videos.length:', videos.length);
    console.log('isUploadMode:', isUploadMode);
    
    // 只有在旧模式下（没有 videoId 参数时）才使用模拟数据
    if (!videoId) {
      console.log('✅ 旧模式：没有 videoId，使用模拟数据');
      if (isUploadMode && uploadedAnnotations) {
        // 使用上传的数据
        console.log('📤 使用上传的数据');
        setAnnotations(uploadedAnnotations);
      } else if (videos.length > 0) {
        // 使用模拟数据
        console.log('🎭 使用模拟数据，数量:', 160);
        const mockData = generateMockAnnotations(videos[currentVideoIndex].id);
        setAnnotations(mockData);
      }
    } else {
      console.log('⚠️ 新模式：有 videoId，跳过模拟数据加载');
    }
  }, [currentVideoIndex, videos, uploadedAnnotations, isUploadMode, videoId]);

  // 构建级联选择器选项
  const categoryOptions = (categories || []).map(cat => ({
    value: cat.majorCategory,
    label: cat.majorCategory,
    children: (cat.minorCategories || []).map(sub => ({
      value: sub,
      label: sub
    }))
  }));

  // 点击时间戳跳转视频
  const handleTimeClick = (startTime: number) => {
    // 检查是否有视频URL
    if (!displayVideo?.url) {
      message.info('此数据集没有关联视频');
      return;
    }
    
    if (playerRef.current) {
      playerRef.current.seekTo(startTime, 'seconds');
    }
  };

  // 更新标注项
  const updateAnnotation = (id: string, field: string, value: any) => {
    setAnnotations(prev =>
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
      updateAnnotation(id, 'majorCategory', [...new Set(majorCategories)].join(','));
      updateAnnotation(id, 'minorCategory', minorCategories.join(','));
    } else {
      updateAnnotation(id, 'majorCategory', '');
      updateAnnotation(id, 'minorCategory', '');
    }
  };

  // 提交标注
  const handleSubmit = async () => {
    const completedCount = annotations.filter(item => item.status).length;
    
    if (completedCount === 0) {
      message.warning('请至少完成一条标注');
      return;
    }

    try {
      // 使用 Supabase - 确保每条数据都有标注人姓名
      // 重新提交时，清除质检相关字段，让数据重新进入质检流程
      // 但要保留复检相关字段（reviewer, reviewStatus）
      const annotationsWithUser = annotations.map(item => ({
        ...item,
        annotator: userName, // 添加标注人姓名
        // 清除质检相关字段，重置为待质检状态
        isQualified: undefined,
        inspector: '',
        // 明确保留复检相关字段
        reviewer: item.reviewer,
        reviewStatus: item.reviewStatus,
      }));
      
      console.log('📤 提交标注数据，已清除质检状态（保留复检状态），数据将重新进入质检队列');
      
      const currentVideoId = videoId || videos[currentVideoIndex]?.id || 'unknown';
      const success = await saveAnnotations(currentVideoId, annotationsWithUser);
      
      if (success) {
        message.success(`标注完成！共标注 ${completedCount} 条数据，已保存并重新进入质检队列`);
        setTimeout(() => navigate(-1), 1500);
      } else {
        message.error('保存失败，请重试');
      }
    } catch (error) {
      console.error('保存标注数据失败:', error);
      message.error('保存失败，请检查后端服务');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '句子编号',
      dataIndex: 'sentenceNo',
      key: 'sentenceNo',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const
    },
    {
      title: '时间范围',
      dataIndex: 'timeRange',
      key: 'timeRange',
      width: 120,
      render: (text: string, record: AnnotationItem) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleTimeClick(record.startTime)}
          style={{ padding: 0, height: 'auto' }}
        >
          {text}
        </Button>
      )
    },
    {
      title: '原文文本',
      dataIndex: 'originalText',
      key: 'originalText',
      width: 180,
      ellipsis: false,
      render: (text: string) => (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          lineHeight: '1.4',
          fontSize: '13px'
        }}>
          {text}
        </div>
      )
    },
    {
      title: '大模型改写文本',
      dataIndex: 'aiRewrittenText',
      key: 'aiRewrittenText',
      width: 180,
      ellipsis: false,
      render: (text: string) => (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          lineHeight: '1.4',
          fontSize: '13px'
        }}>
          {text}
        </div>
      )
    },
    {
      title: '人工标注文本',
      dataIndex: 'humanAnnotatedText',
      key: 'humanAnnotatedText',
      width: 180,
      ellipsis: false,
      render: (text: string, record: AnnotationItem) => {
        return (
          <TextArea
            value={text || ''}
            onChange={(e) => updateAnnotation(record.id, 'humanAnnotatedText', e.target.value)}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder="请输入人工标注文本..."
            style={{ fontSize: '13px' }}
          />
        );
      }
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
            placeholder="选择问题类型（可多选）"
            style={{ width: '100%' }}
            size="small"
            showSearch
            multiple
            maxTagCount="responsive"
          />
        );
      }
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (text: string, record: AnnotationItem) => (
        <TextArea
          value={text || ''}
          onChange={(e) => updateAnnotation(record.id, 'remark', e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="添加备注..."
          style={{ fontSize: '13px' }}
        />
      )
    },
    {
      title: '质检状态',
      dataIndex: 'isQualified',
      key: 'isQualified',
      width: 100,
      align: 'center' as const,
      render: (isQualified: boolean | undefined, record: AnnotationItem) => {
        if (isQualified === false) {
          return <Tag color="red">❌ 未通过</Tag>;
        } else if (isQualified === true) {
          return <Tag color="green">✅ 已通过</Tag>;
        } else if (record.status) {
          // 已标注但未质检
          return <Tag color="orange">⏳ 待质检</Tag>;
        } else {
          return <Tag color="default">未标注</Tag>;
        }
      }
    },
    {
      title: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <span>标注状态</span>
          <Button 
            type="link" 
            size="small" 
            onClick={() => {
              const allChecked = annotations.every(item => item.status);
              setAnnotations(annotations.map(item => ({ ...item, status: !allChecked })));
            }}
            style={{ padding: 0, height: 'auto' }}
          >
            {annotations.every(item => item.status) ? '取消全选' : '全选'}
          </Button>
        </div>
      ),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (checked: boolean, record: AnnotationItem) => (
        <Checkbox
          checked={checked}
          onChange={(e) => updateAnnotation(record.id, 'status', e.target.checked)}
        />
      )
    }
  ];

  if (!loading && videos.length === 0 && !currentVideo) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>暂无视频数据</div>;
  }

  // 确定当前显示的视频：优先使用 currentVideo（新模式），否则使用 videos 数组（旧模式）
  const displayVideo = currentVideo || (videos.length > 0 ? videos[currentVideoIndex] : null);

  return (
    <Layout className="annotation-layout">
      <Header className="annotation-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            教研标注 - {userName}
          </Title>
        </Space>
      </Header>

      <Content className="annotation-content">
        <div className="annotation-container">
          {/* 视频播放器 */}
          <Card title={`原视频：${displayVideo?.name || videoName || '未命名视频'}`} className="video-card">
            <div className="video-wrapper">
              {displayVideo?.url ? (
                <ReactPlayer
                  ref={playerRef}
                  url={displayVideo.url}
                  controls
                  width="100%"
                  height="100%"
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '400px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: '#f5f5f5',
                  border: '2px dashed #d9d9d9',
                  borderRadius: '8px',
                  flexDirection: 'column'
                }}>
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    {loading ? (
                      <div>
                        <div style={{ fontSize: 16 }}>加载中...</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                        <div style={{ fontSize: 16, fontWeight: 500 }}>此数据集没有关联视频</div>
                        <div style={{ fontSize: 14, marginTop: 8 }}>仅包含标注数据</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 标注表格 */}
          <Card
            className="annotation-table-card"
            title={`标注内容 (共 ${annotations.length} 条${annotations.length > 0 && annotations[0].originalText ? ' ✅' : ' ⚠️数据异常'})`}
            extra={
              <Space>
                <span>已标注：{annotations.filter(a => a.status).length} / {annotations.length}</span>
                <Button type="primary" onClick={handleSubmit}>
                  提交标注
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={[...annotations].sort((a, b) => (a.sentenceNo || 0) - (b.sentenceNo || 0))}
              rowKey="id"
              size="small"
              scroll={{ x: 1000 }}
              rowClassName={(record) => {
                // 重标模式：如果是当前要重新标注的项，用橙色背景
                if (isReannotation && record.id === focusItemId) {
                  return 'row-reannotation-focus';
                }
                // 质检未通过的数据行用红色背景标识
                if (record.isQualified === false) {
                  return 'row-failed-inspection';
                }
                // 对比大模型改写文本和人工标注文本，不一致时整行标红
                // 使用annotations state中的最新值，确保修改后能实时更新
                const currentAnnotation = annotations.find(a => a.id === record.id);
                const humanText = currentAnnotation?.humanAnnotatedText || record.humanAnnotatedText || '';
                const aiText = currentAnnotation?.aiRewrittenText || record.aiRewrittenText || '';
                const isDifferent = humanText.trim() && aiText.trim() && 
                  humanText.trim() !== aiText.trim();
                if (isDifferent) {
                  return 'row-different-text';
                }
                return '';
              }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: annotations.length,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
                size: 'small'
              }}
            />
          </Card>
        </div>
      </Content>
    </Layout>
  );
}

