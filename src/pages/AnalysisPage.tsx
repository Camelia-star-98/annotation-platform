import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Typography,
  Table,
  message,
  Divider,
  Tag
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, BarChartOutlined, PieChartOutlined, TableOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { AnnotationItem } from '../types';
import type { TableProps } from 'antd';
import './AnalysisPage.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface MajorCategoryStats {
  majorCategory: string;
  count: number;
}

interface MinorCategoryStats {
  minorCategory: string;
  majorCategory: string;
  count: number;
}

interface SubjectDetailStats {
  majorCategory: string;
  minorCategory: string;
  [subject: string]: string | number; // 动态的科目列数据
}

interface VideoDetailStats {
  majorCategory: string;
  minorCategory: string;
  [videoName: string]: string | number; // 动态的视频列数据
}

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const selectedVideoIds = location.state?.selectedVideos || [];
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 统计数据
  const [majorCategoryStats, setMajorCategoryStats] = useState<MajorCategoryStats[]>([]);
  const [minorCategoryStats, setMinorCategoryStats] = useState<MinorCategoryStats[]>([]);
  const [subjectDetailStats, setSubjectDetailStats] = useState<SubjectDetailStats[]>([]);
  const [videoDetailStats, setVideoDetailStats] = useState<VideoDetailStats[]>([]); // 按视频统计
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableVideos, setAvailableVideos] = useState<string[]>([]); // 可用视频列表
  const [rawData, setRawData] = useState<AnnotationItem[]>([]); // 添加原始数据状态
  
  // 详细数据表格的筛选状态
  const [detailTableFilters, setDetailTableFilters] = useState<Record<string, any>>({});
  const detailTableRef = useRef<HTMLDivElement>(null);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [selectedVideoIds]);

  const loadData = async () => {
    if (selectedVideoIds.length === 0) {
      message.warning('请先选择视频');
      return;
    }

    setLoading(true);
    try {
      const { getVideos, getReviewedAnnotations } = await import('../api/database');
      
      // 加载视频信息
      const allVideos = await getVideos();
      const selectedVids = allVideos.filter(v => selectedVideoIds.includes(v.id));
      setVideos(selectedVids);
      
      console.log('📹 选中的视频:', selectedVids);
      
      // 创建视频ID到科目和名称的映射
      const videoInfoMap = new Map<string, { subject: string; name: string }>();
      selectedVids.forEach(v => {
        videoInfoMap.set(v.id, {
          subject: v.subject || '未知',
          name: v.name || '未知视频'
        });
      });
      
      // 加载已复检的标注数据（直接在数据库层面过滤，避免1000条限制）
      const reviewedAnnotations = await getReviewedAnnotations(selectedVideoIds);
      console.log('📊 getReviewedAnnotations 返回的总数据量:', reviewedAnnotations.length);
      console.log('📊 selectedVideoIds:', selectedVideoIds);
      console.log('📊 前5条数据:', reviewedAnnotations.slice(0, 5).map(a => ({
        videoId: a.videoId,
        annotator: a.annotator,
        reviewStatus: a.reviewStatus
      })));
      
      const filteredData = reviewedAnnotations.map(item => {
        const videoInfo = videoInfoMap.get(item.videoId);
        return {
          ...item,
          subject: videoInfo?.subject || '未知',
          videoName: videoInfo?.name || '未知视频'
        };
      });
      
      console.log('📊 已复检数据数量:', filteredData.length);
      console.log('📊 前3条数据样例:', filteredData.slice(0, 3).map(item => ({
        videoId: item.videoId,
        videoName: item.videoName,
        annotator: item.annotator,
        reviewStatus: item.reviewStatus,
        reviewer: item.reviewer
      })));
      
      // 按视频分组统计数据
      const videoDataCount = new Map<string, number>();
      filteredData.forEach(item => {
        const videoName = item.videoName || item.videoId;
        videoDataCount.set(videoName, (videoDataCount.get(videoName) || 0) + 1);
      });
      
      console.log('📹 各视频数据分布:');
      videoDataCount.forEach((count, videoName) => {
        console.log(`  - ${videoName}: ${count} 条`);
      });
      
      console.log('📹 选中的视频名称列表:');
      selectedVids.forEach(v => {
        console.log(`  - v.id: ${v.id}, v.name: ${v.name}`);
      });
      
      // 检查哪些视频没有已复检数据
      const videosWithoutData = selectedVids.filter(v => !videoDataCount.has(v.name));
      if (videosWithoutData.length > 0) {
        console.warn('⚠️ 以下视频暂无已复检数据:', videosWithoutData.map(v => v.name));
      }
      
      if (filteredData.length === 0) {
        message.warning('所选视频暂无已复检完成的数据');
        setLoading(false);
        return;
      }
      
      // 保存原始数据（包含科目信息），按创建时间降序排序（最新的在最上面）
      // getReviewedAnnotations 已经按 created_at 降序排序，这里保持顺序即可
      setRawData(filteredData);
      
      // 统计数据
      calculateStatistics(filteredData);
      
      message.success(`加载了 ${filteredData.length} 条已复检数据`);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data: AnnotationItem[]) => {
    console.log('📊 开始统计，数据总量:', data.length);
    
    // 1. 统计全学科问题大类
    const majorMap = new Map<string, number>();
    data.forEach(item => {
      const majors = item.majorCategory.split(',').map(m => m.trim()).filter(m => m);
      majors.forEach(major => {
        majorMap.set(major, (majorMap.get(major) || 0) + 1);
      });
    });
    
    const majorStats: MajorCategoryStats[] = Array.from(majorMap.entries()).map(([majorCategory, count]) => ({
      majorCategory,
      count
    })).sort((a, b) => b.count - a.count);
    
    setMajorCategoryStats(majorStats);
    
    console.log('📊 大类统计结果:', majorStats);
    
      // 2. 统计全学科问题小类（包含所属大类）
    const minorMap = new Map<string, { majorCategory: string; count: number }>();
    data.forEach(item => {
      const majors = (item.majorCategory || '').split(',').map(m => m.trim()).filter(m => m);
      const minors = (item.minorCategory || '').split(',').map(m => m.trim()).filter(m => m);
      
      // 调试：打印"第四轮语文-4"的识别问题
      if (item.videoName && item.videoName.includes('第四轮语文-4')) {
        const hasAsrMajor = item.majorCategory && (item.majorCategory.includes('asr') || item.majorCategory.includes('识别'));
        const hasAsrMinor = item.minorCategory && item.minorCategory.includes('识别');
        if (hasAsrMajor || hasAsrMinor) {
          console.log('🔍 [第四轮语文-4] ASR识别问题数据:', {
            videoName: item.videoName,
            majorCategory: item.majorCategory,
            minorCategory: item.minorCategory,
            majors,
            minors
          });
        }
      }
      
      // 调试：打印大类和小类数量不匹配的情况
      if (majors.length > 0 && minors.length === 0) {
        console.log('⚠️ 发现只有大类没有小类的数据:', {
          majorCategory: item.majorCategory,
          minorCategory: item.minorCategory,
          videoName: item.videoName
        });
      }
      
      // 假设大类和小类按顺序对应
      minors.forEach((minor, index) => {
        const major = majors[index] || majors[0] || '未知';
        const key = `${major}|${minor}`;
        
        if (!minorMap.has(key)) {
          minorMap.set(key, { majorCategory: major, count: 0 });
        }
        minorMap.set(key, {
          majorCategory: major,
          count: minorMap.get(key)!.count + 1
        });
      });
    });
    
    const minorStats: MinorCategoryStats[] = Array.from(minorMap.entries()).map(([key, value]) => ({
      minorCategory: key.split('|')[1],
      majorCategory: value.majorCategory,
      count: value.count
    })).sort((a, b) => b.count - a.count);
    
    setMinorCategoryStats(minorStats);
    
    console.log('📊 小类统计结果:', minorStats);
    
    setMinorCategoryStats(minorStats);
    
    console.log('📊 小类统计结果:', minorStats);
    
    // 检查"大模型误删除"的小类数据
    const llmDeleteStats = minorStats.filter(s => s.majorCategory === '大模型误删除');
    console.log('📊 大模型误删除的小类数据:', llmDeleteStats);
    
    // 3. 统计每个科目的问题明细
    const subjects = Array.from(new Set(data.map(item => item.subject).filter(s => s && s !== '未知')));
    setAvailableSubjects(subjects);
    
    // 创建问题类别结构
    const categoryStructure = new Map<string, Set<string>>(); // major -> Set of minors
    data.forEach(item => {
      const majors = item.majorCategory.split(',').map(m => m.trim()).filter(m => m);
      const minors = item.minorCategory.split(',').map(m => m.trim()).filter(m => m);
      
      minors.forEach((minor, index) => {
        const major = majors[index] || majors[0] || '未知';
        if (!categoryStructure.has(major)) {
          categoryStructure.set(major, new Set());
        }
        categoryStructure.get(major)!.add(minor);
      });
    });
    
    console.log('📊 问题类别结构:');
    categoryStructure.forEach((minors, major) => {
      console.log(`  - ${major}: [${Array.from(minors).join(', ')}]`);
    });
    
    // 统计每个科目的每个小类问题数量
    const detailStatsMap = new Map<string, SubjectDetailStats>();
    
    categoryStructure.forEach((minors, major) => {
      minors.forEach(minor => {
        const key = `${major}|${minor}`;
        
        if (!detailStatsMap.has(key)) {
          const row: SubjectDetailStats = {
            majorCategory: major,
            minorCategory: minor
          };
          
          subjects.forEach(subject => {
            row[subject] = 0;
          });
          
          detailStatsMap.set(key, row);
        }
        
        // 统计每个科目的问题数
        data.forEach(item => {
          if (!item.subject || item.subject === '未知') return;
          
          const itemMajors = item.majorCategory.split(',').map(m => m.trim());
          const itemMinors = item.minorCategory.split(',').map(m => m.trim());
          
          itemMinors.forEach((itemMinor, index) => {
            const itemMajor = itemMajors[index] || itemMajors[0];
            if (itemMajor === major && itemMinor === minor) {
              const row = detailStatsMap.get(key)!;
              row[item.subject] = (row[item.subject] as number) + 1;
            }
          });
        });
      });
    });
    
    const detailStats = Array.from(detailStatsMap.values());
    
    console.log('📊 单科明细统计结果:', detailStats);
    console.log('📊 大模型误删除的明细:', detailStats.filter(s => s.majorCategory === '大模型误删除'));
    
    // 添加"无问题"行统计
    const noProblemRow: SubjectDetailStats = {
      majorCategory: '无问题',
      minorCategory: '无问题'
    };
    
    // 统计每个科目的无问题数据条数
    subjects.forEach(subject => {
      const noProblemCountForSubject = data.filter(item => 
        item.subject === subject && 
        (!item.majorCategory || item.majorCategory.trim() === '')
      ).length;
      noProblemRow[subject] = noProblemCountForSubject;
    });
    
    // 将"无问题"行添加到统计数据的开头（或末尾）
    detailStats.push(noProblemRow);
    
    setSubjectDetailStats(detailStats);
    
    // 4. 统计每个视频的问题明细
    const videoNames = Array.from(new Set(data.map(item => item.videoName).filter(v => v && v !== '未知视频')));
    setAvailableVideos(videoNames);
    
    console.log('📹 可用视频列表（共' + videoNames.length + '个）:', videoNames);
    
    // 额外调试：查找所有包含"语文"的视频
    const chineseVideos = data.filter(item => item.videoName && item.videoName.includes('语文'));
    const chineseVideoNames = Array.from(new Set(chineseVideos.map(v => v.videoName)));
    console.log('🔍 [调试] 所有包含"语文"的视频名称:', chineseVideoNames);
    
    // 查找"第四轮语文-4"的所有数据
    const video4Data = data.filter(item => item.videoName && item.videoName.includes('第四轮语文-4'));
    console.log(`🔍 [第四轮语文-4] 总数据量: ${video4Data.length}`);
    if (video4Data.length > 0) {
      console.log('🔍 [第四轮语文-4] 前5条数据样例:', video4Data.slice(0, 5).map(item => ({
        majorCategory: item.majorCategory,
        minorCategory: item.minorCategory
      })));
      
      // 统计第四轮语文-4的问题分类
      const video4CategoryMap = new Map<string, number>();
      video4Data.forEach(item => {
        const majors = (item.majorCategory || '').split(',').map(m => m.trim()).filter(m => m);
        const minors = (item.minorCategory || '').split(',').map(m => m.trim()).filter(m => m);
        minors.forEach((minor, index) => {
          const major = majors[index] || majors[0] || '未知';
          const key = `${major}|${minor}`;
          video4CategoryMap.set(key, (video4CategoryMap.get(key) || 0) + 1);
        });
      });
      console.log('🔍 [第四轮语文-4] 问题分类统计:');
      video4CategoryMap.forEach((count, key) => {
        const [major, minor] = key.split('|');
        console.log(`  - 大类: ${major}, 小类: ${minor}, 数量: ${count}`);
      });
    }
    
    // 查找所有ASR相关问题的视频
    const asrData = data.filter(item => 
      (item.majorCategory && item.majorCategory.toLowerCase().includes('asr')) ||
      (item.minorCategory && item.minorCategory.toLowerCase().includes('asr'))
    );
    const asrVideoNames = Array.from(new Set(asrData.map(v => v.videoName)));
    console.log('🔍 [调试] 包含ASR问题的视频名称:', asrVideoNames);
    
    // 统计每个视频的每个小类问题数量
    const videoDetailStatsMap = new Map<string, VideoDetailStats>();
    
    categoryStructure.forEach((minors, major) => {
      minors.forEach(minor => {
        const key = `${major}|${minor}`;
        
        if (!videoDetailStatsMap.has(key)) {
          const row: VideoDetailStats = {
            majorCategory: major,
            minorCategory: minor
          };
          
          videoNames.forEach(videoName => {
            row[videoName] = 0;
          });
          
          videoDetailStatsMap.set(key, row);
        }
        
        // 统计每个视频的问题数
        data.forEach(item => {
          if (!item.videoName || item.videoName === '未知视频') return;
          
          const itemMajors = item.majorCategory.split(',').map(m => m.trim());
          const itemMinors = item.minorCategory.split(',').map(m => m.trim());
          
          itemMinors.forEach((itemMinor, index) => {
            const itemMajor = itemMajors[index] || itemMajors[0];
            if (itemMajor === major && itemMinor === minor) {
              const row = videoDetailStatsMap.get(key)!;
              row[item.videoName] = (row[item.videoName] as number) + 1;
              
              // 调试日志：针对ASR类问题和特定视频
              if (itemMajor === 'asr' || itemMinor.includes('asr') || item.videoName.includes('第四轮语文-4')) {
                console.log(`🔍 [视频统计] 视频: ${item.videoName}, 大类: ${itemMajor}, 小类: ${itemMinor}, 当前计数: ${row[item.videoName]}`);
              }
            }
          });
        });
      });
    });
    
    const videoDetailStatsArray = Array.from(videoDetailStatsMap.values());
    
    // 添加"无问题"行统计（按视频）
    const noProblemRowForVideo: VideoDetailStats = {
      majorCategory: '无问题',
      minorCategory: '无问题'
    };
    
    videoNames.forEach(videoName => {
      const noProblemCountForVideo = data.filter(item => 
        item.videoName === videoName && 
        (!item.majorCategory || item.majorCategory.trim() === '')
      ).length;
      noProblemRowForVideo[videoName] = noProblemCountForVideo;
    });
    
    videoDetailStatsArray.push(noProblemRowForVideo);
    
    setVideoDetailStats(videoDetailStatsArray);
    
    console.log('📹 按视频明细统计结果:', videoDetailStatsArray);
    
    console.log('📊 大类统计:', majorStats);
    console.log('📊 小类统计:', minorStats);
    console.log('📊 科目明细:', detailStats);
  };

  // 全学科大类问题饼状图配置
  const getMajorCategoryPieOption = () => {
    // 计算总数据条数
    const totalDataCount = rawData.length;
    
    // 计算无问题的数据条数（majorCategory 为空的数据）
    const noProblemCount = rawData.filter(item => !item.majorCategory || item.majorCategory.trim() === '').length;
    
    // 构建饼图数据（包括无问题类别）
    const pieData = [
      ...majorCategoryStats.map(item => ({
        name: item.majorCategory,
        value: item.count
      })),
      {
        name: '无问题',
        value: noProblemCount,
        itemStyle: {
          color: '#52c41a' // 绿色表示无问题
        }
      }
    ];
    
    return {
      title: {
        text: '全学科问题大类占比',
        subtext: `总计 ${totalDataCount} 条数据`,
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const percentage = ((params.value / totalDataCount) * 100).toFixed(2);
          return `${params.name}<br/>数量: ${params.value}条<br/>占比: ${percentage}%`;
        }
      },
      legend: {
        orient: 'vertical',
        right: 20,
        top: 'middle',
        data: pieData.map(item => item.name)
      },
      series: [
        {
          name: '问题大类',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '55%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: (params: any) => {
              const percentage = ((params.value / totalDataCount) * 100).toFixed(1);
              return `${params.name}\n${params.value}条 (${percentage}%)`;
            }
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          data: pieData
        }
      ]
    };
  };

  // 全学科小类问题柱状图配置
  const getMinorCategoryBarOption = () => {
    // 计算总数据条数
    const totalDataCount = rawData.length;
    
    // 计算无问题的数据条数
    const noProblemCount = rawData.filter(item => !item.majorCategory || item.majorCategory.trim() === '').length;
    
    // 构建柱状图数据（包括无问题类别）
    const barData = [
      ...minorCategoryStats.map(item => ({
        name: item.minorCategory,
        value: item.count,
        majorCategory: item.majorCategory
      })),
      {
        name: '无问题',
        value: noProblemCount,
        majorCategory: '无问题'
      }
    ];
    
    return {
      title: {
        text: '全学科问题小类占比',
        subtext: `总计 ${totalDataCount} 条数据`,
        left: 'center',
        top: 20,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const item = params[0];
          const stat = barData[item.dataIndex];
          const percentage = ((item.value / totalDataCount) * 100).toFixed(2);
          return `${stat.name}<br/>所属大类: ${stat.majorCategory}<br/>数量: ${item.value}条<br/>占比: ${percentage}%`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: barData.map(item => item.name),
        axisLabel: {
          interval: 0,
          rotate: 45,
          fontSize: 11
        }
      },
      yAxis: {
        type: 'value',
        name: '数据数量（条）',
        minInterval: 1
      },
      series: [
        {
          name: '数据数量',
          type: 'bar',
          data: barData.map(item => ({
            value: item.value,
            itemStyle: {
              color: item.name === '无问题' ? '#52c41a' : '#5470c6'
            }
          })),
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              const percentage = ((params.value / totalDataCount) * 100).toFixed(1);
              return `${params.value}条\n(${percentage}%)`;
            }
          }
        }
      ]
    };
  };

  // 单科问题占比表格列配置
  const getSubjectTableColumns = () => {
    const columns = [
      {
        title: '问题大类',
        dataIndex: 'majorCategory',
        key: 'majorCategory',
        width: 150,
        fixed: 'left' as const
      },
      {
        title: '问题小类',
        dataIndex: 'minorCategory',
        key: 'minorCategory',
        width: 200,
        fixed: 'left' as const
      }
    ];
    
    // 计算每个科目的总数
    const subjectTotals = availableSubjects.reduce((acc, subject) => {
      acc[subject] = subjectDetailStats.reduce((sum, row) => {
        const value = row[subject];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      return acc;
    }, {} as Record<string, number>);
    
    // 动态添加科目列（数量 + 占比）
    availableSubjects.forEach(subject => {
      const total = subjectTotals[subject];
      
      // 数量列
      columns.push({
        title: `${subject}`,
        children: [
          {
            title: '数量',
            dataIndex: subject,
            key: `${subject}_count`,
            width: 80,
            render: (value: number) => value > 0 ? <span style={{ fontWeight: 500 }}>{value}条</span> : <span style={{ color: '#ccc' }}>0</span>
          },
          {
            title: '占比',
            dataIndex: subject,
            key: `${subject}_percentage`,
            width: 80,
            render: (value: number) => {
              if (value === 0 || total === 0) {
                return <span style={{ color: '#ccc' }}>0%</span>;
              }
              const percentage = ((value / total) * 100).toFixed(1);
              return <span style={{ color: '#1890ff' }}>{percentage}%</span>;
            }
          }
        ]
      } as any);
    });
    
    return columns;
  };

  // 点击占比跳转到详细数据并筛选
  const handlePercentageClick = (videoName: string, majorCategory: string, minorCategory: string) => {
    // 设置筛选条件
    setDetailTableFilters({
      videoName: [videoName],
      majorCategory: [majorCategory],
      minorCategory: [minorCategory]
    });
    
    // 滚动到详细数据表格
    setTimeout(() => {
      detailTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    message.info(`已筛选：${videoName} - ${majorCategory} - ${minorCategory}`);
  };

  // 按视频分类统计表格列配置
  const getVideoTableColumns = () => {
    const columns = [
      {
        title: '问题大类',
        dataIndex: 'majorCategory',
        key: 'majorCategory',
        width: 150,
        fixed: 'left' as const
      },
      {
        title: '问题小类',
        dataIndex: 'minorCategory',
        key: 'minorCategory',
        width: 200,
        fixed: 'left' as const
      }
    ];
    
    // 计算每个视频的总数
    const videoTotals = availableVideos.reduce((acc, videoName) => {
      acc[videoName] = videoDetailStats.reduce((sum, row) => sum + ((row[videoName] as number) || 0), 0);
      return acc;
    }, {} as Record<string, number>);
    
    // 动态添加视频列（数量 + 占比）
    availableVideos.forEach(videoName => {
      const total = videoTotals[videoName];
      
      columns.push({
        title: `${videoName}`,
        children: [
          {
            title: '数量',
            dataIndex: videoName,
            key: `${videoName}_count`,
            width: 80,
            render: (value: number) => value > 0 ? <span style={{ fontWeight: 500 }}>{value}条</span> : <span style={{ color: '#ccc' }}>0</span>
          },
          {
            title: '占比',
            dataIndex: videoName,
            key: `${videoName}_percentage`,
            width: 80,
            render: (value: number, record: VideoDetailStats) => {
              if (value === 0 || total === 0) {
                return <span style={{ color: '#ccc' }}>0%</span>;
              }
              const percentage = ((value / total) * 100).toFixed(1);
              return (
                <span 
                  style={{ 
                    color: '#1890ff', 
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  onClick={() => handlePercentageClick(
                    videoName, 
                    record.majorCategory as string, 
                    record.minorCategory as string
                  )}
                  title="点击查看详细数据"
                >
                  {percentage}%
                </span>
              );
            }
          }
        ]
      } as any);
    });
    
    return columns;
  };

  // 导出CSV
  const handleExport = () => {
    // 构建CSV数据
    const csvData: any[] = [];
    
    // 添加表头
    const headers = ['问题大类', '问题小类', ...availableSubjects];
    csvData.push(headers);
    
    // 添加数据行
    subjectDetailStats.forEach(row => {
      const dataRow = [
        row.majorCategory,
        row.minorCategory,
        ...availableSubjects.map(subject => row[subject] || 0)
      ];
      csvData.push(dataRow);
    });
    
    // 转换为CSV字符串
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `问题统计分析_${new Date().toLocaleDateString()}.csv`;
    link.click();
    
    message.success('导出成功！');
  };

  return (
    <Layout className="analysis-layout">
      <Header className="analysis-header">
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
            数据分析
          </Title>
        </Space>
      </Header>

      <Content className="analysis-content">
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px' }}>
          {/* 数据来源 */}
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>数据来源</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            <Space wrap>
              <Text strong>已选择视频：</Text>
              {videos.map(video => (
                <Space key={video.id}>
                  <Text>{video.name}</Text>
                  {video.subject ? (
                    <Tag color="green">{video.subject}</Tag>
                  ) : (
                    <Tag color="red">未设置科目</Tag>
                  )}
                </Space>
              ))}
            </Space>
          </Card>

          {/* 1. 全学科问题大类占比（饼状图） */}
          <Card 
            title={
              <Space>
                <PieChartOutlined />
                <span>全学科问题大类占比</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            {majorCategoryStats.length > 0 ? (
              <ReactECharts 
                option={getMajorCategoryPieOption()} 
                style={{ height: '500px' }}
                notMerge={true}
                lazyUpdate={true}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 2. 全学科问题小类占比（柱状图） */}
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>全学科问题小类占比</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
            loading={loading}
          >
            {minorCategoryStats.length > 0 ? (
              <ReactECharts 
                option={getMinorCategoryBarOption()} 
                style={{ height: '500px' }}
                notMerge={true}
                lazyUpdate={true}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>

          {/* 3. 单科问题占比（表格） */}
          <Card 
            title={
              <Space>
                <TableOutlined />
                <span>单科问题明细统计</span>
              </Space>
            }
            extra={
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={subjectDetailStats.length === 0}
              >
                导出CSV
              </Button>
            }
            loading={loading}
          >
            <Table
              columns={getSubjectTableColumns()}
              dataSource={subjectDetailStats}
              rowKey={(record) => `${record.majorCategory}_${record.minorCategory}`}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 项`
              }}
              scroll={{ x: 'max-content' }}
              size="middle"
            />
          </Card>

          {/* 4. 按视频分类统计（新增） */}
          <Card 
            title={
              <Space>
                <TableOutlined />
                <span>按视频分类统计</span>
              </Space>
            }
            loading={loading}
            style={{ marginBottom: 24 }}
          >
            <Table
              columns={getVideoTableColumns()}
              dataSource={videoDetailStats}
              rowKey={(record) => `${record.majorCategory}_${record.minorCategory}`}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 项`
              }}
              scroll={{ x: 'max-content' }}
              size="middle"
            />
          </Card>

          {/* 5. 原始数据明细 */}
          <div ref={detailTableRef}>
            <Card 
              title={
                <Space>
                  <TableOutlined />
                  <span>原始数据明细</span>
                  <Tag color="blue">{rawData.length} 条</Tag>
                  {(detailTableFilters.videoName || detailTableFilters.majorCategory || detailTableFilters.minorCategory) && (
                    <Button 
                      size="small" 
                      onClick={() => setDetailTableFilters({})}
                    >
                      清除筛选
                    </Button>
                  )}
                </Space>
              }
              loading={loading}
            >
              <Table
                columns={[
                  {
                    title: '句子编号',
                    dataIndex: 'sentenceNo',
                    key: 'sentenceNo',
                    width: 100,
                    sorter: (a, b) => (a.sentenceNo || 0) - (b.sentenceNo || 0)
                  },
                  {
                    title: '科目',
                    dataIndex: 'subject',
                    key: 'subject',
                    width: 100,
                    render: (subject: string) => (
                      <Tag color={subject === '未知' ? 'red' : 'green'}>
                        {subject}
                      </Tag>
                    ),
                    filters: availableSubjects.map(s => ({ text: s, value: s })),
                    onFilter: (value, record) => record.subject === value
                  },
                  {
                    title: '视频名称',
                    dataIndex: 'videoName',
                    key: 'videoName',
                    width: 200,
                    ellipsis: true,
                    filters: availableVideos.map(v => ({ text: v, value: v })),
                    filteredValue: detailTableFilters.videoName || null,
                    onFilter: (value, record) => record.videoName === value
                  },
                  {
                    title: '时间范围',
                    dataIndex: 'timeRange',
                    key: 'timeRange',
                    width: 120
                  },
                  {
                    title: '原文文本',
                    dataIndex: 'originalText',
                    key: 'originalText',
                    width: 250,
                    ellipsis: true
                  },
                  {
                    title: '大模型改写文本',
                    dataIndex: 'aiRewrittenText',
                    key: 'aiRewrittenText',
                    width: 250,
                    ellipsis: true
                  },
                  {
                    title: '人工标注文本',
                    dataIndex: 'humanAnnotatedText',
                    key: 'humanAnnotatedText',
                    width: 250,
                    ellipsis: true
                  },
                  {
                    title: '问题大类',
                    dataIndex: 'majorCategory',
                    key: 'majorCategory',
                    width: 150,
                    render: (text: string) => (
                      <Space direction="vertical" size={2}>
                        {text.split(',').filter(Boolean).map((cat, idx) => (
                          <Tag key={idx} color="blue">{cat}</Tag>
                        ))}
                      </Space>
                    ),
                    filters: (() => {
                      // 提取所有唯一的问题大类
                      const allMajorCategories = new Set<string>();
                      rawData.forEach(item => {
                        if (item.majorCategory) {
                          item.majorCategory.split(',').filter(Boolean).forEach(cat => {
                            allMajorCategories.add(cat.trim());
                          });
                        }
                      });
                      return Array.from(allMajorCategories).sort().map(cat => ({
                        text: cat,
                        value: cat
                      }));
                    })(),
                    filteredValue: detailTableFilters.majorCategory || null,
                    onFilter: (value, record) => {
                      if (!record.majorCategory) return false;
                      return record.majorCategory.split(',').some(cat => cat.trim() === value);
                    }
                  },
                  {
                    title: '问题小类',
                    dataIndex: 'minorCategory',
                    key: 'minorCategory',
                    width: 150,
                    render: (text: string) => (
                      <Space direction="vertical" size={2}>
                        {text.split(',').filter(Boolean).map((cat, idx) => (
                          <Tag key={idx} color="cyan">{cat}</Tag>
                        ))}
                      </Space>
                    ),
                    filters: (() => {
                      // 提取所有唯一的问题小类
                      const allMinorCategories = new Set<string>();
                      rawData.forEach(item => {
                        if (item.minorCategory) {
                          item.minorCategory.split(',').filter(Boolean).forEach(cat => {
                            allMinorCategories.add(cat.trim());
                          });
                        }
                      });
                      return Array.from(allMinorCategories).sort().map(cat => ({
                        text: cat,
                        value: cat
                      }));
                    })(),
                    filteredValue: detailTableFilters.minorCategory || null,
                    onFilter: (value, record) => {
                      if (!record.minorCategory) return false;
                      return record.minorCategory.split(',').some(cat => cat.trim() === value);
                    }
                  },
                {
                  title: '标注人',
                  dataIndex: 'annotator',
                  key: 'annotator',
                  width: 100
                },
                {
                  title: '质检人',
                  dataIndex: 'inspector',
                  key: 'inspector',
                  width: 100
                },
                {
                  title: '复检人',
                  dataIndex: 'reviewer',
                  key: 'reviewer',
                  width: 100
                }
              ]}
              dataSource={rawData}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`
              }}
              scroll={{ x: 'max-content' }}
              size="small"
              onChange={(pagination, filters) => {
                // 当用户手动更改筛选器时，更新状态
                setDetailTableFilters(filters as Record<string, any>);
              }}
            />
          </Card>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
