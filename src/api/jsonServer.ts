import type { AnnotationItem, VideoInfo } from '../types';

// API配置
const API_BASE_URL = 'http://localhost:3001';

// ========== 视频相关 ==========

// 获取所有视频
export async function getVideos(): Promise<VideoInfo[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/videos`);
    if (!response.ok) throw new Error('获取视频列表失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return [];
  }
}

// 添加视频
export async function addVideo(video: Omit<VideoInfo, 'id'>): Promise<VideoInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(video),
    });
    if (!response.ok) throw new Error('添加视频失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return null;
  }
}

// 删除视频
export async function deleteVideo(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${id}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('API错误:', error);
    return false;
  }
}

// ========== 标注数据相关 ==========

// 获取指定视频的标注数据
export async function getAnnotations(videoId: string): Promise<AnnotationItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/annotations?videoId=${videoId}`);
    if (!response.ok) throw new Error('获取标注数据失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return [];
  }
}

// 获取所有标注数据
export async function getAllAnnotations(): Promise<AnnotationItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/annotations`);
    if (!response.ok) throw new Error('获取标注数据失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return [];
  }
}

// 添加标注
export async function addAnnotation(annotation: Omit<AnnotationItem, 'id'>): Promise<AnnotationItem | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/annotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(annotation),
    });
    if (!response.ok) throw new Error('添加标注失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return null;
  }
}

// 批量保存标注数据
export async function saveAnnotations(
  videoId: string,
  annotations: AnnotationItem[]
): Promise<boolean> {
  try {
    // 先删除该视频的旧标注
    const oldAnnotations = await getAnnotations(videoId);
    for (const old of oldAnnotations) {
      await fetch(`${API_BASE_URL}/annotations/${old.id}`, {
        method: 'DELETE',
      });
    }

    // 添加新标注
    for (const annotation of annotations) {
      const response = await fetch(`${API_BASE_URL}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...annotation,
          videoId,
        }),
      });
      if (!response.ok) throw new Error('保存标注失败');
    }

    return true;
  } catch (error) {
    console.error('API错误:', error);
    return false;
  }
}

// 更新单条标注
export async function updateAnnotation(
  id: string,
  updates: Partial<AnnotationItem>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/annotations/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.ok;
  } catch (error) {
    console.error('API错误:', error);
    return false;
  }
}

// ========== 用户相关 ==========

// 添加用户
export async function addUser(name: string, role: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, role }),
    });
    return response.ok;
  } catch (error) {
    console.error('API错误:', error);
    return false;
  }
}

// 获取用户列表
export async function getUsers(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('获取用户列表失败');
    return await response.json();
  } catch (error) {
    console.error('API错误:', error);
    return [];
  }
}

// ========== 统计相关 ==========

// 获取标注统计
export async function getAnnotationStats(videoId?: string) {
  try {
    let url = `${API_BASE_URL}/annotations`;
    if (videoId) {
      url += `?videoId=${videoId}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('获取统计数据失败');
    const data = await response.json();

    const total = data.length;
    const completed = data.filter((item: any) => item.status).length;
    const withCategory = data.filter((item: any) => item.majorCategory).length;

    return {
      total,
      completed,
      withCategory,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
    };
  } catch (error) {
    console.error('API错误:', error);
    return null;
  }
}

