import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  message,
  Modal,
  Upload,
  Popconfirm,
  Tag,
  Progress,
  Input
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckOutlined,
  RollbackOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import * as XLSX from 'xlsx';
import ReactPlayer from 'react-player';

const { Header, Content } = Layout;

interface VideoData {
  id: string;
  videoName: string;
  videoUrl?: string; // 添加 videoUrl 字段
  videoFile?: File;
  excelName: string;
  excelFile?: File;
  requiredAnnotators: number; // 待标注数量（需要多少人标注）
  completedAnnotators: number; // 已标注数量（已完成的人数）
  uploadTime: string;
  isPublished: boolean;
}

export default function VideoManagePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [videoList, setVideoList] = useState<VideoData[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [previewRecord, setPreviewRecord] = useState<VideoData | null>(null); // 保存当前预览的记录
  const [previewType, setPreviewType] = useState<'video' | 'excel'>('video');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [uploadedSize, setUploadedSize] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  
  // 分页状态
  const [previewPageSize, setPreviewPageSize] = useState(5);
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  
  // 上传相关状态
  const [videoFileList, setVideoFileList] = useState<UploadFile[]>([]);
  const [excelFileList, setExcelFileList] = useState<UploadFile[]>([]);
  const [requiredAnnotators, setRequiredAnnotators] = useState<number>(1); // 待标注数量
  
  // 更新相关状态
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<VideoData | null>(null);
  const [updateVideoFile, setUpdateVideoFile] = useState<UploadFile | null>(null);
  const [updateExcelFile, setUpdateExcelFile] = useState<UploadFile | null>(null);

  // 加载视频列表
  useEffect(() => {
    loadVideoList();
  }, []);

  const loadVideoList = async () => {
    setLoading(true);
    try {
      // 从 Supabase 加载视频列表
      const { getVideos } = await import('../api/database');
      const videos = await getVideos();
      
      console.log('📹 加载的视频列表:', videos);
      
      // 转换为 VideoData 格式
      const videoData: VideoData[] = videos.map(video => {
        console.log('🎬 单个视频对象:', video);
        console.log('  - video.id:', video.id);
        console.log('  - video.name:', video.name);
        console.log('  - video.url:', video.url);
        console.log('  - video.subject:', video.subject);
        console.log('  - video.duration:', video.duration);
        
        const mappedData = {
          id: video.id,
          videoName: video.name || '未命名视频',
          videoUrl: video.url || '', // 添加 videoUrl 字段
          excelName: `${video.name || '未命名'}_标注数据`,
          requiredAnnotators: video.required_annotators || 1, // 待标注数量
          completedAnnotators: 0, // TODO: 后续需要计算已完成的标注人数
          uploadTime: video.created_at || new Date().toISOString(),
          isPublished: video.is_published || false
        };
        
        console.log('📊 映射后的数据:', mappedData);
        console.log('  - mappedData.videoUrl:', mappedData.videoUrl);
        return mappedData;
      });
      
      console.log('📊 转换后的视频数据:', videoData);
      setVideoList(videoData);
      message.success(`加载了 ${videoData.length} 个视频`);
    } catch (error) {
      console.error('❌ 加载视频列表失败:', error);
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = async () => {
    if (videoFileList.length === 0 || excelFileList.length === 0) {
      message.warning('请选择视频文件和标注表格');
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    
    // 创建 AbortController 用于取消上传
    const abortController = new AbortController();
    setUploadAbortController(abortController);
    
    try {
      // 获取原始文件对象
      const videoUploadFile = videoFileList[0];
      const excelUploadFile = excelFileList[0];
      
      console.log('📦 Upload File对象:', { 
        video: videoUploadFile, 
        excel: excelUploadFile 
      });

      // 尝试多种方式获取真实的File对象
      const videoFile = videoUploadFile.originFileObj || videoUploadFile as any;
      const excelFile = excelUploadFile.originFileObj || excelUploadFile as any;

      console.log('📤 开始上传...', { 
        videoFileName: videoFile?.name, 
        excelFileName: excelFile?.name,
        videoFileType: typeof videoFile,
        excelFileType: typeof excelFile,
        videoIsBlob: videoFile instanceof Blob,
        excelIsBlob: excelFile instanceof Blob,
        videoIsFile: videoFile instanceof File,
        excelIsFile: excelFile instanceof File,
        videoFile: videoFile,
        excelFile: excelFile,
        videoFileListItem: videoUploadFile,
        excelFileListItem: excelUploadFile
      });

      if (!videoFile || !excelFile) {
        message.error('文件读取失败，请重新选择');
        setLoading(false);
        setIsUploading(false);
        return;
      }

      // 检查是否是Blob类型
      if (!(excelFile instanceof Blob)) {
        console.error('❌ excelFile 不是 Blob 类型！', excelFile);
        message.error('Excel文件格式错误，请重新选择');
        setLoading(false);
        setIsUploading(false);
        return;
      }

      // 检查是否已取消
      if (abortController.signal.aborted) {
        throw new Error('上传已取消');
      }

      // 1. 解析Excel获取标注数据 (5%)
      setUploadProgress(5);
      console.log('🔄 开始解析Excel...');
      const excelData = await parseExcel(excelFile);
      console.log('✅ Excel解析成功，数据条数:', excelData.length);
      
      // 检查是否已取消
      if (abortController.signal.aborted) {
        throw new Error('上传已取消');
      }
      
      // 2. 检查视频大小，决定是否压缩 (5% -> 15%)
      setUploadProgress(10);
      let finalVideoFile = videoFile;
      const originalFileSizeMB = videoFile.size / 1024 / 1024;
      console.log('📦 原始视频文件大小:', originalFileSizeMB.toFixed(2), 'MB');
      
      // 如果视频大于 5000MB (5GB)，进行压缩（实际上禁用了压缩）
      if (originalFileSizeMB > 5000) {
        try {
          setIsCompressing(true);
          setCompressionProgress(0);
          message.info(`视频较大 (${originalFileSizeMB.toFixed(1)}MB)，正在压缩...`);
          
          const { loadFFmpeg, compressVideo } = await import('../utils/videoCompressor');
          
          // 模拟加载 FFmpeg 进度 (0-10%)
          setCompressionProgress(5);
          await loadFFmpeg();
          setCompressionProgress(10);
          
          // 模拟压缩进度
          let currentProgress = 10;
          const progressInterval = setInterval(() => {
            currentProgress += 2;
            if (currentProgress < 90) {
              setCompressionProgress(currentProgress);
            }
          }, 1000); // 每秒增加 2%
          
          // 压缩视频
          finalVideoFile = await compressVideo(videoFile, (progress) => {
            clearInterval(progressInterval); // 清除模拟进度
            setCompressionProgress(progress);
            console.log(`🔄 压缩进度: ${progress}%`);
          });
          
          clearInterval(progressInterval);
          setCompressionProgress(100);
          
          const compressedFileSizeMB = finalVideoFile.size / 1024 / 1024;
          const compressionRate = ((1 - compressedFileSizeMB / originalFileSizeMB) * 100).toFixed(1);
          
          message.success(`压缩完成！大小从 ${originalFileSizeMB.toFixed(1)}MB 减少到 ${compressedFileSizeMB.toFixed(1)}MB（压缩 ${compressionRate}%）`);
          console.log('✅ 视频压缩完成');
          
          setIsCompressing(false);
        } catch (error) {
          console.error('❌ 视频压缩失败:', error);
          message.warning('视频压缩失败，将使用原始视频上传');
          setIsCompressing(false);
          finalVideoFile = videoFile; // 使用原始文件
        }
      }
      
      setUploadProgress(15);
      
      // 检查是否已取消
      if (abortController.signal.aborted) {
        throw new Error('上传已取消');
      }
      
      // 3. 上传视频文件到 Supabase Storage (15% -> 70%)
      setUploadProgress(20);
      const { uploadVideoFile, addVideo, saveAnnotations } = await import('../api/database');
      
      const fileSizeMB = finalVideoFile.size / 1024 / 1024;
      console.log('📦 最终视频文件大小:', fileSizeMB.toFixed(2), 'MB');
      
      let videoUrl: string | null = null;
      
      // 尝试上传到 Supabase Storage
      console.log('📤 开始上传视频文件到 Supabase Storage...');
      
      // 记录上传开始时间
      const uploadStartTime = Date.now();
      let lastUpdateTime = uploadStartTime;
      let lastProgress = 0;
      
      // 模拟上传进度并计算速度
      const progressInterval = setInterval(() => {
        if (!abortController.signal.aborted) {
          setUploadProgress(prev => {
            // 让进度条持续增长，但在 95% 前放慢速度
            let newProgress = prev;
            if (prev < 70) {
              newProgress = prev + 2;
            } else if (prev < 90) {
              newProgress = prev + 1; // 70-90% 慢一点
            } else if (prev < 95) {
              newProgress = prev + 0.5; // 90-95% 更慢
            }
            // 95% 以上等待真实完成
            
            // 计算上传速度和剩余时间
            const currentTime = Date.now();
            const elapsedSeconds = (currentTime - uploadStartTime) / 1000;
            const progressDiff = newProgress - lastProgress;
            
            if (progressDiff > 0 && elapsedSeconds > 0) {
              // 计算已上传大小
              const uploadedBytes = (newProgress / 100) * finalVideoFile.size;
              const uploadedMB = uploadedBytes / 1024 / 1024;
              
              // 计算上传速度 (MB/s)
              const speed = uploadedBytes / 1024 / 1024 / elapsedSeconds;
              
              // 计算剩余时间
              const remainingBytes = finalVideoFile.size - uploadedBytes;
              const remainingSeconds = remainingBytes / (speed * 1024 * 1024);
              
              setUploadedSize(`${uploadedMB.toFixed(1)}/${fileSizeMB.toFixed(1)} MB`);
              setUploadSpeed(`${speed.toFixed(2)} MB/s`);
              
              if (remainingSeconds < 60) {
                setRemainingTime(`约 ${Math.ceil(remainingSeconds)} 秒`);
              } else {
                setRemainingTime(`约 ${Math.ceil(remainingSeconds / 60)} 分钟`);
              }
            }
            
            lastProgress = newProgress;
            lastUpdateTime = currentTime;
            return newProgress;
          });
        }
      }, 2000); // 每2秒更新一次
      
      // 先检查文件大小
      if (fileSizeMB > 1024) {
        clearInterval(progressInterval);
        message.error({
          content: `文件过大 (${fileSizeMB.toFixed(1)}MB)，超过1GB限制，无法上传。请压缩视频后再试。`,
          duration: 5
        });
        setUploadProgress(0);
        setIsUploading(false);
        setUploadAbortController(null);
        setUploadSpeed('');
        setUploadedSize('');
        setRemainingTime('');
        return;
      }

      try {
        // 根据文件大小显示提示
        if (fileSizeMB > 500) {
          message.info(`文件较大 (${fileSizeMB.toFixed(1)}MB)，上传可能需要较长时间，请耐心等待...`);
        } else {
          message.info(`正在上传视频 (${fileSizeMB.toFixed(1)}MB)...`);
        }
        
        const uploadedUrl = await uploadVideoFile(finalVideoFile);
        clearInterval(progressInterval);
        
        if (!uploadedUrl) {
          throw new Error('上传返回空URL');
        }
        
        videoUrl = uploadedUrl;
        setUploadProgress(75);
        console.log('✅ 视频上传成功，URL:', videoUrl);
      } catch (error: any) {
        clearInterval(progressInterval);
        console.error('❌ 视频上传失败:', error);
        
        // 上传失败，停止流程
        message.error({
          content: `视频上传失败：${error.message || '请检查网络连接'}`,
          duration: 5
        });
        
        setUploadProgress(0);
        setIsUploading(false);
        setUploadAbortController(null);
        setUploadSpeed('');
        setUploadedSize('');
        setRemainingTime('');
        return;
      }
      
      console.log('✅ 准备保存视频记录，URL:', videoUrl);

      // 3. 创建视频记录 (80%)
      setUploadProgress(80);
      const videoId = `upload_${Date.now()}`;
      const videoName = videoFile.name || videoUploadFile.name || '未命名视频';
      console.log('💾 准备保存视频记录:', { videoId, videoName, videoUrl });
      
      // 确保 videoUrl 不为空
      if (!videoUrl) {
        console.error('❌ 视频URL为空！');
        throw new Error('视频URL为空，无法保存视频记录');
      }
      
      await addVideo({
        id: videoId,
        name: videoName,
        url: videoUrl,
        subject: '未知',
        duration: 0,
        required_annotators: requiredAnnotators // 保存待标注数量
      });
      
      console.log('✅ 视频记录创建成功，URL:', videoUrl);
      console.log('✅ 待标注数量:', requiredAnnotators);

      // 4. 保存标注数据（添加 videoName） (90%)
      setUploadProgress(90);
      const annotationsWithVideoName = excelData.map(item => ({
        ...item,
        videoName: videoName,
        videoId: videoId,
        annotator: '' // 上传时设置为空，标注人标注时会填入自己的名字
      }));
      
      console.log('🚀 准备调用 saveAnnotations');
      console.log('🚀 第一条数据 humanAnnotatedText:', annotationsWithVideoName[0]?.humanAnnotatedText);
      console.log('🚀 第一条数据 annotator:', annotationsWithVideoName[0]?.annotator);
      
      await saveAnnotations(videoId, annotationsWithVideoName);
      
      console.log('✅ 标注数据保存成功');

      // 5. 完成 (100%)
      setUploadProgress(100);
      message.success('上传成功！');
      
      // 延迟关闭，让用户看到100%
      setTimeout(() => {
        setUploadModalVisible(false);
        setVideoFileList([]);
        setExcelFileList([]);
        setRequiredAnnotators(1); // 重置待标注数量
        setUploadProgress(0);
        setIsUploading(false);
        setUploadAbortController(null);
        setUploadSpeed('');
        setUploadedSize('');
        setRemainingTime('');
        loadVideoList();
      }, 500);
    } catch (error) {
      console.error('❌ 上传失败:', error);
      
      // 检查是否是用户取消
      if (error instanceof Error && error.message === '上传已取消') {
        message.info('上传已取消');
      } else {
        message.error(`上传失败：${error instanceof Error ? error.message : '请重试'}`);
      }
      
      setUploadProgress(0);
      setIsUploading(false);
      setUploadAbortController(null);
      setUploadSpeed('');
      setUploadedSize('');
      setRemainingTime('');
    } finally {
      setLoading(false);
    }
  };
  
  // 取消上传
  const handleCancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort();
      message.info('正在取消上传...');
    }
    
    // 重置状态
    setUploadModalVisible(false);
    setVideoFileList([]);
    setExcelFileList([]);
    setUploadProgress(0);
    setIsUploading(false);
    setLoading(false);
    setUploadAbortController(null);
    setUploadSpeed('');
    setUploadedSize('');
    setRemainingTime('');
  };

  // 解析Excel文件
  const parseExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          console.log('📊 Excel 解析结果:');
          console.log('  - 总行数:', jsonData.length);
          if (jsonData.length > 0) {
            console.log('  - 第一行数据:', jsonData[0]);
            console.log('  - Excel 列名:', Object.keys(jsonData[0]));
          }
          
          // 转换为标注数据格式
          const annotations = jsonData.map((row: any, index: number) => {
            const annotation = {
              sentenceNo: row['句子编号'] || row['编号'] || row['序号'] || index + 1,
              startTime: row['开始时间'] || row['startTime'] || row['start_time'] || 0,
              endTime: row['结束时间'] || row['endTime'] || row['end_time'] || 0,
              timeRange: `${row['时间范围'] || row['开始时间'] || row['startTime'] || '00:00'} - ${row['结束时间'] || row['endTime'] || '00:00'}`,
              originalText: row['原始文本'] || row['原文'] || row['原文文本'] || row['ASR识别结果'] || row['originalText'] || row['original_text'] || '',
              aiRewrittenText: row['大模型改写文本'] || row['大模型改写'] || row['AI改写'] || row['aiRewrittenText'] || row['ai_rewritten_text'] || '',
              humanAnnotatedText: row['人工改写文本'] || row['人工标注'] || row['人工标注文本'] || row['humanAnnotatedText'] || row['human_annotated_text'] || '',
              remark: row['改写理由'] || row['理由'] || row['备注'] || row['remark'] || '',
              majorCategory: row['问题大类'] || row['majorCategory'] || '',
              minorCategory: row['问题小类'] || row['minorCategory'] || '',
              status: false,
              isQualified: null
            };
            
            if (index === 0) {
              console.log('🔍 第一条标注数据:', annotation);
              console.log('🔍 humanAnnotatedText 值:', annotation.humanAnnotatedText);
              console.log('🔍 原始 row 数据:', row);
              console.log('🔍 row["人工改写文本"]:', row['人工改写文本']);
            }
            
            return annotation;
          });
          
          console.log('✅ 解析完成，共', annotations.length, '条数据');
          resolve(annotations);
        } catch (error) {
          console.error('❌ Excel 解析失败:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // 更新视频或Excel
  // 撤回已发布的任务
  const handleWithdraw = async (record: VideoData) => {
    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 将视频的 is_published 设置为 false
      const { error } = await supabase
        .from('videos')
        .update({ is_published: false })
        .eq('id', record.id);
      
      if (error) {
        throw error;
      }
      
      message.success(`已撤回任务"${record.videoName}"`);
      loadVideoList(); // 重新加载列表
    } catch (error) {
      console.error('撤回任务失败:', error);
      message.error('撤回任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (record: VideoData) => {
    setCurrentEditRecord(record);
    setIsUpdateModalVisible(true);
  };

  // 执行更新
  const handleUpdateSubmit = async () => {
    if (!currentEditRecord) return;
    
    // 验证是否至少选择了一个文件
    if (!updateVideoFile && !updateExcelFile) {
      message.warning('请至少选择一个文件进行更新');
      return;
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    
    // 创建 AbortController 用于取消上传
    const abortController = new AbortController();
    setUploadAbortController(abortController);
    
    try {
      const { supabase } = await import('../api/supabase');
      const { uploadVideoFile, saveAnnotations } = await import('../api/database');

      // 如果有新视频文件，上传并更新
      if (updateVideoFile) {
        console.log('📤 上传新视频文件...', updateVideoFile);
        
        // 验证文件对象
        if (!updateVideoFile.originFileObj) {
          throw new Error('无法获取视频文件对象');
        }
        
        const videoFile = updateVideoFile.originFileObj as File;
        const fileSizeMB = videoFile.size / 1024 / 1024;
        
        // 检查文件大小
        if (fileSizeMB > 1024) {
          message.error({
            content: `文件过大 (${fileSizeMB.toFixed(1)}MB)，超过1GB限制，无法上传。`,
            duration: 5
          });
          setUploadProgress(0);
          setIsUploading(false);
          setUploadAbortController(null);
          return;
        }
        
        // 记录上传开始时间
        const uploadStartTime = Date.now();
        
        // 模拟上传进度
        const progressInterval = setInterval(() => {
          if (!abortController.signal.aborted) {
            setUploadProgress(prev => {
              let newProgress = prev;
              if (prev < 70) {
                newProgress = prev + 3;
              } else if (prev < 90) {
                newProgress = prev + 1;
              } else if (prev < 95) {
                newProgress = prev + 0.5;
              }
              
              // 计算上传速度和剩余时间
              const currentTime = Date.now();
              const elapsedSeconds = (currentTime - uploadStartTime) / 1000;
              
              if (elapsedSeconds > 0) {
                const uploadedBytes = (newProgress / 100) * videoFile.size;
                const uploadedMB = uploadedBytes / 1024 / 1024;
                const speed = uploadedBytes / 1024 / 1024 / elapsedSeconds;
                const remainingBytes = videoFile.size - uploadedBytes;
                const remainingSeconds = remainingBytes / (speed * 1024 * 1024);
                
                setUploadedSize(`${uploadedMB.toFixed(1)}/${fileSizeMB.toFixed(1)} MB`);
                setUploadSpeed(`${speed.toFixed(2)} MB/s`);
                
                if (remainingSeconds < 60) {
                  setRemainingTime(`约 ${Math.ceil(remainingSeconds)} 秒`);
                } else {
                  setRemainingTime(`约 ${Math.ceil(remainingSeconds / 60)} 分钟`);
                }
              }
              
              return newProgress;
            });
          }
        }, 2000);
        
        setUploadProgress(10);
        const videoUrl = await uploadVideoFile(videoFile);
        
        clearInterval(progressInterval);
        
        if (!videoUrl) {
          throw new Error('视频上传失败，未返回URL');
        }
        
        console.log('✅ 视频上传成功，URL:', videoUrl);
        setUploadProgress(95);
        
        // 更新视频URL和名称
        const { error } = await supabase
          .from('videos')
          .update({ 
            url: videoUrl,
            name: updateVideoFile.name 
          })
          .eq('id', currentEditRecord.id);

        if (error) {
          console.error('❌ 更新数据库失败:', error);
          throw error;
        }
        console.log('✅ 视频信息已更新到数据库');
      }

      // 如果有新Excel文件，解析并更新标注数据
      if (updateExcelFile) {
        setUploadProgress(updateVideoFile ? 96 : 20);
        console.log('📤 解析并更新Excel数据...');
        const excelData = await parseExcel(updateExcelFile.originFileObj as File);
        
        setUploadProgress(updateVideoFile ? 97 : 60);
        // 删除旧的标注数据
        const { error: deleteError } = await supabase
          .from('annotations')
          .delete()
          .eq('video_id', currentEditRecord.id);

        if (deleteError) {
          throw deleteError;
        }

        setUploadProgress(updateVideoFile ? 98 : 80);
        // 插入新的标注数据
        await saveAnnotations(currentEditRecord.id, excelData);
        
        console.log('✅ Excel数据已更新');
      }

      setUploadProgress(100);
      message.success('更新成功');
      
      // 延迟关闭，让用户看到100%
      setTimeout(() => {
        setIsUpdateModalVisible(false);
        setUpdateVideoFile(null);
        setUpdateExcelFile(null);
        setCurrentEditRecord(null);
        setUploadProgress(0);
        setIsUploading(false);
        setUploadAbortController(null);
        setUploadSpeed('');
        setUploadedSize('');
        setRemainingTime('');
        loadVideoList();
      }, 500);
    } catch (error) {
      console.error('❌ 更新失败:', error);
      
      if (abortController.signal.aborted) {
        message.info('更新已取消');
      } else {
        message.error('更新失败');
      }
      
      setUploadProgress(0);
      setIsUploading(false);
      setUploadAbortController(null);
      setUploadSpeed('');
      setUploadedSize('');
      setRemainingTime('');
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (record: VideoData) => {
    setLoading(true);
    try {
      console.log('🗑️ 删除视频:', record);
      
      // 导入 supabase 客户端
      const { supabase } = await import('../api/supabase');
      
      // 1. 删除该视频的所有标注数据
      const { error: annotationsError } = await supabase
        .from('annotations')
        .delete()
        .eq('video_id', record.id);
      
      if (annotationsError) {
        console.error('删除标注数据失败:', annotationsError);
        message.error('删除标注数据失败');
        setLoading(false);
        return;
      }
      
      console.log('✅ 标注数据已删除');
      
      // 2. 删除视频记录
      const { error: videoError } = await supabase
        .from('videos')
        .delete()
        .eq('id', record.id);
      
      if (videoError) {
        console.error('删除视频记录失败:', videoError);
        message.error('删除视频记录失败');
        setLoading(false);
        return;
      }
      
      console.log('✅ 视频记录已删除');
      
      message.success('删除成功');
      loadVideoList(); // 刷新列表
    } catch (error) {
      console.error('❌ 删除失败:', error);
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 预览视频
  const handlePreviewVideo = (record: VideoData) => {
    console.log('=' .repeat(50));
    console.log('📹 点击预览视频');
    console.log('🔍 视频记录:', record);
    console.log('📝 视频ID:', record.id);
    console.log('📝 视频名称:', record.videoName);
    console.log('📝 视频URL:', record.videoUrl);
    console.log('📝 URL类型:', record.videoUrl?.startsWith('http') ? 'HTTP URL' : record.videoUrl?.startsWith('blob') ? 'Blob URL' : '空或其他');
    console.log('=' .repeat(50));
    
    if (!record.videoUrl) {
      console.error('❌ 视频URL不存在！');
      message.error('视频URL不存在，无法预览。这可能是旧数据，请重新上传视频。');
      return;
    }
    
    setPreviewType('video');
    setPreviewContent(record);
    setPreviewRecord(record); // 保存记录信息
    setPreviewModalVisible(true);
  };

  // 预览Excel
  const handlePreviewExcel = async (record: VideoData) => {
    setLoading(true);
    try {
      // 从数据库加载该视频的标注数据
      const { getAnnotations } = await import('../api/database');
      const annotations = await getAnnotations(record.id);
      
      // 重置分页状态
      setPreviewCurrentPage(1);
      setPreviewPageSize(5);
      
      setPreviewType('excel');
      setPreviewContent(annotations);
      setPreviewRecord(record); // 保存记录信息
      setPreviewModalVisible(true);
    } catch (error) {
      console.error('加载标注数据失败:', error);
      message.error('加载标注数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 发布任务
  const handlePublish = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一个视频');
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import('../api/supabase');
      
      // 批量更新选中视频的发布状态
      const { error } = await supabase
        .from('videos')
        .update({ is_published: true })
        .in('id', selectedRowKeys);
      
      if (error) {
        throw error;
      }
      
      message.success(`已发布 ${selectedRowKeys.length} 个任务`);
      setSelectedRowKeys([]);
      loadVideoList();
    } catch (error) {
      console.error('发布失败:', error);
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '视频文件名',
      dataIndex: 'videoName',
      key: 'videoName',
      render: (text: string, record: VideoData) => (
        <Button type="link" onClick={() => handlePreviewVideo(record)} icon={<EyeOutlined />}>
          {text}
        </Button>
      )
    },
    {
      title: '标注表格名',
      dataIndex: 'excelName',
      key: 'excelName',
      render: (text: string, record: VideoData) => (
        <Button type="link" onClick={() => handlePreviewExcel(record)} icon={<EyeOutlined />}>
          {text}
        </Button>
      )
    },
    {
      title: '待标注数量',
      dataIndex: 'requiredAnnotators',
      key: 'requiredAnnotators',
      width: 120,
      align: 'center' as const,
      render: (count: number) => `${count} 人`
    },
    {
      title: '已标注数量',
      dataIndex: 'completedAnnotators',
      key: 'completedAnnotators',
      width: 120,
      align: 'center' as const,
      render: (count: number, record: VideoData) => (
        <span style={{ color: count >= record.requiredAnnotators ? '#52c41a' : '#faad14' }}>
          {count} / {record.requiredAnnotators}
        </span>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '状态',
      dataIndex: 'isPublished',
      key: 'isPublished',
      width: 100,
      align: 'center' as const,
      render: (isPublished: boolean) => 
        isPublished ? 
          <Tag color="success" icon={<CheckOutlined />}>已发布</Tag> : 
          <Tag>未发布</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: VideoData) => (
        <Space>
          {record.isPublished ? (
            // 已发布：只显示撤回按钮
            <Popconfirm
              title="确认撤回？"
              description="撤回后，该任务将从任务列表中移除，标注员将无法访问"
              onConfirm={() => handleWithdraw(record)}
              okText="确认撤回"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
              >
                撤回
              </Button>
            </Popconfirm>
          ) : (
            // 未发布：显示更新和删除按钮
            <>
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={() => handleUpdate(record)}
              >
                更新
              </Button>
              <Popconfirm
                title="确定要删除吗？"
                description="删除后数据将无法恢复，包括视频文件和所有标注数据"
                onConfirm={() => handleDelete(record)}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as string[]);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>视频和数据管理</span>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 操作按钮区 */}
            <Space>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                上传视频和数据
              </Button>
              <Button
                type="primary"
                disabled={selectedRowKeys.length === 0}
                onClick={handlePublish}
              >
                发布任务 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
              </Button>
            </Space>

            {/* 视频列表 */}
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={videoList}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个视频`
              }}
            />
          </Space>
        </Card>
      </Content>

      {/* 上传弹窗 */}
      <Modal
        title="上传视频和标注数据"
        open={uploadModalVisible}
        onOk={handleUpload}
        onCancel={isUploading ? handleCancelUpload : () => {
          setUploadModalVisible(false);
          setVideoFileList([]);
          setExcelFileList([]);
          setUploadProgress(0);
        }}
        okText="上传"
        cancelText={isUploading ? "取消上传" : "取消"}
        confirmLoading={loading}
        okButtonProps={{ disabled: isUploading }}
        closable={!isUploading}
        maskClosable={!isUploading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 压缩进度条 */}
          {isCompressing && (
            <div>
              <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                🗜️ 正在压缩视频...
              </div>
              <Progress 
                percent={compressionProgress} 
                status={compressionProgress === 100 ? 'success' : 'active'}
                strokeColor={{
                  '0%': '#ff7a45',
                  '100%': '#ffc53d',
                }}
              />
              <div style={{ textAlign: 'center', color: '#666', marginTop: 8, fontSize: '12px' }}>
                压缩可以减少 50-70% 文件大小，大幅提升上传速度
              </div>
            </div>
          )}
          
          {/* 上传进度条 */}
          {isUploading && !isCompressing && (
            <div>
              <Progress 
                percent={uploadProgress} 
                status={uploadProgress === 100 ? 'success' : 'active'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: 12 }}>
                <div style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: 8 }}>
                  {uploadProgress < 20 && '正在解析Excel...'}
                  {uploadProgress >= 20 && uploadProgress < 75 && '正在上传视频文件...'}
                  {uploadProgress >= 75 && uploadProgress < 80 && '正在保存视频记录...'}
                  {uploadProgress >= 80 && uploadProgress < 95 && '正在保存标注数据...'}
                  {uploadProgress >= 95 && '即将完成...'}
                </div>
                
                {/* 上传速度和进度信息 */}
                {uploadProgress >= 20 && uploadProgress < 75 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-around', 
                    padding: '8px 0',
                    borderTop: '1px solid #f0f0f0',
                    marginTop: 8 
                  }}>
                    {uploadedSize && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#999' }}>已上传</div>
                        <div style={{ fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}>
                          {uploadedSize}
                        </div>
                      </div>
                    )}
                    {uploadSpeed && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#999' }}>上传速度</div>
                        <div style={{ fontSize: '14px', color: '#52c41a', fontWeight: 'bold' }}>
                          {uploadSpeed}
                        </div>
                      </div>
                    )}
                    {remainingTime && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#999' }}>剩余时间</div>
                        <div style={{ fontSize: '14px', color: '#fa8c16', fontWeight: 'bold' }}>
                          {remainingTime}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div>
            <div style={{ marginBottom: 8 }}>视频文件：</div>
            <Upload
              fileList={videoFileList}
              beforeUpload={(file) => {
                console.log('📹 选择视频文件:', file);
                setVideoFileList([{
                  uid: file.uid || Date.now().toString(),
                  name: file.name,
                  status: 'done',
                  originFileObj: file
                } as any]);
                return false;
              }}
              onRemove={() => setVideoFileList([])}
              accept="video/*"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择视频文件</Button>
            </Upload>
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>标注表格：</div>
            <Upload
              fileList={excelFileList}
              beforeUpload={(file) => {
                console.log('📊 选择Excel文件:', file);
                setExcelFileList([{
                  uid: file.uid || Date.now().toString(),
                  name: file.name,
                  status: 'done',
                  originFileObj: file
                } as any]);
                return false;
              }}
              onRemove={() => setExcelFileList([])}
              accept=".xlsx,.xls"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择Excel文件</Button>
            </Upload>
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>待标注数量：</div>
            <Input
              type="number"
              min={1}
              value={requiredAnnotators}
              onChange={(e) => setRequiredAnnotators(Number(e.target.value) || 1)}
              placeholder="请输入需要多少人标注此视频"
              disabled={isUploading || isCompressing}
              addonAfter="人"
            />
            <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
              设置需要多少人对此视频进行标注
            </div>
          </div>
        </Space>
      </Modal>

      {/* 更新弹窗 */}
      <Modal
        title={`更新：${currentEditRecord?.videoName || ''}`}
        open={isUpdateModalVisible}
        onOk={handleUpdateSubmit}
        onCancel={() => {
          setIsUpdateModalVisible(false);
          setUpdateVideoFile(null);
          setUpdateExcelFile(null);
          setCurrentEditRecord(null);
        }}
        okText="确认更新"
        cancelText="取消"
        width={600}
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ 
            padding: '12px', 
            background: '#f0f2f5', 
            borderRadius: '4px',
            marginBottom: 16 
          }}>
            <div style={{ marginBottom: 8 }}>
              <strong>当前视频：</strong> {currentEditRecord?.videoName}
            </div>
            <div>
              <strong>当前表格：</strong> {currentEditRecord?.excelName}
            </div>
          </div>

          {/* 上传进度条 */}
          {isUploading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  更新进度：{uploadProgress.toFixed(1)}%
                </span>
                {uploadAbortController && (
                  <Button 
                    size="small" 
                    danger 
                    onClick={() => {
                      if (uploadAbortController) {
                        uploadAbortController.abort();
                        message.info('正在取消更新...');
                      }
                    }}
                  >
                    取消更新
                  </Button>
                )}
              </div>
              <Progress 
                percent={uploadProgress} 
                status={uploadProgress === 100 ? 'success' : 'active'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              {uploadSpeed && (
                <div style={{ marginTop: 8, fontSize: '13px', color: '#666' }}>
                  <Space split="|">
                    <span>📦 {uploadedSize}</span>
                    <span>⚡ {uploadSpeed}</span>
                    <span>⏱️ {remainingTime}</span>
                  </Space>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>
              更新视频文件（选填，不选则保持原视频）：
            </div>
            <Upload
              fileList={updateVideoFile ? [updateVideoFile] : []}
              beforeUpload={(file) => {
                setUpdateVideoFile({
                  uid: file.uid || Date.now().toString(),
                  name: file.name,
                  status: 'done',
                  originFileObj: file
                } as any);
                return false;
              }}
              onRemove={() => setUpdateVideoFile(null)}
              accept="video/*"
              maxCount={1}
              disabled={isUploading}
            >
              <Button icon={<UploadOutlined />} disabled={isUploading}>选择新视频</Button>
            </Upload>
          </div>

          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>
              更新标注表格（选填，不选则保持原表格）：
            </div>
            <Upload
              fileList={updateExcelFile ? [updateExcelFile] : []}
              beforeUpload={(file) => {
                setUpdateExcelFile({
                  uid: file.uid || Date.now().toString(),
                  name: file.name,
                  status: 'done',
                  originFileObj: file
                } as any);
                return false;
              }}
              onRemove={() => setUpdateExcelFile(null)}
              accept=".xlsx,.xls"
              maxCount={1}
              disabled={isUploading}
            >
              <Button icon={<UploadOutlined />} disabled={isUploading}>选择新Excel</Button>
            </Upload>
          </div>

          <div style={{ 
            padding: '12px', 
            background: '#fffbe6', 
            border: '1px solid #ffe58f',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#666'
          }}>
            💡 提示：只需上传要更新的文件，未选择的文件将保持不变
          </div>
        </Space>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title={
          previewType === 'video' 
            ? `视频预览 - ${previewRecord?.videoName || ''}` 
            : `标注数据预览 - ${previewRecord?.excelName || ''}`
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={800}
      >
        {previewType === 'video' && previewContent && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>视频名称：</strong>{previewContent.videoName}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>视频URL：</strong>
              <a 
                href={previewContent.videoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ fontSize: '12px', wordBreak: 'break-all' }}
              >
                {previewContent.videoUrl}
              </a>
            </div>
            {previewContent.videoUrl ? (
              <div style={{ 
                width: '100%', 
                aspectRatio: '16/9',
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <ReactPlayer
                  url={previewContent.videoUrl}
                  controls
                  width="100%"
                  height="100%"
                  playing={false}
                  onError={(e) => {
                    console.error('❌ 视频播放错误:', e);
                    message.error('视频加载失败，请检查视频URL是否有效');
                  }}
                  onReady={() => {
                    console.log('✅ 视频加载成功');
                  }}
                  config={{
                    file: {
                      attributes: {
                        controlsList: 'nodownload'
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                backgroundColor: '#f5f5f5',
                borderRadius: '8px'
              }}>
                <p>❌ 视频URL不存在</p>
                <p style={{ fontSize: '12px', color: '#999' }}>
                  这可能是因为视频使用了本地预览模式（blob: URL），刷新页面后失效
                </p>
              </div>
            )}
          </div>
        )}
        {previewType === 'excel' && previewContent && (
          <Table
            dataSource={previewContent}
            columns={[
              { title: '句子编号', dataIndex: 'sentenceNo', width: 80, fixed: 'left' },
              { title: '时间范围', dataIndex: 'timeRange', width: 120 },
              { title: '原始文本', dataIndex: 'originalText', width: 200, ellipsis: true },
              { title: '大模型改写', dataIndex: 'aiRewrittenText', width: 200, ellipsis: true },
              { title: '人工改写', dataIndex: 'humanAnnotatedText', width: 200, ellipsis: true },
              { title: '改写理由', dataIndex: 'remark', width: 150, ellipsis: true }
            ]}
            rowKey="sentenceNo"
            pagination={{ 
              current: previewCurrentPage,
              pageSize: previewPageSize,
              showSizeChanger: true,
              pageSizeOptions: [5, 10, 20, 50, 100],
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, size) => {
                setPreviewCurrentPage(page);
                if (size !== previewPageSize) {
                  setPreviewPageSize(size);
                  setPreviewCurrentPage(1); // 改变每页条数时重置到第一页
                }
              }
            }}
            scroll={{ x: 1000, y: 400 }}
          />
        )}
      </Modal>
    </Layout>
  );
}

