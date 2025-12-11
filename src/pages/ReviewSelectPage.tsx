import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Collapse,
  Tabs,
  Popconfirm,
  Checkbox
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  UserOutlined,
  VideoCameraOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;

interface AnnotatorData {
  annotatorName: string;
  totalAnnotations: number;
  reviewedCount: number;
  pendingCount: number;
  unannotatedCount: number; // 未标注数量
  reviewers: string[]; // 复检人列表
  inspectors: string[]; // 质检人列表
  lastReviewTime?: string; // 最后复检时间
  annotationFileName?: string; // 标注文件名
  submittedAt?: string; // 提交时间（最早的created_at）
}

interface VideoWithAnnotators {
  videoId: string;
  videoName: string;
  subject: string;
  annotators: AnnotatorData[];
  reviewCompletedAt?: string; // 复检完成时间
  annotationFileName?: string; // 标注文件名（从videos表获取）
}

export default function ReviewSelectPage() {
  console.log('✨ ReviewSelectPage 组件加载 - 版本 3.0 (稳定版)');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // 存储所有数据（不分页）
  const [allPendingVideos, setAllPendingVideos] = useState<VideoWithAnnotators[]>([]);
  const [allCompletedVideos, setAllCompletedVideos] = useState<VideoWithAnnotators[]>([]);
  
  // 分页状态（仅用于前端显示）
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const pendingPageSize = 20; // 待复检每页显示20个视频
  const completedPageSize = 20; // 已复检每页显示20个视频
  
  // 选中状态（跨页保留）
  const [selectedPendingVideoIds, setSelectedPendingVideoIds] = useState<Set<string>>(new Set());
  const [selectedCompletedVideoIds, setSelectedCompletedVideoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllPendingVideos();
    loadAllCompletedVideos();
  }, []);

  // 切换视频选中状态
  const toggleVideoSelection = (videoId: string, isPending: boolean) => {
    if (isPending) {
      const newSelected = new Set(selectedPendingVideoIds);
      if (newSelected.has(videoId)) {
        newSelected.delete(videoId);
      } else {
        newSelected.add(videoId);
      }
      setSelectedPendingVideoIds(newSelected);
    } else {
      const newSelected = new Set(selectedCompletedVideoIds);
      if (newSelected.has(videoId)) {
        newSelected.delete(videoId);
      } else {
        newSelected.add(videoId);
      }
      setSelectedCompletedVideoIds(newSelected);
    }
  };
  
  // 全选/取消全选当前页（跨页保留选中状态）
  const toggleSelectAll = (isPending: boolean) => {
    // 获取所有数据和当前页码
    const allVideos = isPending ? allPendingVideos : allCompletedVideos;
    const currentPage = isPending ? pendingPage : completedPage;
    const pageSize = isPending ? pendingPageSize : completedPageSize;
    
    // 计算当前页的视频切片
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const currentPageVideos = allVideos.slice(startIdx, endIdx);
    
    const currentSelected = isPending ? selectedPendingVideoIds : selectedCompletedVideoIds;
    const setSelected = isPending ? setSelectedPendingVideoIds : setSelectedCompletedVideoIds;
    
    const currentPageVideoIds = currentPageVideos.map(v => v.videoId);
    const allSelected = currentPageVideoIds.every(id => currentSelected.has(id));
    
    const newSelected = new Set(currentSelected);
    if (allSelected) {
      // 取消全选当前页
      currentPageVideoIds.forEach(id => newSelected.delete(id));
    } else {
      // 全选当前页
      currentPageVideoIds.forEach(id => newSelected.add(id));
    }
    setSelected(newSelected);
  };
  
  // 清空选中
  const clearSelection = (isPending: boolean) => {
    if (isPending) {
      setSelectedPendingVideoIds(new Set());
    } else {
      setSelectedCompletedVideoIds(new Set());
    }
  };

  // 加载待复检视频（一次性加载所有数据）
  const loadAllPendingVideos = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('📊 加载所有待复检视频...');
      
      // 1. 查询所有有标注的数据（video_id 去重，按时间降序）
      const { data: videoIds, error: videoError } = await supabase
        .from('annotations')
        .select('video_id, created_at')
        // ✅ 只查询已完成的标注数据（status = true）
        .eq('status', true)
        .not('annotator', 'is', null)
        .neq('annotator', '')
        .neq('annotator', 'unknown')
        .not('human_annotated_text', 'is', null)
        .neq('human_annotated_text', '')
        .order('created_at', { ascending: false });
      
      if (videoError) {
        console.error('查询视频ID失败:', videoError);
        message.error('加载失败');
        setLoading(false);
        return;
      }
      
      // 去重视频ID，保留最新的时间戳
      const videoIdMap = new Map<string, string>();
      videoIds?.forEach(item => {
        const existingTime = videoIdMap.get(item.video_id);
        if (!existingTime || (item.created_at && item.created_at > existingTime)) {
          videoIdMap.set(item.video_id, item.created_at || '');
        }
      });
      // 按时间降序排序
      const uniqueVideoIds = Array.from(videoIdMap.entries())
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([videoId]) => videoId);
      console.log('  - 有标注数据的视频总数:', uniqueVideoIds.length);
      
      // 2. 对每个视频统计待复检数据
      const videoStatsPromises = uniqueVideoIds.map(async (videoId) => {
        // 查询该视频的所有标注数据（按标注人分组）
        // 注意：需要查询 inspector 字段来判断是否已质检，还需要 sentence_no 用于去重
        const { data: annotations, error } = await supabase
          .from('annotations')
          .select('id, video_id, sentence_no, annotator, human_annotated_text, status, review_status, reviewer, inspector, updated_at, is_qualified, created_at')
          .eq('video_id', videoId)
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown');
        
        if (error || !annotations) return null;
        
        // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
        // 优先保留有质检状态的数据，如果都有质检状态则保留最新的
        const deduplicatedMap = new Map<string, any>();
        
        annotations.forEach(ann => {
          const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
          const existing = deduplicatedMap.get(key);
          
          if (!existing) {
            deduplicatedMap.set(key, ann);
          } else {
            // 优先保留有质检状态的数据
            const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && existing.is_qualified === true;
            const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
            
            if (currentHasInspection && !existingHasInspection) {
              // 当前数据有质检状态，旧数据没有，保留当前数据
              deduplicatedMap.set(key, ann);
            } else if (existingHasInspection && !currentHasInspection) {
              // 旧数据有质检状态，当前数据没有，保留旧数据
              // 不做任何操作
            } else {
              // 都有或都没有质检状态，保留最新的（按 updated_at）
              const existingTime = existing.updated_at || existing.created_at || '';
              const currentTime = ann.updated_at || ann.created_at || '';
              if (currentTime > existingTime) {
                deduplicatedMap.set(key, ann);
              }
            }
          }
        });
        
        const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
        
        // 调试日志：打印查询到的数据统计
        if (deduplicatedAnnotations && deduplicatedAnnotations.length > 0) {
          const originalCount = annotations.length;
          const deduplicatedCount = deduplicatedAnnotations.length;
          const withInspector = deduplicatedAnnotations.filter(a => a.inspector && a.inspector.trim() !== '').length;
          const withReviewStatus = deduplicatedAnnotations.filter(a => a.review_status === true).length;
          const withCompleted = deduplicatedAnnotations.filter(a => a.status === true).length;
          const qualified = deduplicatedAnnotations.filter(a => a.is_qualified === true).length;
          const withInspectorAndQualified = deduplicatedAnnotations.filter(a => 
            a.inspector && a.inspector.trim() !== '' && a.is_qualified === true
          ).length;
          console.log(`  📊 视频 ${videoId} 的数据统计:`, {
            原始数量: originalCount,
            去重后数量: deduplicatedCount,
            去除了: originalCount - deduplicatedCount,
            已完成标注: withCompleted,
            有质检人: withInspector,
            质检通过: qualified,
            有质检人且通过: withInspectorAndQualified,
            已复检: withReviewStatus
          });
        }
        
        // 🔧 第一步：先检查每个标注人是否有质检通过的数据（抽检逻辑）
        const annotatorQualifiedMap = new Map<string, boolean>();
        deduplicatedAnnotations.forEach(ann => {
          const isCompleted = ann.status === true;
          const isQualified = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
          
          if (isCompleted && isQualified) {
            annotatorQualifiedMap.set(ann.annotator, true);
          }
        });
        
        // 按标注人分组统计（使用去重后的数据）
        const annotatorMap = new Map<string, AnnotatorData>();
        
        deduplicatedAnnotations.forEach(ann => {
          const annotator = ann.annotator;
          const isCompleted = ann.status === true;
          
          if (!annotatorMap.has(annotator)) {
            annotatorMap.set(annotator, {
              annotatorName: annotator,
              totalAnnotations: 0,
              reviewedCount: 0,
              pendingCount: 0,
              unannotatedCount: 0,
              reviewers: [],
              inspectors: [],
              lastReviewTime: undefined,
              submittedAt: undefined // 初始化提交时间
            });
          }
          
          const annotatorData = annotatorMap.get(annotator)!;
          annotatorData.totalAnnotations++;
          
          // 🆕 记录最早的提交时间（created_at）
          if (ann.created_at) {
            if (!annotatorData.submittedAt || ann.created_at < annotatorData.submittedAt) {
              annotatorData.submittedAt = ann.created_at;
            }
          }
          
          // 🔧 抽检逻辑：只要该标注人有任意一条数据被质检通过，则所有有标注的数据都可以进入复检
          const annotatorHasQualified = annotatorQualifiedMap.get(annotator) === true;
          
          if (isCompleted) {
            // 已复检完成的数据
            if (ann.review_status === true) {
              annotatorData.reviewedCount++;
              if (ann.reviewer && !annotatorData.reviewers.includes(ann.reviewer)) {
                annotatorData.reviewers.push(ann.reviewer);
              }
              if (ann.updated_at) {
                if (!annotatorData.lastReviewTime || ann.updated_at > annotatorData.lastReviewTime) {
                  annotatorData.lastReviewTime = ann.updated_at;
                }
              }
            } 
            // 🔧 新逻辑：待复检的数据
            // 只要该标注人有质检通过的数据（抽检通过），则所有已完成标注且未复检的数据都计入待复检
            else if (annotatorHasQualified) {
              annotatorData.pendingCount++;
            }
            // 如果该标注人没有任何质检通过的数据，则不计入待复检
          } else {
            annotatorData.unannotatedCount++;
          }
          
          if (ann.inspector && !annotatorData.inspectors.includes(ann.inspector)) {
            annotatorData.inspectors.push(ann.inspector);
          }
        });
        
        // 调试日志：打印每个标注人的统计信息
        if (videoId && annotatorMap.size > 0) {
          console.log(`📊 视频 ${videoId} 的标注人统计:`, 
            Array.from(annotatorMap.entries()).map(([name, data]) => ({
              annotator: name,
              total: data.totalAnnotations,
              pending: data.pendingCount,
              reviewed: data.reviewedCount,
              hasInspector: data.inspectors.length > 0,
              inspectors: data.inspectors
            }))
          );
        }
        
        // 🔧 新逻辑：只要视频有质检通过的内容，就将该视频加载到待复检
        // 检查该视频是否有质检通过的数据
        const hasQualifiedData = deduplicatedAnnotations.some(ann => {
          const isCompleted = ann.status === true;
          const isQualified = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
          return isCompleted && isQualified;
        });
        
        if (!hasQualifiedData) {
          // 如果没有质检通过的数据，不显示该视频
          return null;
        }
        
        // 过滤出有待复检数据的标注人（至少有一条已标注的数据）
        const pendingAnnotators = Array.from(annotatorMap.values()).filter(a => 
          a.pendingCount > 0 && (a.pendingCount + a.reviewedCount) > 0
        );
        
        // 🔧 修复：只显示真正有待复检数据的视频
        // 如果没有待复检数据，不显示该视频（即使有质检通过数据）
        return pendingAnnotators.length > 0 ? { videoId, annotators: pendingAnnotators } : null;
      });
      
      const videoStatsResults = await Promise.all(videoStatsPromises);
      const videosWithPending = videoStatsResults.filter(v => v !== null) as { videoId: string; annotators: AnnotatorData[] }[];
      
      console.log('  - 有标注数据的视频数量:', videosWithPending.length);
      
      // 调试日志：打印有待复检数据的视频
      if (videosWithPending.length > 0) {
        console.log('📋 有待复检数据的视频列表:');
        videosWithPending.forEach(v => {
          console.log(`  - 视频ID: ${v.videoId}, 标注人数: ${v.annotators.length}`);
          v.annotators.forEach(a => {
            console.log(`    - 标注人: ${a.annotatorName}, 待复检: ${a.pendingCount}, 已复检: ${a.reviewedCount}, 质检人: ${a.inspectors.join(', ')}`);
          });
        });
      } else {
        console.log('⚠️ 没有找到任何有待复检数据的视频');
      }
      
      // 3. 获取所有视频详细信息（包括标注文件名）
      const { data: allVideos, error: videosError } = await supabase
        .from('videos')
        .select('id, name, subject, created_at, annotation_file_name')
        .in('id', videosWithPending.map(v => v.videoId));
      
      if (videosError) {
        console.error('⚠️ 获取视频信息失败:', videosError);
      }
      
      if (!allVideos || allVideos.length === 0) {
        console.warn('⚠️ 未找到任何视频信息');
        setAllPendingVideos([]);
        setPendingPage(1);
        setLoading(false);
        return;
      }
      
      // 4. 过滤掉已完成复检的视频（is_completed = true）
      // 创建视频映射以提高查找效率
      const videoMap = new Map(allVideos.map(v => [v.id, v]));
      
      const result: VideoWithAnnotators[] = videosWithPending
        .filter(item => {
          // 排除已完成复检的视频
          const video = videoMap.get(item.videoId);
          if (video?.is_completed === true) {
            console.log(`⏭️ 跳过已完成复检的视频: ${video?.name || item.videoId}`);
            return false;
          }
          return true;
        })
        .map(item => {
          const video = videoMap.get(item.videoId);
          return {
            videoId: item.videoId,
            videoName: video?.name || item.videoId,
            subject: video?.subject || '未知',
            annotators: item.annotators,
            annotationFileName: video?.annotation_file_name // 🆕 添加标注文件名
          };
        })
        .sort((a, b) => {
          // 🆕 按标注人的最早提交时间降序排序（最新的在最上面）
          // 取每个视频中所有标注人的最早提交时间
          const getEarliestSubmitTime = (video: VideoWithAnnotators) => {
            const times = video.annotators
              .map(ann => ann.submittedAt)
              .filter(t => t !== undefined) as string[];
            return times.length > 0 ? Math.min(...times.map(t => new Date(t).getTime())) : 0;
          };
          
          const timeA = getEarliestSubmitTime(a);
          const timeB = getEarliestSubmitTime(b);
          
          return timeB - timeA; // 降序排序，最新的在最上面
        });
      
      setAllPendingVideos(result);
      setPendingPage(1); // 重置到第一页
      
      console.log('✅ 所有待复检视频加载完成:', result.length);
    } catch (error) {
      console.error('加载待复检视频失败:', error);
      message.error('加载待复检视频失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载已复检视频（一次性加载所有数据）
  const loadAllCompletedVideos = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('📊 加载所有已复检视频（is_completed = true 的视频）...');
      
      // 1. 查询所有标记为已完成的视频（包括标注文件名）
      const { data: completedVideos, error: videoError } = await supabase
        .from('videos')
        .select('id, name, subject, review_completed_at, annotation_file_name')
        .eq('is_completed', true)
        .order('review_completed_at', { ascending: false });
      
      if (videoError) {
        console.error('查询已完成视频失败:', videoError);
        message.error('加载失败');
        setLoading(false);
        return;
      }
      
      if (!completedVideos || completedVideos.length === 0) {
        console.log('  - 没有已完成复检的视频');
        setAllCompletedVideos([]);
        setCompletedPage(1);
        setLoading(false);
        return;
      }
      
      console.log('  - 已完成复检的视频数量:', completedVideos.length);
      console.log('  ℹ️  这些视频已点击过"完成复检"按钮');
      
      // 2. 对每个已完成的视频，统计标注人的复检情况
      const videoStatsPromises = completedVideos.map(async (video) => {
        // 查询该视频的所有标注数据（按标注人分组）
        // 🔧 重要：必须包含 sentence_no 字段，用于去重逻辑
        const { data: annotations, error } = await supabase
          .from('annotations')
          .select('video_id, sentence_no, annotator, human_annotated_text, review_status, reviewer, inspector, updated_at, is_qualified, created_at')
          .eq('video_id', video.id)
          .not('annotator', 'is', null)
          .neq('annotator', '')
          .neq('annotator', 'unknown');
        
        if (error || !annotations) return null;
        
        // 🔧 去重逻辑：对于相同 video_id + sentence_no + annotator 的数据
        // 优先保留有质检状态的数据，如果都有质检状态则保留最新的
        const deduplicatedMap = new Map<string, any>();
        
        annotations.forEach(ann => {
          const key = `${ann.video_id}_${ann.sentence_no}_${ann.annotator}`;
          const existing = deduplicatedMap.get(key);
          
          if (!existing) {
            deduplicatedMap.set(key, ann);
          } else {
            // 优先保留有质检状态的数据
            const existingHasInspection = existing.inspector && existing.inspector.trim() !== '' && existing.is_qualified === true;
            const currentHasInspection = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
            
            if (currentHasInspection && !existingHasInspection) {
              // 当前数据有质检状态，旧数据没有，保留当前数据
              deduplicatedMap.set(key, ann);
            } else if (existingHasInspection && !currentHasInspection) {
              // 旧数据有质检状态，当前数据没有，保留旧数据
              // 不做任何操作
            } else {
              // 都有或都没有质检状态，保留最新的（按 updated_at）
              const existingTime = existing.updated_at || existing.created_at || '';
              const currentTime = ann.updated_at || ann.created_at || '';
              if (currentTime > existingTime) {
                deduplicatedMap.set(key, ann);
              }
            }
          }
        });
        
        const deduplicatedAnnotations = Array.from(deduplicatedMap.values());
        
        // 调试日志：打印去重统计
        if (deduplicatedAnnotations && deduplicatedAnnotations.length > 0) {
          const originalCount = annotations.length;
          const deduplicatedCount = deduplicatedAnnotations.length;
          console.log(`  🔧 去重统计: 原始 ${originalCount} 条，去重后 ${deduplicatedCount} 条，去除了 ${originalCount - deduplicatedCount} 条重复数据`);
        }
        
        // 🔧 第一步：先检查每个标注人是否有质检通过的数据（抽检逻辑）
        const annotatorQualifiedMap = new Map<string, boolean>();
        deduplicatedAnnotations.forEach(ann => {
          const isCompleted = ann.status === true;
          const isQualified = ann.inspector && ann.inspector.trim() !== '' && ann.is_qualified === true;
          
          if (isCompleted && isQualified) {
            annotatorQualifiedMap.set(ann.annotator, true);
          }
        });
        
        // 按标注人分组统计（使用去重后的数据）
        const annotatorMap = new Map<string, AnnotatorData>();
        
        deduplicatedAnnotations.forEach(ann => {
          const annotator = ann.annotator;
          const isCompleted = ann.status === true;
          
          if (!annotatorMap.has(annotator)) {
            annotatorMap.set(annotator, {
              annotatorName: annotator,
              totalAnnotations: 0,
              reviewedCount: 0,
              pendingCount: 0,
              unannotatedCount: 0,
              reviewers: [],
              inspectors: [],
              lastReviewTime: undefined,
              submittedAt: undefined // 初始化提交时间
            });
          }

          const annotatorData = annotatorMap.get(annotator)!;
          annotatorData.totalAnnotations++;
        
          // 🆕 记录最早的提交时间（created_at）
          if (ann.created_at) {
            if (!annotatorData.submittedAt || ann.created_at < annotatorData.submittedAt) {
              annotatorData.submittedAt = ann.created_at;
            }
          }
        
          // 🔧 抽检逻辑：只要该标注人有任意一条数据被质检通过，则所有有标注的数据都可以进入复检
          const annotatorHasQualified = annotatorQualifiedMap.get(annotator) === true;
        
          if (isCompleted) {
            // 已复检完成的数据
            if (ann.review_status === true) {
              annotatorData.reviewedCount++;
              if (ann.reviewer && !annotatorData.reviewers.includes(ann.reviewer)) {
                annotatorData.reviewers.push(ann.reviewer);
              }
              if (ann.updated_at) {
                if (!annotatorData.lastReviewTime || ann.updated_at > annotatorData.lastReviewTime) {
                  annotatorData.lastReviewTime = ann.updated_at;
                }
              }
            } 
            // 🔧 新逻辑：待复检的数据
            // 只要该标注人有质检通过的数据（抽检通过），则所有已完成标注且未复检的数据都计入待复检
            else if (annotatorHasQualified) {
              annotatorData.pendingCount++;
            }
            // 如果该标注人没有任何质检通过的数据，则不计入待复检
          } else {
            annotatorData.unannotatedCount++;
          }
        
          if (ann.inspector && !annotatorData.inspectors.includes(ann.inspector)) {
            annotatorData.inspectors.push(ann.inspector);
          }
        });
        
        // 显示所有标注人的信息（不管是否完成复检）
        const allAnnotators = Array.from(annotatorMap.values());
        
        return { 
          videoId: video.id,
          videoName: video.name,
          subject: video.subject || '未知',
          annotators: allAnnotators,
          reviewCompletedAt: video.review_completed_at,
          annotationFileName: video.annotation_file_name // 🆕 添加标注文件名
        };
      });
      
      const videoStatsResults = await Promise.all(videoStatsPromises);
      const result = (videoStatsResults.filter(v => v !== null) as VideoWithAnnotators[])
        .sort((a, b) => {
          // 🆕 按标注人的最早提交时间降序排序（最新的在最上面）
          const getEarliestSubmitTime = (video: VideoWithAnnotators) => {
            const times = video.annotators
              .map(ann => ann.submittedAt)
              .filter(t => t !== undefined) as string[];
            return times.length > 0 ? Math.min(...times.map(t => new Date(t).getTime())) : 0;
          };
          
          const timeA = getEarliestSubmitTime(a);
          const timeB = getEarliestSubmitTime(b);
          
          return timeB - timeA; // 降序排序，最新的在最上面
        });
      
      console.log('  - 前5个视频的提交时间:', 
        result.slice(0, 5).map(v => ({
          videoName: v.videoName,
          earliestSubmitTime: Math.min(...v.annotators.map(a => a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity))
        }))
      );
      
      setAllCompletedVideos(result);
      setCompletedPage(1); // 重置到第一页
      
      console.log('✅ 所有已复检视频加载完成:', result.length);
    } catch (error) {
      console.error('加载已复检视频失败:', error);
      message.error('加载已复检视频失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (videoId: string, videoName: string, annotatorName: string) => {
    navigate('/review', {
      state: {
        videoId,
        videoName,
        annotatorName
      }
    });
  };

  // 删除标注人的所有标注数据
  const handleDelete = async (videoId: string, videoName: string, annotatorName: string) => {
    try {
      const { supabase } = await import('../api/supabase');
      
      console.log('🗑️ 准备删除标注数据:', {
        videoId,
        videoName,
        annotatorName
      });

      // 删除该视频该标注人的所有标注数据
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('video_id', videoId)
        .eq('annotator', annotatorName);

      if (error) {
        console.error('❌ 删除失败:', error);
        message.error('删除失败');
        return;
      }

      message.success(`已删除 ${annotatorName} 在视频"${videoName}"中的所有标注数据`);
      
      // 重新加载所有数据
      loadAllPendingVideos();
      loadAllCompletedVideos();
    } catch (error) {
      console.error('❌ 删除异常:', error);
      message.error('删除失败');
    }
  };

  // 渲染视频列表（可复用组件 - 前端分页）
  const renderVideoList = (allVideos: VideoWithAnnotators[], isPending: boolean) => {
    const currentPage = isPending ? pendingPage : completedPage;
    const setCurrentPage = isPending ? setPendingPage : setCompletedPage;
    const pageSize = isPending ? pendingPageSize : completedPageSize;
    
    // 前端分页：根据当前页码切片数据
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const displayVideos = allVideos.slice(startIdx, endIdx);
    
    if (allVideos.length === 0 && !loading) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          暂无数据
        </div>
      );
    }

    const total = allVideos.length;
    const totalPages = Math.ceil(total / pageSize);
    
    const selectedVideoIds = isPending ? selectedPendingVideoIds : selectedCompletedVideoIds;
    const currentPageVideoIds = displayVideos.map(v => v.videoId);
    const allSelected = currentPageVideoIds.length > 0 && currentPageVideoIds.every(id => selectedVideoIds.has(id));
    const someSelected = currentPageVideoIds.some(id => selectedVideoIds.has(id)) && !allSelected;

    return (
      <>
        {/* 批量操作栏 */}
        <div style={{ 
          marginBottom: 16, 
          padding: '12px 16px', 
          background: '#f5f5f5', 
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => toggleSelectAll(isPending)}
            >
              全选当前页
            </Checkbox>
            <Text type="secondary">
              已选中 {selectedVideoIds.size} 个视频
            </Text>
          </Space>
          <Space>
            {selectedVideoIds.size > 0 && (
              <Button
                size="small"
                onClick={() => clearSelection(isPending)}
              >
                清空选择
              </Button>
            )}
          </Space>
        </div>
        
      <Collapse accordion>
        {displayVideos.map((video) => (
            <Panel
            header={
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Checkbox
                    checked={selectedVideoIds.has(video.videoId)}
                    onChange={() => toggleVideoSelection(video.videoId, isPending)}
                    onClick={(e) => e.stopPropagation()}
                  />
              <Space size="large">
                <Text strong style={{ minWidth: 250 }}>{video.videoName}</Text>
                <Tag color="blue">{video.subject}</Tag>
                {video.annotationFileName && (
                  <Tag color="cyan" icon={<VideoCameraOutlined />}>
                    {video.annotationFileName}
                  </Tag>
                )}
                <Tag color="purple">{video.annotators.length} 位标注员</Tag>
                <Tag color="green">
                  {video.annotators.reduce((sum, a) => sum + a.reviewedCount, 0)} 已复检
                </Tag>
                <Tag color="orange">
                  {video.annotators.reduce((sum, a) => sum + a.pendingCount, 0)} 待复检
                </Tag>
                {video.annotators.reduce((sum, a) => sum + a.unannotatedCount, 0) > 0 && (
                  <Tag color="red" icon={<ClockCircleOutlined />}>
                    {video.annotators.reduce((sum, a) => sum + a.unannotatedCount, 0)} 未标注
                  </Tag>
                )}
              </Space>
                </div>
            }
            key={video.videoId}
          >
            <Table
              columns={[
                {
                  title: '标注人',
                  dataIndex: 'annotatorName',
                  key: 'annotatorName',
                  width: 150,
                  render: (text: string) => (
                    <Space>
                      <UserOutlined />
                      <Text strong>{text}</Text>
                    </Space>
                  )
                },
                {
                  title: '标注文件名',
                  dataIndex: 'annotationFileName',
                  key: 'annotationFileName',
                  width: 200,
                  render: () => (
                    video.annotationFileName ? (
                      <Text>{video.annotationFileName}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    )
                  )
                },
                {
                  title: '提交时间',
                  dataIndex: 'submittedAt',
                  key: 'submittedAt',
                  width: 180,
                  align: 'center' as const,
                  render: (time: string | undefined) => (
                    time ? (
                      <Text>{new Date(time).toLocaleString('zh-CN')}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    )
                  )
                },
                {
                  title: '总标注数',
                  dataIndex: 'totalAnnotations',
                  key: 'totalAnnotations',
                  width: 120,
                  align: 'center' as const,
                  render: (count: number) => <Text>{count} 条</Text>
                },
                {
                  title: '已复检',
                  dataIndex: 'reviewedCount',
                  key: 'reviewedCount',
                  width: 120,
                  align: 'center' as const,
                  render: (count: number) => (
                    <Tag color={count > 0 ? 'success' : 'default'}>
                      {count} 条
                    </Tag>
                  )
                },
                {
                  title: '待复检',
                  dataIndex: 'pendingCount',
                  key: 'pendingCount',
                  width: 120,
                  align: 'center' as const,
                  render: (count: number) => (
                    <Tag color={count > 0 ? 'orange' : 'default'}>
                      {count} 条
                    </Tag>
                  )
                },
                {
                  title: '未标注',
                  dataIndex: 'unannotatedCount',
                  key: 'unannotatedCount',
                  width: 120,
                  align: 'center' as const,
                  render: (count: number) => (
                    count > 0 ? (
                      <Tag color="red" icon={<ClockCircleOutlined />}>
                        {count} 条
                      </Tag>
                    ) : (
                      <Tag color="default">0 条</Tag>
                    )
                  )
                },
                {
                  title: '质检人',
                  dataIndex: 'inspectors',
                  key: 'inspectors',
                  width: 200,
                  render: (inspectors: string[]) => (
                    <Space wrap>
                      {inspectors.length > 0 ? (
                        inspectors.map(inspector => (
                          <Tag key={inspector} color="blue" icon={<UserOutlined />}>
                            {inspector}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">-</Text>
                      )}
                    </Space>
                  )
                },
                {
                  title: '复检人',
                  dataIndex: 'reviewers',
                  key: 'reviewers',
                  width: 200,
                  render: (reviewers: string[]) => (
                    <Space wrap>
                      {reviewers.length > 0 ? (
                        reviewers.map(reviewer => (
                          <Tag key={reviewer} color="cyan" icon={<CheckCircleOutlined />}>
                            {reviewer}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">-</Text>
                      )}
                    </Space>
                  )
                },
                {
                  title: '最后复检时间',
                  dataIndex: 'lastReviewTime',
                  key: 'lastReviewTime',
                  width: 180,
                  align: 'center' as const,
                  render: (time: string | undefined) => (
                    time ? (
                      <Text>{new Date(time).toLocaleString('zh-CN')}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    )
                  )
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 200,
                  align: 'center' as const,
                  render: (_: any, record: AnnotatorData) => (
                    <Space>
                      <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() => handleReview(video.videoId, video.videoName, record.annotatorName)}
                      >
                        开始复检
                      </Button>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除标注人"${record.annotatorName}"的所有标注数据吗？此操作不可恢复！`}
                        onConfirm={() => handleDelete(video.videoId, video.videoName, record.annotatorName)}
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
              dataSource={video.annotators}
              rowKey="annotatorName"
              pagination={false}
              size="small"
            />
          </Panel>
        ))}
      </Collapse>
        
        {/* 分页控件 - 仅更新页码，不重新加载数据 */}
        {total > pageSize && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Space direction="vertical" align="center">
              <Space>
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  上一页
                </Button>
                <Text>
                  第 {currentPage} / {totalPages} 页
                  （共 {total} 个视频）
                </Text>
                <Button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  下一页
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center'
      }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0, color: 'white' }}>
            产品复检 - 选择视频和标注人
          </Title>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card variant="borderless" loading={loading}>
          <Tabs
            defaultActiveKey="pending"
            size="large"
            items={[
              {
                key: 'pending',
                label: (
                  <Space>
                    <ClockCircleOutlined />
                    <span>待复检</span>
                    <Tag color="orange">{allPendingVideos.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(allPendingVideos, true)
              },
              {
                key: 'completed',
                label: (
                  <Space>
                    <CheckCircleOutlined />
                    <span>已复检</span>
                    <Tag color="success">{allCompletedVideos.length} 个视频</Tag>
                  </Space>
                ),
                children: renderVideoList(allCompletedVideos, false)
              }
            ]}
          />
        </Card>
      </Content>
    </Layout>
  );
}

