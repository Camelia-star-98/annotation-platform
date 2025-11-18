import { Spin } from 'antd';
import './Loading.css';

interface LoadingProps {
  tip?: string;
  fullScreen?: boolean;
}

export default function Loading({ tip = '加载中...', fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <Spin size="large" tip={tip} />
      </div>
    );
  }

  return (
    <div className="loading-container">
      <Spin size="large" tip={tip} />
    </div>
  );
}

