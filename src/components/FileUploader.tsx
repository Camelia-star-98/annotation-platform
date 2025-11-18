import { useState } from 'react';
import { Upload, Button, message, Space, Modal } from 'antd';
import { UploadOutlined, FileExcelOutlined, VideoCameraOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { parseExcelFile, convertExcelToAnnotations, downloadExcelTemplate } from '../utils/excelParser';
import type { AnnotationItem } from '../types';
import './FileUploader.css';

interface FileUploaderProps {
  onDataReady: (data: {
    videoFile: File;
    videoUrl: string;
    annotations: AnnotationItem[];
    videoName: string;
  }) => void;
}

export default function FileUploader({ onDataReady }: FileUploaderProps) {
  const [videoFile, setVideoFile] = useState<RcFile | null>(null);
  const [excelFile, setExcelFile] = useState<RcFile | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [subject, setSubject] = useState<string>('');

  // 处理视频文件上传
  const handleVideoChange = (file: RcFile) => {
    // 验证文件类型
    const isVideo = file.type.startsWith('video/');
    if (!isVideo) {
      message.error('请上传视频文件！');
      return false;
    }

    // 验证文件大小（限制500MB）
    const isLt500M = file.size / 1024 / 1024 < 500;
    if (!isLt500M) {
      message.error('视频文件不能超过500MB！');
      return false;
    }

    setVideoFile(file);
    
    // 创建视频预览URL
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    
    message.success('视频上传成功');
    return false; // 阻止自动上传
  };

  // 处理Excel文件上传
  const handleExcelChange = (file: RcFile) => {
    const isExcel = 
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    if (!isExcel) {
      message.error('请上传Excel文件（.xls或.xlsx）！');
      return false;
    }

    setExcelFile(file);
    message.success('Excel文件上传成功');
    return false; // 阻止自动上传
  };

  // 开始处理
  const handleProcess = async () => {
    if (!videoFile) {
      message.warning('请先上传视频文件');
      return;
    }

    if (!excelFile) {
      message.warning('请先上传Excel文件');
      return;
    }

    try {
      // 解析Excel文件
      const excelData = await parseExcelFile(excelFile);
      
      // 确定科目（从文件名或用户输入）
      const videoName = videoFile.name.replace(/\.[^/.]+$/, ''); // 去除扩展名
      const detectedSubject = videoName.match(/数学|英语|语文|物理|化学|生物|历史|地理|政治/)?.[0] || '';
      
      // 转换为标注数据
      const annotations = convertExcelToAnnotations(excelData, {
        name: videoFile.name,
        url: videoUrl,
        subject: detectedSubject || '未知'
      });

      if (annotations.length === 0) {
        message.error('Excel文件中没有有效数据');
        return;
      }

      // 回调返回数据
      onDataReady({
        videoFile,
        videoUrl,
        annotations,
        videoName: videoFile.name
      });

      message.success(`成功解析 ${annotations.length} 条数据`);
      setIsModalVisible(false);
      
      // 清空状态
      setVideoFile(null);
      setExcelFile(null);
    } catch (error) {
      console.error('处理文件失败：', error);
      message.error('文件处理失败，请检查Excel格式是否正确');
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    message.success('模板下载成功');
  };

  return (
    <>
      <Button
        type="primary"
        size="large"
        icon={<UploadOutlined />}
        onClick={() => setIsModalVisible(true)}
      >
        上传视频和标注数据
      </Button>

      <Modal
        title="上传视频和标注数据"
        open={isModalVisible}
        onOk={handleProcess}
        onCancel={() => setIsModalVisible(false)}
        okText="开始标注"
        cancelText="取消"
        width={600}
        okButtonProps={{ disabled: !videoFile || !excelFile }}
      >
        <div className="file-uploader-content">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 下载模板 */}
            <div className="upload-section">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载Excel模板
              </Button>
              <span style={{ marginLeft: 12, color: '#999' }}>
                不清楚格式？先下载模板查看
              </span>
            </div>

            {/* 视频上传 */}
            <div className="upload-section">
              <div className="upload-label">
                <VideoCameraOutlined /> 1. 上传视频文件
              </div>
              <Upload
                beforeUpload={handleVideoChange}
                maxCount={1}
                accept="video/*"
                fileList={videoFile ? [{
                  uid: '-1',
                  name: videoFile.name,
                  status: 'done',
                  url: videoUrl
                } as UploadFile] : []}
                onRemove={() => {
                  setVideoFile(null);
                  setVideoUrl('');
                }}
              >
                <Button icon={<VideoCameraOutlined />}>
                  选择视频文件
                </Button>
              </Upload>
              {videoFile && (
                <div className="file-info">
                  <span className="file-name">{videoFile.name}</span>
                  <span className="file-size">
                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>

            {/* Excel上传 */}
            <div className="upload-section">
              <div className="upload-label">
                <FileExcelOutlined /> 2. 上传Excel标注数据
              </div>
              <Upload
                beforeUpload={handleExcelChange}
                maxCount={1}
                accept=".xls,.xlsx"
                fileList={excelFile ? [{
                  uid: '-2',
                  name: excelFile.name,
                  status: 'done'
                } as UploadFile] : []}
                onRemove={() => {
                  setExcelFile(null);
                }}
              >
                <Button icon={<FileExcelOutlined />}>
                  选择Excel文件
                </Button>
              </Upload>
              {excelFile && (
                <div className="file-info">
                  <span className="file-name">{excelFile.name}</span>
                </div>
              )}
            </div>

            {/* 说明 */}
            <div className="upload-tips">
              <p><strong>Excel文件格式要求：</strong></p>
              <ul>
                <li>第一行为表头</li>
                <li>必须包含：句子编号、原文文本</li>
                <li>可选列：开始时间、结束时间、大模型改写文本</li>
                <li>时间格式：MM:SS 或 HH:MM:SS</li>
              </ul>
            </div>
          </Space>
        </div>
      </Modal>
    </>
  );
}

