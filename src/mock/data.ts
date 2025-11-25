import { ProblemCategory, AnnotationItem, VideoInfo } from '../types';

// 问题分类数据
export const PROBLEM_CATEGORIES: ProblemCategory[] = [
  {
    majorCategory: '大班课话术改写问题',
    minorCategories: [
      '出现"讲义"和具体页数',
      '出现评论区话术',
      '出现互动话术',
      '人称代词改错',
      '出现具体姓名或网名',
      '举例子内容误改成个性化'
    ]
  },
  {
    majorCategory: '大模型改写问题',
    minorCategories: [
      '多加字',
      '开头出现数字序号',
      '语气词加字',
      '单字动词重复',
      '把用中文写出的公式改成用符号表示',
      '把"A一B"改为"A一A"',
      '把asr对的改成错的，影响句意'
    ]
  },
  {
    majorCategory: 'asr识别问题',
    minorCategories: [
      '同音字识别错，不影响句意',
      '近音字识别错，影响句意',
      '中文字/词识别错',
      '英文单词识别错误',
      '识别多字',
      '识别少字',
      '英文单词识别成发音相似中文',
      '中文识别成英文',
      '公式识别错误',
      '念数字时识别无标点间隔',
      '拟声词、语气词识别有误',
      '背噪过大，识别出错'
    ]
  },
  {
    majorCategory: '老师说话不通顺',
    minorCategories: ['老师说错话句意不通']
  },
  {
    majorCategory: '人工个性化改写',
    minorCategories: ['asr识别错误', '大班课话术改写']
  },
  {
    majorCategory: '需要删除',
    minorCategories: ['评论区互动', '英语音标找不到近音汉字转写']
  }
];

// 模拟视频数据
export const MOCK_VIDEOS: VideoInfo[] = [
  {
    id: 'video_1',
    name: '数学课程_01.mp4',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    subject: '数学',
    duration: 300
  },
  {
    id: 'video_2',
    name: '英语课程_01.mp4',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    subject: '英语',
    duration: 420
  },
  {
    id: 'video_3',
    name: '物理课程_01.mp4',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    subject: '物理',
    duration: 360
  }
];

// 生成模拟标注数据
export const generateMockAnnotations = (videoId: string): AnnotationItem[] => {
  const video = MOCK_VIDEOS.find(v => v.id === videoId) || MOCK_VIDEOS[0];
  const count = Math.floor(Math.random() * 10) + 15;
  
  return Array.from({ length: count }, (_, index) => {
    const startTime = index * 20;
    const endTime = startTime + 15;
    
    return {
      id: `${videoId}_${index + 1}`,
      videoId: videoId,
      sentenceNo: index + 1,
      timeRange: `${formatTime(startTime)} - ${formatTime(endTime)}`,
      startTime,
      endTime,
      originalText: `这是第${index + 1}句原文文本，老师正在讲解课程内容，同学们都要认真听讲。`,
      aiRewrittenText: `这是第${index + 1}句大模型改写后的文本，你正在学习课程内容，要认真听讲。`,
      humanAnnotatedText: `这是第${index + 1}句人工标注后的文本，正在学习课程内容，要认真听讲。`,
      majorCategory: '',
      minorCategory: '',
      remark: '',
      status: false,
      videoUrl: video.url,
      videoName: video.name,
      subject: video.subject,
      isQualified: undefined
    };
  });
};

// 格式化时间（秒转为 mm:ss）
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 模拟已标注数据
export const MOCK_ANNOTATED_DATA: AnnotationItem[] = [
  {
    id: 'anno_1',
    videoId: 'video_1',
    sentenceNo: 1,
    timeRange: '00:15 - 00:30',
    startTime: 15,
    endTime: 30,
    originalText: 'OK 的给老孟示一个 OK',
    aiRewrittenText: '好的给你示一个 OK',
    humanAnnotatedText: '好的',
    majorCategory: '大班课话术改写问题',
    minorCategory: '出现评论区话术',
    remark: '出现了"给老孟示一个"这种评论区互动话术',
    status: true,
    videoUrl: MOCK_VIDEOS[0].url,
    videoName: MOCK_VIDEOS[0].name,
    subject: '数学',
    annotator: '张三'
  },
  {
    id: 'anno_2',
    videoId: 'video_1',
    sentenceNo: 5,
    timeRange: '01:20 - 01:35',
    startTime: 80,
    endTime: 95,
    originalText: '刚刚绝大部分同学选的是这个啊',
    aiRewrittenText: '刚刚你选的是这个啊',
    humanAnnotatedText: '你选的是这个',
    majorCategory: '大班课话术改写问题',
    minorCategory: '出现互动话术',
    remark: '出现了"绝大部分同学"互动话术',
    status: true,
    videoUrl: MOCK_VIDEOS[0].url,
    videoName: MOCK_VIDEOS[0].name,
    subject: '数学',
    annotator: '张三'
  },
  {
    id: 'anno_3',
    videoId: 'video_1',
    sentenceNo: 8,
    timeRange: '02:10 - 02:25',
    startTime: 130,
    endTime: 145,
    originalText: '你不能答树啊',
    aiRewrittenText: '你不能答数啊',
    humanAnnotatedText: '你不能回答树',
    majorCategory: 'asr识别问题',
    minorCategory: '同音字识别错，不影响句意',
    remark: '"树"被识别成"数"',
    status: true,
    videoUrl: MOCK_VIDEOS[1].url,
    videoName: MOCK_VIDEOS[1].name,
    subject: '英语',
    annotator: '李四'
  }
];

