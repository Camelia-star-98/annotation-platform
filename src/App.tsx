import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import HomePage from './pages/HomePage';
import AnnotationPage from './pages/AnnotationPage';
import AnnotationTaskListPage from './pages/AnnotationTaskListPage';
import InspectionPage from './pages/InspectionPage';
import InspectionSelectPage from './pages/InspectionSelectPage';
import InspectionManagePage from './pages/InspectionManagePage';
import ReviewPage from './pages/ReviewPage';
import ReviewSelectPage from './pages/ReviewSelectPage';
import AnalysisPage from './pages/AnalysisPage';
import VideoManagePage from './pages/VideoManagePage';
import SupabaseTestPage from './pages/SupabaseTestPage';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/annotation" element={<AnnotationPage />} />
          <Route path="/annotation-tasks" element={<AnnotationTaskListPage />} />
          <Route path="/inspection" element={<InspectionPage />} />
          <Route path="/inspection-select" element={<InspectionSelectPage />} />
          <Route path="/inspection-manage" element={<InspectionManagePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/review-select" element={<ReviewSelectPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/video-manage" element={<VideoManagePage />} />
          <Route path="/test-supabase" element={<SupabaseTestPage />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;

