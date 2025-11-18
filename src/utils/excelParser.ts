import * as XLSX from 'xlsx';
import type { AnnotationItem } from '../types';

// 解析Excel文件
export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // 读取第一个工作表
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        resolve(jsonData as any[]);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsBinaryString(file);
  });
}

// 将Excel数据转换为标注数据格式
export function convertExcelToAnnotations(
  excelData: any[],
  videoInfo: { name: string; url: string; subject: string }
): AnnotationItem[] {
  // 假设Excel格式：
  // 第一行是表头
  // 列：句子编号 | 开始时间 | 结束时间 | 原文文本 | 大模型改写文本 | ...
  
  if (excelData.length < 2) {
    throw new Error('Excel数据格式不正确');
  }
  
  const headers = excelData[0];
  const rows = excelData.slice(1);
  
  // 查找列索引
  const getColumnIndex = (possibleNames: string[]) => {
    return headers.findIndex((h: string) => 
      possibleNames.some(name => 
        h && h.toString().toLowerCase().includes(name.toLowerCase())
      )
    );
  };
  
  const sentenceNoIdx = getColumnIndex(['句子编号', '编号', 'no', '序号']);
  const startTimeIdx = getColumnIndex(['开始时间', 'start', '起始']);
  const endTimeIdx = getColumnIndex(['结束时间', 'end', '终止']);
  const originalTextIdx = getColumnIndex(['原文', 'original', 'asr', '识别结果']);
  const aiTextIdx = getColumnIndex(['改写', 'rewrite', 'ai', '大模型']);
  
  return rows
    .filter((row: any[]) => row && row.length > 0 && row[0]) // 过滤空行
    .map((row: any[], index: number) => {
      const sentenceNo = sentenceNoIdx >= 0 ? Number(row[sentenceNoIdx]) : index + 1;
      const startTime = startTimeIdx >= 0 ? parseTimeToSeconds(row[startTimeIdx]) : index * 20;
      const endTime = endTimeIdx >= 0 ? parseTimeToSeconds(row[endTimeIdx]) : startTime + 15;
      const originalText = originalTextIdx >= 0 ? String(row[originalTextIdx] || '') : '';
      const aiText = aiTextIdx >= 0 ? String(row[aiTextIdx] || '') : '';
      
      return {
        id: `${videoInfo.name}_${sentenceNo}`,
        sentenceNo,
        timeRange: `${formatSeconds(startTime)} - ${formatSeconds(endTime)}`,
        startTime,
        endTime,
        originalText,
        aiRewrittenText: aiText,
        humanAnnotatedText: aiText, // 初始值与AI改写相同
        majorCategory: '',
        minorCategory: '',
        remark: '',
        status: false,
        videoUrl: videoInfo.url,
        videoName: videoInfo.name,
        subject: videoInfo.subject
      };
    });
}

// 解析时间字符串为秒数
function parseTimeToSeconds(timeStr: any): number {
  if (typeof timeStr === 'number') {
    return timeStr;
  }
  
  const str = String(timeStr).trim();
  
  // 尝试解析 HH:MM:SS 或 MM:SS 格式
  const parts = str.split(':').map(p => parseInt(p) || 0);
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // 纯数字（秒）
    return parts[0];
  }
  
  return 0;
}

// 格式化秒数为时间字符串
function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 导出为Excel模板
export function downloadExcelTemplate() {
  const template = [
    ['句子编号', '开始时间', '结束时间', '原文文本', '大模型改写文本'],
    [1, '00:00', '00:15', '这是原文示例', '这是改写示例'],
    [2, '00:15', '00:30', '第二句原文', '第二句改写'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '标注数据');
  
  XLSX.writeFile(wb, '标注数据模板.xlsx');
}

