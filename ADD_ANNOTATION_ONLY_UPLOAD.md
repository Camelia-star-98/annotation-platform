# 添加"只上传标注数据"功能

## 功能需求

1. 在视频和数据管理页面添加"只上传标注数据"按钮
2. 允许用户只上传 Excel 标注表格，不需要视频文件
3. 标注页面支持无视频模式（不显示视频播放器）

---

## 实现步骤

### 步骤1：修改 VideoManagePage.tsx

#### 1.1 添加新的状态变量

在文件开头的 `useState` 部分添加：

```typescript
const [annotationOnlyModalVisible, setAnnotationOnlyModalVisible] = useState(false);
const [annotationOnlyExcelFile, setAnnotationOnlyExcelFile] = useState<any>(null);
const [annotationOnlyVideoName, setAnnotationOnlyVideoName] = useState('');
const [annotationOnlySubject, setAnnotationOnlySubject] = useState('');
const [annotationOnlyRequiredAnnotators, setAnnotationOnlyRequiredAnnotators] = useState(1);
```

#### 1.2 添加"只上传标注数据"按钮

在第1019行后面添加（在"上传视频和数据"按钮后面）：

```typescript
<Button
  type="default"
  icon={<FileExcelOutlined />}
  onClick={() => setAnnotationOnlyModalVisible(true)}
>
  只上传标注数据
</Button>
```

#### 1.3 创建只上传标注数据的处理函数

在 `handleUpload` 函数后面添加：

```typescript
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
    
    // 1. 解析 Excel 文件
    setUploadProgress(20);
    message.info('正在解析标注数据...');
    
    const excelData = await annotationOnlyExcelFile.arrayBuffer();
    const workbook = XLSX.read(excelData, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      message.error('Excel文件中没有数据');
      setIsUploading(false);
      return;
    }

    setUploadProgress(40);

    // 2. 生成视频ID（虽然没有视频，但需要ID来关联标注数据）
    const videoId = `annotation_only_${Date.now()}`;
    
    // 3. 创建虚拟视频记录（没有URL）
    const video = {
      id: videoId,
      name: annotationOnlyVideoName,
      url: '', // 空URL表示没有视频
      subject: annotationOnlySubject || '未知',
      duration: 0,
      required_annotators: annotationOnlyRequiredAnnotators
    };

    console.log('💾 创建虚拟视频记录:', video);
    const addedVideo = await addVideo(video);
    
    if (!addedVideo) {
      throw new Error('创建数据集记录失败');
    }

    setUploadProgress(60);

    // 4. 转换并保存标注数据
    const annotations = jsonData.map((row: any, index: number) => {
      return {
        id: `${videoId}_${index + 1}`,
        videoId: videoId,
        sentenceNo: row['句子编号'] || index + 1,
        timeRange: row['时间范围'] || '-',
        startTime: 0,
        endTime: 0,
        originalText: row['原文文本'] || '',
        aiRewrittenText: row['大模型改写文本'] || '',
        humanAnnotatedText: row['人工标注文本'] || '',
        majorCategory: row['问题大类'] || '',
        minorCategory: row['问题小类'] || '',
        remark: row['备注'] || '',
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
    loadVideos();

  } catch (error: any) {
    console.error('❌ 上传标注数据失败:', error);
    message.error(`上传失败：${error.message}`);
  } finally {
    setIsUploading(false);
    setUploadProgress(0);
  }
};
```

#### 1.4 添加"只上传标注数据"弹窗

在现有的上传弹窗后面添加：

```typescript
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
      >
        <Button icon={<FileExcelOutlined />}>
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
```

---

### 步骤2：修改 database.ts 支持空URL

在 `src/api/database.ts` 中修改 `addVideo` 函数：

```typescript
// 上传视频文件到Supabase Storage
export async function addVideo(video: VideoInfo): Promise<VideoInfo | null> {
  console.log('🔵 addVideo 被调用');
  console.log('📦 接收到的参数:', video);
  
  // 明确指定要插入的字段
  const insertData = {
    id: video.id,
    name: video.name,
    url: video.url || '', // 允许空URL
    subject: video.subject,
    duration: video.duration || 0,
    required_annotators: video.required_annotators || 1
  };
  
  console.log('📤 准备插入数据库的数据:', insertData);
  
  const { data, error } = await supabase
    .from('videos')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('❌ 添加视频失败:', error);
    return null;
  }

  console.log('✅ 添加视频成功');
  return data;
}
```

---

### 步骤3：修改 AnnotationPage.tsx 支持无视频模式

在 `src/pages/AnnotationPage.tsx` 中：

#### 3.1 修改视频显示逻辑

找到视频播放器部分，添加条件判断：

```typescript
{/* 视频区域 - 仅当有视频URL时显示 */}
{displayVideo && displayVideo.url ? (
  <div className="video-container" style={{ flex: 1, minHeight: '400px' }}>
    <ReactPlayer
      url={displayVideo.url}
      controls
      width="100%"
      height="100%"
      onError={(e) => {
        console.error('视频加载失败:', e);
        message.error('视频加载失败，请检查视频URL是否有效');
      }}
    />
  </div>
) : (
  <div className="no-video-placeholder" style={{ 
    flex: 1, 
    minHeight: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    border: '2px dashed #d9d9d9',
    borderRadius: '8px'
  }}>
    <div style={{ textAlign: 'center', color: '#999' }}>
      <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
      <div style={{ fontSize: 16 }}>此数据集没有关联视频</div>
      <div style={{ fontSize: 14, marginTop: 8 }}>仅包含标注数据</div>
    </div>
  </div>
)}
```

#### 3.2 修改时间范围点击逻辑

```typescript
const handleTimeClick = (startTime: number, videoUrl: string) => {
  if (!videoUrl) {
    message.info('此数据集没有关联视频');
    return;
  }
  // 原有的跳转逻辑...
};
```

---

### 步骤4：添加必要的导入

确保在 `VideoManagePage.tsx` 顶部有以下导入：

```typescript
import { FileExcelOutlined } from '@ant-design/icons';
import { Alert, InputNumber } from 'antd';
import * as XLSX from 'xlsx';
```

---

## 使用流程

1. 用户进入"视频和数据管理"页面
2. 点击"只上传标注数据"按钮
3. 填写数据集名称、科目、待标注数量
4. 上传 Excel 标注数据文件
5. 点击"上传"
6. 系统创建虚拟视频记录（URL为空）
7. 保存标注数据
8. 在标注任务列表中，该数据集不显示视频播放器

---

## 注意事项

1. Excel 文件格式要求与现有格式一致
2. 虚拟视频记录的 `url` 字段为空字符串
3. 标注页面会根据 `url` 是否为空来决定是否显示视频播放器
4. 数据集名称会加上 `annotation_only_` 前缀以便区分

---

## 测试清单

- [ ] 能成功上传只有标注数据的Excel文件
- [ ] 创建的记录在列表中正常显示
- [ ] 进入标注页面不显示视频播放器
- [ ] 标注功能正常工作（文本编辑、分类选择等）
- [ ] 提交标注后数据正常保存
- [ ] 质检和复检流程正常


