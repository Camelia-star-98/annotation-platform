import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

/**
 * 初始化 FFmpeg
 */
export async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<void> {
  if (isLoaded && ffmpeg) {
    return;
  }

  try {
    console.log('🔄 开始加载 FFmpeg...');
    ffmpeg = new FFmpeg();
    
    // 监听日志
    ffmpeg.on('log', ({ message }) => {
      console.log('📝 FFmpeg:', message);
    });

    // 监听进度
    ffmpeg.on('progress', ({ progress, time }) => {
      console.log(`📊 FFmpeg 进度: ${(progress * 100).toFixed(1)}%, 时间: ${time}`);
    });

    // 使用本地 FFmpeg 文件（更稳定）
    console.log('📦 从本地加载 FFmpeg core...');
    const baseURL = window.location.origin + '/ffmpeg';
    
    await ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      workerURL: `${baseURL}/ffmpeg-core.worker.js`,
    });

    isLoaded = true;
    console.log('✅ FFmpeg 加载成功！');
  } catch (error) {
    console.error('❌ FFmpeg 加载失败:', error);
    isLoaded = false;
    ffmpeg = null;
    throw new Error('FFmpeg 加载失败，视频压缩功能不可用。');
  }
}

/**
 * 压缩视频
 * @param file 原始视频文件
 * @param onProgress 压缩进度回调 (0-100)
 * @returns 压缩后的视频文件
 */
export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  if (!ffmpeg || !isLoaded) {
    throw new Error('FFmpeg 未加载，请先调用 loadFFmpeg()');
  }

  try {
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    console.log('📦 开始压缩视频:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // 将文件写入 FFmpeg 虚拟文件系统
    onProgress?.(10);
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    console.log('📤 文件已加载到 FFmpeg');
    onProgress?.(20);

    // 设置压缩参数
    // -c:v libx264: 使用 H.264 编码
    // -crf 28: 质量因子 (18-28 为推荐范围，数值越大压缩率越高但质量越低)
    // -preset fast: 编码速度预设
    // -c:a aac: 音频使用 AAC 编码
    // -b:a 128k: 音频比特率
    const ffmpegArgs = [
      '-i', inputFileName,
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'ultrafast', // 改为 ultrafast 加快速度
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y', // 自动覆盖输出文件
      outputFileName
    ];

    // 监听压缩进度
    let lastProgress = 20;
    ffmpeg.on('progress', ({ progress, time }) => {
      const percent = Math.floor(progress * 100);
      console.log(`🔄 压缩进度: ${percent}%, 时间: ${time}`);
      
      // 更新进度（20-90%）
      const newProgress = 20 + percent * 0.7;
      if (newProgress > lastProgress) {
        lastProgress = newProgress;
        onProgress?.(newProgress);
      }
    });
    
    // 监听日志（用于调试）
    ffmpeg.on('log', ({ type, message }) => {
      if (type === 'fferr') {
        console.log('FFmpeg log:', message);
      }
    });

    console.log('🎬 开始执行 FFmpeg 命令...');
    
    // 使用模拟进度（因为 FFmpeg progress 事件可能不稳定）
    let simulatedProgress = 20;
    const progressSimulator = setInterval(() => {
      if (simulatedProgress < 90) {
        simulatedProgress += 5;
        console.log(`🔄 模拟压缩进度: ${simulatedProgress}%`);
        onProgress?.(simulatedProgress);
      }
    }, 2000); // 每2秒增加5%
    
    // 执行压缩
    try {
      await ffmpeg.exec(ffmpegArgs);
      clearInterval(progressSimulator);
    } catch (error) {
      clearInterval(progressSimulator);
      throw error;
    }

    console.log('✅ 视频压缩完成');
    onProgress?.(95);

    // 读取压缩后的文件
    const data = await ffmpeg.readFile(outputFileName);
    const compressedBlob = new Blob([data], { type: 'video/mp4' });
    
    // 创建新的 File 对象
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^.]+$/, '_compressed.mp4'),
      { type: 'video/mp4' }
    );

    console.log('📦 压缩后大小:', `${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('📊 压缩率:', `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`);

    // 清理临时文件
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    onProgress?.(100);

    return compressedFile;
  } catch (error) {
    console.error('❌ 视频压缩失败:', error);
    throw error;
  }
}

/**
 * 检查文件是否需要压缩
 * @param file 视频文件
 * @param thresholdMB 压缩阈值（MB），默认 50MB
 * @returns 是否需要压缩
 */
export function shouldCompress(file: File, thresholdMB: number = 50): boolean {
  const fileSizeMB = file.size / 1024 / 1024;
  return fileSizeMB > thresholdMB;
}

