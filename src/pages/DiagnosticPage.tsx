import { useState } from 'react';
import { Button, Card, Typography, Space, Table, Tag, Spin, Alert } from 'antd';
import { PlayCircleOutlined, BugOutlined } from '@ant-design/icons';
import { supabase } from '../api/supabase';

const { Title, Text } = Typography;

interface DiagnosticResult {
  batch5Videos: any[];
  chineseVideos: any[];
  batch5Chinese: any[];
  pendingAnnotations: any[];
  completedAnnotations: any[];
  problems: string[];
}

export default function DiagnosticPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      console.log('🔍 开始运行诊断...');

      // 1. 查询所有第5批视频
      console.log('📊 步骤 1: 查询第5批视频...');
      const { data: batch5Videos, error: batch5Error } = await supabase
        .from('videos')
        .select('*')
        .ilike('name', '%第5批%')
        .order('name');

      if (batch5Error) throw batch5Error;
      console.log('✅ 找到第5批视频:', batch5Videos.length);

      // 2. 查询所有语文视频
      console.log('📚 步骤 2: 查询所有语文视频...');
      const { data: chineseVideos, error: chineseError } = await supabase
        .from('videos')
        .select('*')
        .or('name.ilike.%语文%,subject.ilike.%语文%')
        .order('created_at', { ascending: false });

      if (chineseError) throw chineseError;
      console.log('✅ 找到语文视频:', chineseVideos.length);

      // 3. 找出第5批语文视频
      const batch5Chinese = chineseVideos.filter(v => 
        v.name.includes('第5批') && 
        (v.name.includes('语文') || v.subject?.includes('语文'))
      );
      console.log('✅ 第5批语文视频:', batch5Chinese.length);

      // 4. 对每个第5批语文视频，查询其标注数据
      const problems: string[] = [];
      const videoDetails = [];

      for (const video of batch5Chinese) {
        const { data: annotations, error: annError } = await supabase
          .from('annotations')
          .select('video_id, annotator, human_annotated_text, review_status, reviewer')
          .eq('video_id', video.id);

        if (annError) {
          console.error('查询标注数据失败:', annError);
          continue;
        }

        // 统计
        const total = annotations.length;
        const hasText = annotations.filter(a => 
          a.human_annotated_text && a.human_annotated_text.trim() !== ''
        ).length;
        const reviewed = annotations.filter(a => a.review_status === true).length;
        const pending = annotations.filter(a => !a.review_status).length;
        const annotators = [...new Set(annotations.map(a => a.annotator).filter(a => a))];

        videoDetails.push({
          ...video,
          annotationStats: {
            total,
            hasText,
            reviewed,
            pending,
            annotators
          }
        });

        // 检查问题
        if (video.is_completed && pending > 0) {
          problems.push(
            `视频 "${video.name}" 标记为已完成(is_completed=true)，但仍有 ${pending} 条待复检数据`
          );
        }

        if (!video.is_completed && pending === 0 && hasText > 0) {
          problems.push(
            `视频 "${video.name}" 未标记为已完成(is_completed=false)，但所有数据(${hasText}条)都已复检`
          );
        }
      }

      console.log('🎯 诊断完成，发现问题:', problems.length);

      setResult({
        batch5Videos,
        chineseVideos: videoDetails,
        batch5Chinese: videoDetails,
        pendingAnnotations: [],
        completedAnnotations: [],
        problems
      });

    } catch (error: any) {
      console.error('❌ 诊断失败:', error);
      alert('诊断失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '视频名称',
      dataIndex: 'name',
      key: 'name',
      width: 300,
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
    },
    {
      title: 'is_completed',
      dataIndex: 'is_completed',
      key: 'is_completed',
      width: 120,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'orange'}>
          {val ? '✅ true' : '❌ false'}
        </Tag>
      ),
    },
    {
      title: '标注总数',
      key: 'total',
      width: 100,
      render: (_: any, record: any) => record.annotationStats?.total || 0,
    },
    {
      title: '有内容',
      key: 'hasText',
      width: 100,
      render: (_: any, record: any) => record.annotationStats?.hasText || 0,
    },
    {
      title: '已复检',
      key: 'reviewed',
      width: 100,
      render: (_: any, record: any) => (
        <Tag color="green">{record.annotationStats?.reviewed || 0}</Tag>
      ),
    },
    {
      title: '待复检',
      key: 'pending',
      width: 100,
      render: (_: any, record: any) => {
        const pending = record.annotationStats?.pending || 0;
        return (
          <Tag color={pending > 0 ? 'red' : 'default'}>{pending}</Tag>
        );
      },
    },
    {
      title: '标注人',
      key: 'annotators',
      render: (_: any, record: any) => 
        record.annotationStats?.annotators?.join(', ') || '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2}>
              <BugOutlined /> 语文视频诊断工具
            </Title>
            <Text type="secondary">
              诊断第5批语文视频为什么没有出现在待复检列表中
            </Text>
          </div>

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={runDiagnostics}
            loading={loading}
            size="large"
          >
            运行诊断
          </Button>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text>正在分析数据...</Text>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              {/* 问题总结 */}
              {result.problems.length > 0 && (
                <Alert
                  message="发现问题"
                  description={
                    <ul>
                      {result.problems.map((problem, index) => (
                        <li key={index}>{problem}</li>
                      ))}
                    </ul>
                  }
                  type="error"
                  showIcon
                />
              )}

              {result.problems.length === 0 && (
                <Alert
                  message="未发现问题"
                  description="第5批语文视频的 is_completed 状态与标注数据一致"
                  type="success"
                  showIcon
                />
              )}

              {/* 详细数据表格 */}
              <div>
                <Title level={4}>第5批语文视频详情</Title>
                <Table
                  columns={columns}
                  dataSource={result.batch5Chinese}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 1200 }}
                />
              </div>

              {/* SQL修复语句 */}
              {result.problems.length > 0 && (
                <div>
                  <Title level={4}>SQL 修复语句</Title>
                  <Alert
                    message="如果需要修复，请复制以下 SQL 到 Supabase SQL Editor 执行"
                    type="info"
                  />
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: 16,
                    borderRadius: 4,
                    overflow: 'auto',
                    marginTop: 16
                  }}>
                    {result.batch5Chinese
                      .filter(v => v.is_completed && v.annotationStats.pending > 0)
                      .map(v => 
                        `UPDATE videos SET is_completed = false WHERE id = '${v.id}'; -- ${v.name}`
                      )
                      .join('\n')}
                  </pre>
                </div>
              )}

              {/* 统计信息 */}
              <Card title="统计信息" size="small">
                <Space direction="vertical">
                  <Text>第5批视频总数: {result.batch5Videos.length}</Text>
                  <Text>第5批语文视频: {result.batch5Chinese.length}</Text>
                  <Text>
                    is_completed=true 的第5批语文视频: {' '}
                    {result.batch5Chinese.filter(v => v.is_completed).length}
                  </Text>
                  <Text>
                    is_completed=false 的第5批语文视频: {' '}
                    {result.batch5Chinese.filter(v => !v.is_completed).length}
                  </Text>
                  <Text strong type="danger">
                    有问题的视频: {result.problems.length}
                  </Text>
                </Space>
              </Card>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}

