// 数据类型定义

export interface AnnotationItem {
  id: string;
  videoId: string; // 视频ID
  sentenceNo: number;
  timeRange: string;
  startTime: number; // 秒
  endTime: number; // 秒
  originalText: string;
  aiRewrittenText: string;
  humanAnnotatedText: string;
  majorCategory: string;
  minorCategory: string;
  remark: string;
  status: boolean; // 标注状态/复检状态
  videoUrl: string;
  videoName: string;
  subject: string; // 科目
  isQualified?: boolean; // 质检用：是否通过
  annotator?: string; // 标注人
  inspector?: string; // 质检人
  reviewer?: string; // 复检人
  reviewStatus?: boolean | null; // 复检状态：true=通过，false=不通过，null=待复检
}

export interface VideoInfo {
  id: string;
  name: string;
  url: string;
  subject: string;
  duration: number;
  required_annotators?: number; // 待标注数量
  created_at?: string;
  is_published?: boolean;
  is_completed?: boolean; // 是否完成所有流程（标注→质检→复检）
}

export interface CategoryOption {
  label: string;
  value: string;
  children?: CategoryOption[];
}

// 问题分类
export interface ProblemCategory {
  majorCategory: string;
  minorCategories: string[];
}

// 统计数据
export interface StatisticsData {
  allSubjectsDistribution: { name: string; value: number }[];
  singleSubjectDistribution: { name: string; value: number }[];
  detailList: AnnotationItem[];
  videoSources: string[];
}

// 用户角色
export type UserRole = 'annotator' | 'inspector' | 'reviewer';

export interface User {
  name: string;
  role: UserRole;
}

