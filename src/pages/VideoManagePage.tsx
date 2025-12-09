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
  Input,
  Alert,
  InputNumber,
  Select
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckOutlined,
  RollbackOutlined,
  FileExcelOutlined
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
  const [useExistingVideo, setUseExistingVideo] = useState(false); // 是否使用已有视频
  const [selectedExistingVideoId, setSelectedExistingVideoId] = useState<string>(''); // 选中的已有视频ID
  const [existingVideos, setExistingVideos] = useState<Array<{id: string, name: string, url: string}>>([]); // 已有视频列表
  
  // 批量上传相关状态
  const [batchUploadTasks, setBatchUploadTasks] = useState<Array<{
    id: string;
    videoFile: File;
    excelFile: File;
    status: 'waiting' | 'uploading' | 'success' | 'failed';
    progress: number;
    error?: string;
  }>>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  
  // 更新相关状态
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<VideoData | null>(null);
  const [updateVideoFile, setUpdateVideoFile] = useState<UploadFile | null>(null);
  const [updateExcelFile, setUpdateExcelFile] = useState<UploadFile | null>(null);

  // 只上传标注数据相关状态
  const [annotationOnlyModalVisible, setAnnotationOnlyModalVisible] = useState(false);
  const [annotationOnlyExcelFile, setAnnotationOnlyExcelFile] = useState<any>(null);
  const [annotationOnlyVideoName, setAnnotationOnlyVideoName] = useState('');
  const [annotationOnlySubject, setAnnotationOnlySubject] = useState('');
  const [annotationOnlyRequiredAnnotators, setAnnotationOnlyRequiredAnnotators] = useState(1);

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
          videoName: video.url ? (video.name || '未命名视频') : '无', // 如果没有视频URL，显示"无"
          videoUrl: video.url || '', // 添加 videoUrl 字段
          excelName: video.annotation_file_name || `${video.name || '未命名'}_标注数据`, // 优先使用上传的文件名，否则使用默认格式
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
      
      // 提取已有视频列表（只包含有URL的视频）
      const existingVideosList = videos
        .filter(v => v.url && v.url.trim() !== '')
        .map(v => ({
          id: v.id,
          name: v.name || '未命名视频',
          url: v.url
        }));
      setExistingVideos(existingVideosList);
      console.log('📹 已有视频列表（供选择）:', existingVideosList.length, '个');
      
      message.success(`加载了 ${videoData.length} 个视频`);
    } catch (error) {
      console.error('❌ 加载视频列表失败:', error);
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传（批量上传）
  const handleUpload = async () => {
    // 检查是否使用已有视频
    if (useExistingVideo) {
      // 使用已有视频时不支持批量上传
      if (!selectedExistingVideoId || excelFileList.length === 0) {
        message.warning('请选择已有视频和标注表格');
        return;
      }
      if (excelFileList.length > 1) {
        message.warning('使用已有视频时，每次只能上传一个标注表格');
        return;
      }
      // 使用单文件上传
      await handleSingleUpload();
      return;
    }
    
    // 上传新视频
    if (videoFileList.length === 0 || excelFileList.length === 0) {
      message.warning('请选择视频文件和标注表格');
      return;
    }
    
    // 检查数量是否一致
    if (videoFileList.length !== excelFileList.length) {
      message.error(`视频数量(${videoFileList.length})和表格数量(${excelFileList.length})不一致！`);
      return;
    }
    
    const fileCount = videoFileList.length;
    
    // 如果只有1个文件，使用单文件上传
    if (fileCount === 1) {
      await handleSingleUpload();
      return;
    }
    
    // 批量上传
    console.log(`📦 开始批量上传：${fileCount} 个文件`);
    message.info(`准备批量上传 ${fileCount} 个视频...`);
    
    setIsBatchUploading(true);
    setLoading(true);
    
    // 准备任务列表
    const tasks = videoFileList.map((videoFile, index) => ({
      id: `task_${Date.now()}_${index}`,
      videoFile: videoFile.originFileObj as File,
      excelFile: excelFileList[index].originFileObj as File,
      status: 'waiting' as const,
      progress: 0
    }));
    
    setBatchUploadTasks(tasks);
    
    // 并发上传（一次3个）
    const CONCURRENT = 3;
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < tasks.length; i += CONCURRENT) {
      const batch = tasks.slice(i, Math.min(i + CONCURRENT, tasks.length));
      
      console.log(`📤 上传批次 ${Math.floor(i / CONCURRENT) + 1}，包含 ${batch.length} 个文件`);
      
      // 并发上传这一批
      const promises = batch.map(async (task, batchIndex) => {
        const taskIndex = i + batchIndex;
        setCurrentBatchIndex(taskIndex);
        
        try {
          // 更新任务状态为上传中
          setBatchUploadTasks(prev => prev.map((t, idx) =>
            idx === taskIndex ? { ...t, status: 'uploading' as const } : t
          ));
          
          await uploadSingleTask(task, taskIndex);
          
          // 更新任务状态为成功
          setBatchUploadTasks(prev => prev.map((t, idx) =>
            idx === taskIndex ? { ...t, status: 'success' as const, progress: 100 } : t
          ));
          
          successCount++;
          console.log(`✅ 任务 ${taskIndex + 1}/${tasks.length} 完成`);
          
        } catch (error: any) {
          // 更新任务状态为失败
          setBatchUploadTasks(prev => prev.map((t, idx) =>
            idx === taskIndex ? { ...t, status: 'failed' as const, error: error.message } : t
          ));
          
          failedCount++;
          console.error(`❌ 任务 ${taskIndex + 1}/${tasks.length} 失败:`, error);
        }
      });
      
      await Promise.all(promises);
    }
    
    // 完成
    setIsBatchUploading(false);
    setLoading(false);
    
    message.success({
      content: `批量上传完成！成功 ${successCount} 个，失败 ${failedCount} 个`,
      duration: 5
    });
    
    // 清空文件列表
    setVideoFileList([]);
    setExcelFileList([]);
    
    // 刷新列表
    loadVideoList();
  };
  
  // 单个任务上传
  const uploadSingleTask = async (task: any, taskIndex: number) => {
    const { videoFile, excelFile } = task;
    
    console.log(`📤 开始上传任务 ${taskIndex + 1}:`, videoFile.name);
    
    // 1. 解析Excel
    const excelData = await parseExcel(excelFile);
    
    // 2. 上传视频
    const { presignedUploadVideo } = await import('../utils/presignedUpload');
    const { addVideo, saveAnnotations } = await import('../api/database');
    
    const videoUrl = await presignedUploadVideo(
      videoFile,
      (percentage) => {
        // 更新进度
        setBatchUploadTasks(prev => prev.map((t, idx) =>
          idx === taskIndex ? { ...t, progress: percentage } : t
        ));
      }
    );
    
    if (!videoUrl) {
      throw new Error('上传返回空URL');
    }
    
    // 3. 保存视频记录
    const videoId = `upload_${Date.now()}_${taskIndex}`;
    const annotationFileName = excelFile.name || '未知标注文件';
    
    console.log(`📝 任务 ${taskIndex + 1} Excel文件名:`, annotationFileName);
    
    await addVideo({
      id: videoId,
      name: videoFile.name,
      url: videoUrl,
      subject: '未知',
      duration: 0,
      required_annotators: requiredAnnotators,
      total_sentences: excelData.length, // 保存视频总句数
      annotation_file_name: annotationFileName // 使用Excel文件的原始文件名
    });
    
    console.log(`✅ 任务 ${taskIndex + 1} 标注文件名已保存:`, annotationFileName);
    
    // 4. 保存标注数据
    const annotationsWithVideoName = excelData.map(item => ({
      ...item,
      videoName: videoFile.name,
      videoId: videoId,
      annotator: ''
    }));
    
    await saveAnnotations(videoId, annotationsWithVideoName);
    
    console.log(`✅ 任务 ${taskIndex + 1} 完成:`, videoFile.name);
  };
  
  // 单文件上传（保留原逻辑）
  const handleSingleUpload = async () => {
    // 检查是否使用已有视频
    if (useExistingVideo) {
      if (!selectedExistingVideoId || excelFileList.length === 0) {
        message.warning('请选择已有视频和标注表格');
        return;
      }
    } else {
      if (videoFileList.length === 0 || excelFileList.length === 0) {
        message.warning('请选择视频文件和标注表格');
        return;
      }
    }

    setLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    
    // 创建 AbortController 用于取消上传
    const abortController = new AbortController();
    setUploadAbortController(abortController);
    
    try {
      // 获取原始文件对象
      const excelUploadFile = excelFileList[0];
      
      console.log('📦 Upload File对象:', { 
        excel: excelUploadFile 
      });

      // 尝试多种方式获取真实的File对象
      const excelFile = excelUploadFile.originFileObj || excelUploadFile as any;

      console.log('📤 开始上传...', { 
        excelFileName: excelFile?.name,
        excelFileType: typeof excelFile,
        excelIsBlob: excelFile instanceof Blob,
        excelIsFile: excelFile instanceof File,
        useExistingVideo: useExistingVideo,
        selectedExistingVideoId: selectedExistingVideoId
      });

      if (!excelFile) {
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

      // 1. 解析Excel获取标注数据
      setUploadProgress(10);
      console.log('🔄 开始解析Excel...');
      const excelData = await parseExcel(excelFile);
      console.log('✅ Excel解析成功，数据条数:', excelData.length);
      
      // 检查是否已取消
      if (abortController.signal.aborted) {
        throw new Error('上传已取消');
      }
      
      setUploadProgress(20);
      
      let videoUrl: string;
      let videoName: string;
      let videoId: string;
      
      // 如果使用已有视频
      if (useExistingVideo && selectedExistingVideoId) {
        console.log('📹 使用已有视频:', selectedExistingVideoId);
        
        // 从 existingVideos 中获取视频信息
        const existingVideo = existingVideos.find(v => v.id === selectedExistingVideoId);
        if (!existingVideo) {
          throw new Error('未找到选中的视频');
        }
        
        videoUrl = existingVideo.url;
        videoName = existingVideo.name;
        videoId = `upload_${Date.now()}`; // 创建新的数据集ID
        
        setUploadProgress(50);
        message.info('使用已有视频，跳过视频上传...');
        
      } else {
        // 上传新视频（原逻辑）
        const videoUploadFile = videoFileList[0];
        const videoFile = videoUploadFile.originFileObj || videoUploadFile as any;
        
        if (!videoFile) {
          message.error('视频文件读取失败，请重新选择');
          setLoading(false);
          setIsUploading(false);
          return;
        }
        
        // 2. 检查视频大小，决定是否压缩
        setUploadProgress(10);
        let finalVideoFile = videoFile;
        const originalFileSizeMB = videoFile.size / 1024 / 1024;
        console.log('📦 原始视频文件大小:', originalFileSizeMB.toFixed(2), 'MB');
        
        // 禁用压缩，直接使用预签名直传（更快更可靠）
        if (originalFileSizeMB > 1000) {
          message.warning(`视频较大 (${originalFileSizeMB.toFixed(1)}MB)，建议使用视频编辑软件先压缩后再上传`);
        }
        
        setUploadProgress(15);
        
        // 检查是否已取消
        if (abortController.signal.aborted) {
          throw new Error('上传已取消');
        }
        
        // 3. 上传视频文件到 Supabase Storage
        setUploadProgress(20);
        const { presignedUploadVideo } = await import('../utils/presignedUpload');
        
        const fileSizeMB = finalVideoFile.size / 1024 / 1024;
        console.log('📦 最终视频文件大小:', fileSizeMB.toFixed(2), 'MB');
        
        // 检查文件大小
        if (fileSizeMB > 1024) {
          message.error({
            content: `文件过大 (${fileSizeMB.toFixed(1)}MB)，超过1GB限制，无法上传。`,
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
          // 显示上传提示
          message.info(`正在预签名直传 (${fileSizeMB.toFixed(1)}MB)...`);
          
          const uploadStartTime = Date.now();
          
          // 使用预签名直传（带实时进度）
          const uploadedUrl = await presignedUploadVideo(
            finalVideoFile,
            (percentage) => {
              // 真实上传进度回调
              const currentTime = Date.now();
              const elapsedSeconds = (currentTime - uploadStartTime) / 1000;
              
              // 映射进度到 20-70%
              const mappedProgress = 20 + (percentage * 0.50);
              setUploadProgress(mappedProgress);
              
              // 计算速度信息
              if (elapsedSeconds > 0 && percentage > 5) {
                const uploadedBytes = (percentage / 100) * finalVideoFile.size;
                const uploadedMB = uploadedBytes / 1024 / 1024;
                const speed = uploadedBytes / 1024 / 1024 / elapsedSeconds;
                const remainingBytes = finalVideoFile.size - uploadedBytes;
                const remainingSeconds = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0;
                
                setUploadedSize(`${uploadedMB.toFixed(1)}/${fileSizeMB.toFixed(1)} MB`);
                setUploadSpeed(`${speed.toFixed(2)} MB/s`);
                
                if (remainingSeconds < 60) {
                  setRemainingTime(`约 ${Math.ceil(remainingSeconds)} 秒`);
                } else {
                  setRemainingTime(`约 ${Math.ceil(remainingSeconds / 60)} 分钟`);
                }
              }
            }
          );
          
          if (!uploadedUrl) {
            throw new Error('上传返回空URL');
          }
          
          videoUrl = uploadedUrl;
          setUploadProgress(70);
          console.log('✅ 视频上传成功，URL:', videoUrl);
          message.success('视频上传成功！');
        } catch (error: any) {
          console.error('❌ 视频上传失败:', error);
          
          // 如果是CORS错误，给出详细提示
          if (error.message.includes('CORS') || error.message.includes('fetch')) {
            message.error({
              content: (
                <div>
                  <div>上传失败：CORS配置问题</div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    请在 Supabase Dashboard → Storage → Configuration 中添加您的域名
                  </div>
                </div>
              ),
              duration: 8
            });
          } else {
            message.error({
              content: `视频上传失败：${error.message || '请检查网络连接'}`,
              duration: 5
            });
          }
          
          setUploadProgress(0);
          setIsUploading(false);
          setUploadAbortController(null);
          setUploadSpeed('');
          setUploadedSize('');
          setRemainingTime('');
          return;
        }
        
        videoName = videoFile.name || videoUploadFile.name || '未命名视频';
        videoId = `upload_${Date.now()}`;
      }
      
      console.log('✅ 准备保存视频记录，URL:', videoUrl);

      // 4. 创建视频记录
      setUploadProgress(80);
      const { addVideo, saveAnnotations } = await import('../api/database');
      console.log('💾 准备保存视频记录:', { videoId, videoName, videoUrl });
      
      // 确保 videoUrl 不为空
      if (!videoUrl) {
        console.error('❌ 视频URL为空！');
        throw new Error('视频URL为空，无法保存视频记录');
      }
      
      // 获取Excel文件名（无论是使用已有视频还是上传新视频）
      const annotationFileName = excelFile.name || '未知标注文件';
      console.log('📝 Excel文件名:', annotationFileName);
      console.log('📝 excelFile对象:', excelFile);
      
      await addVideo({
        id: videoId,
        name: videoName,
        url: videoUrl,
        subject: '未知',
        duration: 0,
        required_annotators: requiredAnnotators, // 保存待标注数量
        total_sentences: excelData.length, // 保存视频总句数
        annotation_file_name: annotationFileName // 使用Excel文件的原始文件名
      });
      
      console.log('✅ 视频记录创建成功，URL:', videoUrl);
      console.log('✅ 待标注数量:', requiredAnnotators);
      console.log('✅ 标注文件名已保存:', annotationFileName);

      // 5. 保存标注数据（添加 videoName）
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

      // 6. 完成 (100%)
      setUploadProgress(100);
      message.success('上传成功！');
      
      // 延迟关闭，让用户看到100%
      setTimeout(() => {
        setUploadModalVisible(false);
        setVideoFileList([]);
        setExcelFileList([]);
        setRequiredAnnotators(1); // 重置待标注数量
        setUseExistingVideo(false); // 重置使用已有视频
        setSelectedExistingVideoId(''); // 重置选中的视频ID
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
  
  // 只上传标注数据（不需要视频）
  const handleAnnotationOnlyUpload = async () => {
    // 验证
    if (!annotationOnlyVideoName.trim()) {
      message.warning('请输入数据集名称');
      return;
    }
    
    if (!annotationOnlyExcelFile) {
      message.warning('请上传标注数据表格');
      return;
    }
    
    if (annotationOnlyRequiredAnnotators < 1 || annotationOnlyRequiredAnnotators > 10) {
      message.warning('待标注数量需要在1-10之间');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { addVideo, saveAnnotations } = await import('../api/database');
      
      // 1. 解析 Excel 文件（使用统一的parseExcel函数）
      setUploadProgress(20);
      message.info('正在解析标注数据...');
      
      // 将 File 对象转换为 File 类型（parseExcel需要File类型）
      const excelFile = annotationOnlyExcelFile instanceof File 
        ? annotationOnlyExcelFile 
        : new File([annotationOnlyExcelFile], annotationOnlyExcelFile.name || 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // 使用parseExcel函数解析（支持多种列名格式）
      const parsedAnnotations = await parseExcel(excelFile);

      if (parsedAnnotations.length === 0) {
        message.error('Excel文件中没有数据');
        setIsUploading(false);
        return;
      }

      setUploadProgress(40);

      // 2. 生成虚拟视频ID
      const videoId = `annotation_only_${Date.now()}`;
      
      // 3. 创建虚拟视频记录（没有URL）
      // 使用 Excel 文件名作为标注文件名
      const excelFileName = annotationOnlyExcelFile.name;
      const annotationFileName = excelFileName; // 保留完整的文件名（包括后缀）
      
      const video = {
        id: videoId,
        name: annotationOnlyVideoName,
        url: '', // 空URL表示没有视频
        subject: annotationOnlySubject || '未知',
        duration: 0,
        required_annotators: annotationOnlyRequiredAnnotators,
        total_sentences: parsedAnnotations.length, // 保存视频总句数
        annotation_file_name: annotationFileName // 使用Excel文件名作为标注文件名
      };

      console.log('💾 创建虚拟视频记录:', video);
      const addedVideo = await addVideo(video);
      
      if (!addedVideo) {
        throw new Error('创建数据集记录失败');
      }

      setUploadProgress(60);

      // 4. 转换并保存标注数据（使用parseExcel解析的结果）
      // 使用标注文件名（去掉.xlsx/.xls后缀）作为标注数据ID的前缀
      const annotationIdPrefix = annotationFileName.replace(/\.(xlsx|xls)$/i, '');
      
      const annotations = parsedAnnotations.map((item: any, index: number) => {
        return {
          id: `${annotationIdPrefix}_${index + 1}`, // 使用标注文件名作为前缀
          videoId: videoId,
          sentenceNo: item.sentenceNo || index + 1,
          timeRange: item.timeRange || '-',
          startTime: item.startTime || 0,
          endTime: item.endTime || 0,
          originalText: item.originalText || '',
          aiRewrittenText: item.aiRewrittenText || '',
          humanAnnotatedText: item.humanAnnotatedText || '',
          majorCategory: item.majorCategory || '',
          minorCategory: item.minorCategory || '',
          remark: item.remark || '',
          status: false,
          annotator: '',
          videoName: annotationOnlyVideoName,
          videoUrl: '', // 空URL
          subject: annotationOnlySubject || '未知'
        };
      });

      console.log('📝 准备保存标注数据:', annotations.length, '条');
      const success = await saveAnnotations(videoId, annotations);

      if (!success) {
        throw new Error('保存标注数据失败');
      }

      setUploadProgress(100);
      message.success(`标注数据上传成功！共 ${annotations.length} 条数据`);
      
      // 重置表单
      setAnnotationOnlyModalVisible(false);
      setAnnotationOnlyVideoName('');
      setAnnotationOnlySubject('');
      setAnnotationOnlyExcelFile(null);
      setAnnotationOnlyRequiredAnnotators(1);
      
      // 刷新列表
      loadVideoList();

    } catch (error: any) {
      console.error('❌ 上传标注数据失败:', error);
      message.error(`上传失败：${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
  const parseExcel = async (file: Blob): Promise<any[]> => {
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
              status: true, // 上传的数据默认为已标注状态，可直接进入质检队列
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
    
    if (!record.videoUrl || record.videoName === '无') {
      console.error('❌ 视频URL不存在！');
      message.info('此数据集没有关联视频，仅包含标注数据。');
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
      
      console.log('📤 开始发布任务，选中的视频ID:', selectedRowKeys);
      
      // 批量更新选中视频的发布状态
      const { data, error } = await supabase
        .from('videos')
        .update({ is_published: true })
        .in('id', selectedRowKeys)
        .select();
      
      if (error) {
        console.error('❌ 发布失败，错误详情:', error);
        throw error;
      }
      
      console.log('✅ 发布成功，更新的数据:', data);
      
      if (!data || data.length === 0) {
        message.warning('没有视频被更新，请检查选中的视频是否存在');
        return;
      }
      
      message.success(`已发布 ${data.length} 个任务`);
      setSelectedRowKeys([]);
      
      // 重新加载列表
      await loadVideoList();
    } catch (error: any) {
      console.error('发布失败:', error);
      message.error(`发布失败：${error?.message || '请检查网络连接或重试'}`);
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
    },
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ]
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedRowKeys.length === videoList.length) {
      // 如果已全选，则取消全选
      setSelectedRowKeys([]);
    } else {
      // 否则全选
      const allKeys = videoList.map(video => video.id);
      setSelectedRowKeys(allKeys);
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
            <Space style={{ marginBottom: '16px' }}>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                上传视频和数据
              </Button>
              <Button
                type="default"
                icon={<FileExcelOutlined />}
                onClick={() => setAnnotationOnlyModalVisible(true)}
              >
                只上传标注数据
              </Button>
              <Button
                type="primary"
                disabled={selectedRowKeys.length === 0}
                onClick={handlePublish}
              >
                发布任务 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
              </Button>
            </Space>

            {/* 选择操作区 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '8px'
            }}>
              <Space>
                <Button
                  type={selectedRowKeys.length === videoList.length && videoList.length > 0 ? 'default' : 'primary'}
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleSelectAll}
                >
                  {selectedRowKeys.length === videoList.length && videoList.length > 0 ? '取消全选' : '全选'}
                </Button>
                <span style={{ color: '#666' }}>
                  {selectedRowKeys.length > 0 ? (
                    <span>
                      已选择 <strong style={{ color: '#1890ff' }}>{selectedRowKeys.length}</strong> 个视频
                      {videoList.length > 0 && ` / 共 ${videoList.length} 个`}
                    </span>
                  ) : (
                    <span>未选择视频</span>
                  )}
                </span>
              </Space>
              {selectedRowKeys.length > 0 && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setSelectedRowKeys([])}
                >
                  清空选择
                </Button>
              )}
            </div>

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
        title={videoFileList.length > 1 ? `批量上传视频和数据 (${videoFileList.length} 个)` : "上传视频和标注数据"}
        open={uploadModalVisible}
        onOk={handleUpload}
        onCancel={isUploading || isBatchUploading ? handleCancelUpload : () => {
          setUploadModalVisible(false);
          setVideoFileList([]);
          setExcelFileList([]);
          setUploadProgress(0);
          setBatchUploadTasks([]);
        }}
        okText="上传"
        cancelText={isUploading || isBatchUploading ? "取消上传" : "取消"}
        confirmLoading={loading}
        okButtonProps={{ disabled: isUploading || isBatchUploading }}
        closable={!isUploading && !isBatchUploading}
        maskClosable={!isUploading && !isBatchUploading}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 批量上传进度 */}
          {isBatchUploading && batchUploadTasks.length > 0 && (
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              padding: '16px'
            }}>
              <div style={{ marginBottom: 16, fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                📊 批量上传进度 ({batchUploadTasks.filter(t => t.status === 'success').length}/{batchUploadTasks.length} 完成)
              </div>
              {batchUploadTasks.map((task, index) => (
                <div key={task.id} style={{ 
                  marginBottom: 12,
                  padding: '12px',
                  background: task.status === 'uploading' ? '#e6f7ff' : '#fafafa',
                  borderRadius: '4px',
                  border: `1px solid ${
                    task.status === 'success' ? '#52c41a' :
                    task.status === 'failed' ? '#ff4d4f' :
                    task.status === 'uploading' ? '#1890ff' : '#d9d9d9'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>
                      {index + 1}. {task.videoFile.name}
                    </span>
                    <span style={{ 
                      color: task.status === 'success' ? '#52c41a' :
                             task.status === 'failed' ? '#ff4d4f' :
                             task.status === 'uploading' ? '#1890ff' : '#999'
                    }}>
                      {task.status === 'waiting' && '等待中...'}
                      {task.status === 'uploading' && `上传中 ${task.progress.toFixed(0)}%`}
                      {task.status === 'success' && '✅ 完成'}
                      {task.status === 'failed' && '❌ 失败'}
                    </span>
                  </div>
                  {task.status === 'uploading' && (
                    <Progress percent={task.progress} size="small" status="active" />
                  )}
                  {task.status === 'success' && (
                    <Progress percent={100} size="small" status="success" />
                  )}
                  {task.status === 'failed' && (
                    <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                      错误: {task.error || '未知错误'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'red' }}>* </span>
              视频来源：
            </div>
            <Select
              value={useExistingVideo ? 'existing' : 'new'}
              onChange={(value) => {
                setUseExistingVideo(value === 'existing');
                if (value === 'new') {
                  setSelectedExistingVideoId('');
                }
              }}
              style={{ width: '100%' }}
              disabled={isUploading || isCompressing}
            >
              <Select.Option value="new">上传新视频</Select.Option>
              <Select.Option value="existing">使用已有视频（避免重复上传）</Select.Option>
            </Select>
          </div>
          
          {useExistingVideo ? (
            // 选择已有视频
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'red' }}>* </span>
                选择已有视频：
              </div>
              <Select
                value={selectedExistingVideoId}
                onChange={setSelectedExistingVideoId}
                style={{ width: '100%' }}
                placeholder="请选择已有视频"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={existingVideos.map(v => ({
                  value: v.id,
                  label: v.name
                }))}
                disabled={isUploading}
              />
              <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
                从数据库中选择已上传的视频，避免重复上传相同视频文件
              </div>
            </div>
          ) : (
            // 上传新视频
            <div>
              <div style={{ marginBottom: 8 }}>视频文件：</div>
              <Upload
                fileList={videoFileList}
                beforeUpload={(file) => {
                  console.log('📹 选择视频文件:', file);
                  setVideoFileList(prev => [...prev, {
                    uid: file.uid || `${Date.now()}_${Math.random()}`,
                    name: file.name,
                    status: 'done',
                    originFileObj: file
                  } as any]);
                  return false;
                }}
                onRemove={(file) => {
                  setVideoFileList(prev => prev.filter(f => f.uid !== file.uid));
                }}
                accept="video/*"
                multiple
              >
                <Button icon={<UploadOutlined />}>选择视频文件（可多选）</Button>
              </Upload>
              <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
                可以一次选择多个视频，系统将自动批量上传（每次3个并发）
              </div>
            </div>
          )}
          
          <div>
            <div style={{ marginBottom: 8 }}>标注表格：</div>
            <Upload
              fileList={excelFileList}
              beforeUpload={(file) => {
                console.log('📊 选择Excel文件:', file);
                setExcelFileList(prev => [...prev, {
                  uid: file.uid || `${Date.now()}_${Math.random()}`,
                  name: file.name,
                  status: 'done',
                  originFileObj: file
                } as any]);
                return false;
              }}
              onRemove={(file) => {
                setExcelFileList(prev => prev.filter(f => f.uid !== file.uid));
              }}
              accept=".xlsx,.xls"
              multiple
            >
              <Button icon={<UploadOutlined />}>选择Excel文件（可多选）</Button>
            </Upload>
            <div style={{ marginTop: 4, fontSize: '12px', color: '#999' }}>
              数量需要与视频数量一致，按顺序对应
            </div>
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

      {/* 只上传标注数据弹窗 */}
      <Modal
        title="只上传标注数据"
        open={annotationOnlyModalVisible}
        onOk={handleAnnotationOnlyUpload}
        onCancel={() => {
          setAnnotationOnlyModalVisible(false);
          setAnnotationOnlyVideoName('');
          setAnnotationOnlySubject('');
          setAnnotationOnlyExcelFile(null);
          setAnnotationOnlyRequiredAnnotators(1);
        }}
        okText="上传"
        cancelText="取消"
        confirmLoading={isUploading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="说明"
            description="此功能用于只上传标注数据表格，不需要视频文件。适用于已有标注数据但没有对应视频的场景。"
            type="info"
            showIcon
          />

          {/* 数据集名称 */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'red' }}>* </span>
              数据集名称：
            </div>
            <Input
              placeholder="请输入数据集名称（例如：语文标注数据集）"
              value={annotationOnlyVideoName}
              onChange={(e) => setAnnotationOnlyVideoName(e.target.value)}
              maxLength={100}
              disabled={isUploading}
            />
          </div>

          {/* 科目 */}
          <div>
            <div style={{ marginBottom: 8 }}>科目：</div>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择科目"
              value={annotationOnlySubject}
              onChange={setAnnotationOnlySubject}
              allowClear
              disabled={isUploading}
            >
              <Select.Option value="物理">物理</Select.Option>
              <Select.Option value="英语">英语</Select.Option>
              <Select.Option value="数学">数学</Select.Option>
              <Select.Option value="语文">语文</Select.Option>
              <Select.Option value="化学">化学</Select.Option>
            </Select>
          </div>

          {/* 待标注数量 */}
          <div>
            <div style={{ marginBottom: 8 }}>待标注数量：</div>
            <InputNumber
              min={1}
              max={10}
              value={annotationOnlyRequiredAnnotators}
              onChange={(value) => setAnnotationOnlyRequiredAnnotators(value || 1)}
              style={{ width: '100%' }}
              addonAfter="人"
              disabled={isUploading}
            />
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
              设置需要多少人标注此数据集
            </div>
          </div>

          {/* 标注数据表格 */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'red' }}>* </span>
              标注数据表格：
            </div>
            <Upload
              accept=".xlsx,.xls"
              maxCount={1}
              beforeUpload={(file) => {
                setAnnotationOnlyExcelFile(file);
                return false;
              }}
              onRemove={() => {
                setAnnotationOnlyExcelFile(null);
              }}
              disabled={isUploading}
            >
              <Button icon={<FileExcelOutlined />} disabled={isUploading}>
                选择Excel文件
              </Button>
            </Upload>
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
              支持 .xlsx 和 .xls 格式，需包含以下列：句子编号、原文文本、大模型改写文本等
            </div>
          </div>

          {/* 上传进度 */}
          {isUploading && (
            <div>
              <div style={{ marginBottom: 8 }}>上传进度：</div>
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}
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

