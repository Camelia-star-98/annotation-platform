// 格式化时间（秒转为 mm:ss）
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 解析时间字符串为秒数（mm:ss -> seconds）
export function parseTime(timeStr: string): number {
  const [mins, secs] = timeStr.split(':').map(Number);
  return mins * 60 + secs;
}

// 导出为CSV
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  // 获取表头
  const headers = Object.keys(data[0]);
  
  // 构建CSV内容
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // 处理包含逗号的值
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ].join('\n');

  // 创建Blob并下载
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 导出为JSON
export function exportToJSON(data: any[], filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 计算统计数据
export function calculateStatistics(data: any[], groupBy: string) {
  const grouped = data.reduce((acc, item) => {
    const key = item[groupBy];
    if (!key) return acc;
    
    if (!acc[key]) {
      acc[key] = { name: key, value: 0 };
    }
    acc[key].value++;
    return acc;
  }, {} as Record<string, { name: string; value: number }>);

  return (Object.values(grouped) as { name: string; value: number }[]).sort((a, b) => b.value - a.value);
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

