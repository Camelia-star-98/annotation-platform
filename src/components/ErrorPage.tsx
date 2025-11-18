import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface ErrorPageProps {
  status?: 403 | 404 | 500;
  title?: string;
  subTitle?: string;
}

export default function ErrorPage({
  status = 404,
  title,
  subTitle
}: ErrorPageProps) {
  const navigate = useNavigate();

  const defaultTitles = {
    403: '抱歉，您无权访问此页面',
    404: '抱歉，您访问的页面不存在',
    500: '抱歉，服务器出错了'
  };

  return (
    <div style={{ padding: '100px 20px', background: '#fff' }}>
      <Result
        status={status}
        title={title || defaultTitles[status]}
        subTitle={subTitle || '请检查您输入的网址是否正确'}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  );
}

