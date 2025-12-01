import React, { useState, useEffect } from 'react';
import { Modal, Timeline, Spin, message, Button, Tag, Descriptions, Empty } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '../api/supabase';

interface HistoryVersion {
  id: string;
  videoId: string;
  sentenceNo: number;
  originalText: string;
  humanAnnotatedText: string;
  majorCategory: string;
  minorCategory: string;
  remark: string;
  annotator: string;
  isQualified: boolean | null;
  inspector: string;
  rejectionCount: number;
  createdAt: string;
  updatedAt: string;
  // rejected_annotations 表的字段
  rejectedAt?: string;
  resubmittedAt?: string;
  isResubmitted?: boolean;
  newAnnotationId?: string;
}

interface AnnotationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  annotationId: string; // 当前查看的 annotation ID
}

const AnnotationHistoryModal: React.FC<AnnotationHistoryModalProps> = ({
  visible,
  onClose,
  annotationId
}) => {
  const [loading, setLoading] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[]>([]);

  useEffect(() => {
    if (visible && annotationId) {
      loadHistory();
    }
  }, [visible, annotationId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      console.log('🔍 查询历史版本，起始ID:', annotationId);
      
      const versions: HistoryVersion[] = [];
      const visited = new Set<string>(); // 防止循环引用
      
      // 递归查询所有版本
      await findAllVersions(annotationId, versions, visited);
      
      // 按时间排序（最新的在前）
      versions.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      
      console.log('📜 找到历史版本:', versions.length, '个');
      setHistoryVersions(versions);
      
    } catch (error) {
      console.error('❌ 加载历史版本失败:', error);
      message.error('加载历史版本失败');
    } finally {
      setLoading(false);
    }
  };

  // 递归查询所有相关版本
  const findAllVersions = async (
    currentId: string,
    versions: HistoryVersion[],
    visited: Set<string>
  ) => {
    if (visited.has(currentId)) {
      return; // 已访问过，避免循环
    }
    visited.add(currentId);

    // 1. 查询当前记录（annotations 表）
    const { data: annotation, error: annotationError } = await supabase
      .from('annotations')
      .select('*')
      .eq('id', currentId)
      .single();

    if (annotationError) {
      console.warn(`⚠️ 未找到 annotation 记录: ${currentId}`, annotationError);
    }

    if (annotation) {
      versions.push({
        id: annotation.id,
        videoId: annotation.video_id,
        sentenceNo: annotation.sentence_no,
        originalText: annotation.original_text || '',
        humanAnnotatedText: annotation.human_annotated_text || '',
        majorCategory: annotation.major_category || '',
        minorCategory: annotation.minor_category || '',
        remark: annotation.remark || '',
        annotator: annotation.annotator || '',
        isQualified: annotation.is_qualified,
        inspector: annotation.inspector || '',
        rejectionCount: annotation.rejection_count || 0,
        createdAt: annotation.created_at,
        updatedAt: annotation.updated_at
      });
    }

    // 2. 查询 rejected_annotations 表，看这条记录是否被打回过
    const { data: rejectedData } = await supabase
      .from('rejected_annotations')
      .select('*')
      .eq('annotation_id', currentId);

    if (rejectedData && rejectedData.length > 0) {
      for (const rejected of rejectedData) {
        // 添加打回信息到当前版本
        const version = versions.find(v => v.id === currentId);
        if (version) {
          version.rejectedAt = rejected.rejected_at;
          version.isResubmitted = rejected.is_resubmitted;
          version.newAnnotationId = rejected.new_annotation_id;
          version.resubmittedAt = rejected.resubmitted_at;
        }

        // 如果有新记录，递归查询
        if (rejected.new_annotation_id) {
          await findAllVersions(rejected.new_annotation_id, versions, visited);
        }
      }
    }

    // 3. 反向查询：看是否有其他记录指向当前记录（当前记录是某个被打回记录的新版本）
    const { data: previousRejections } = await supabase
      .from('rejected_annotations')
      .select('*')
      .eq('new_annotation_id', currentId);

    if (previousRejections && previousRejections.length > 0) {
      for (const prev of previousRejections) {
        await findAllVersions(prev.annotation_id, versions, visited);
      }
    }
  };

  const getStatusTag = (version: HistoryVersion) => {
    if (version.isQualified === null || version.isQualified === undefined) {
      return <Tag color="blue">待质检</Tag>;
    }
    if (version.isQualified === true) {
      return <Tag color="green" icon={<CheckCircleOutlined />}>质检通过</Tag>;
    }
    if (version.isResubmitted) {
      return <Tag color="orange">已重新提交</Tag>;
    }
    return <Tag color="red" icon={<CloseCircleOutlined />}>被打回</Tag>;
  };

  const formatTime = (time?: string) => {
    if (!time) return '-';
    const date = new Date(time);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderVersionDetails = (version: HistoryVersion, index: number) => {
    const isLatest = index === 0;
    const isOriginal = index === historyVersions.length - 1;

    return (
      <div style={{ 
        padding: '16px', 
        background: isLatest ? '#f0f5ff' : '#fafafa',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ fontSize: '16px' }}>
            {isLatest && '🆕 '}
            {isOriginal && '📝 '}
            版本 {historyVersions.length - index}
          </strong>
          {getStatusTag(version)}
          {isLatest && <Tag color="cyan">当前版本</Tag>}
          {isOriginal && <Tag>原始版本</Tag>}
          <span style={{ color: '#999', fontSize: '12px', marginLeft: 'auto' }}>
            被打回 {version.rejectionCount} 次
          </span>
        </div>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="标注人">
            {version.annotator || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="原文">
            {version.originalText || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标注结果">
            {version.humanAnnotatedText || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="大类/小类">
            {version.majorCategory || '-'} / {version.minorCategory || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注">
            {version.remark || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="质检人">
            {version.inspector || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatTime(version.createdAt)}
          </Descriptions.Item>
          {version.rejectedAt && (
            <Descriptions.Item label="打回时间">
              <span style={{ color: '#ff4d4f' }}>
                {formatTime(version.rejectedAt)}
              </span>
            </Descriptions.Item>
          )}
          {version.resubmittedAt && (
            <Descriptions.Item label="重新提交时间">
              <span style={{ color: '#52c41a' }}>
                {formatTime(version.resubmittedAt)}
              </span>
            </Descriptions.Item>
          )}
        </Descriptions>

        {version.newAnnotationId && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
            <ClockCircleOutlined /> 此版本被打回后，生成了新版本：{version.newAnnotationId}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="📜 标注历史版本"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={800}
      style={{ top: 20 }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" tip="加载历史版本中..." />
        </div>
      ) : historyVersions.length === 0 ? (
        <Empty description="暂无历史版本" />
      ) : (
        <div>
          <div style={{ marginBottom: '16px', color: '#666' }}>
            <ClockCircleOutlined /> 共找到 <strong>{historyVersions.length}</strong> 个版本
            {historyVersions[0]?.rejectionCount > 0 && (
              <span style={{ marginLeft: '16px', color: '#ff4d4f' }}>
                此数据已被打回 <strong>{historyVersions[0].rejectionCount}</strong> 次
              </span>
            )}
          </div>

          <Timeline mode="left">
            {historyVersions.map((version, index) => {
              const isLatest = index === 0;
              const isOriginal = index === historyVersions.length - 1;
              
              return (
                <Timeline.Item
                  key={version.id}
                  color={
                    isLatest ? 'blue' :
                    version.isQualified === true ? 'green' :
                    version.isQualified === false ? 'red' :
                    'gray'
                  }
                  dot={
                    isLatest ? <ClockCircleOutlined style={{ fontSize: '16px' }} /> :
                    version.isQualified === true ? <CheckCircleOutlined style={{ fontSize: '16px' }} /> :
                    version.isQualified === false ? <CloseCircleOutlined style={{ fontSize: '16px' }} /> :
                    undefined
                  }
                >
                  {renderVersionDetails(version, index)}
                </Timeline.Item>
              );
            })}
          </Timeline>
        </div>
      )}
    </Modal>
  );
};

export default AnnotationHistoryModal;

