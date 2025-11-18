import React, { useEffect, useState } from 'react';
import { Button, Card, Space, Alert } from 'antd';
import { testSupabaseConnection, getTableSchema } from '../api/test-supabase';

export default function SupabaseTestPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    const result = await testSupabaseConnection();
    setTestResult(result);
    setLoading(false);

    // 同时获取表结构
    await getTableSchema();
  };

  useEffect(() => {
    // 自动运行测试
    runTest();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <Card title="Supabase连接测试">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="请打开浏览器控制台（F12）查看详细日志"
            type="info"
          />

          <Button type="primary" onClick={runTest} loading={loading}>
            重新测试
          </Button>

          {testResult && (
            <Alert
              message={testResult.success ? '测试成功！' : '测试失败'}
              description={
                <div>
                  {testResult.error && <div>错误: {testResult.error}</div>}
                  {testResult.details && (
                    <pre style={{ marginTop: 10, fontSize: 12 }}>
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              }
              type={testResult.success ? 'success' : 'error'}
            />
          )}

          <div style={{ marginTop: 20 }}>
            <h3>环境变量检查：</h3>
            <pre>
              VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || '未配置'}
              <br />
              VITE_SUPABASE_ANON_KEY:{' '}
              {import.meta.env.VITE_SUPABASE_ANON_KEY
                ? '已配置 (' + import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...)'
                : '未配置'}
            </pre>
          </div>
        </Space>
      </Card>
    </div>
  );
}

