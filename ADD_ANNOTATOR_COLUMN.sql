-- 为 videos 表添加 annotator 列
-- 从标注文件名中提取标注员姓名

-- 1. 添加 annotator 列
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS annotator TEXT;

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_videos_annotator ON videos(annotator);

-- 3. 从标注文件名中提取标注员信息并更新 videos 表
-- 假设文件名格式为：视频名称_标注员.json
UPDATE videos v
SET annotator = (
    SELECT 
        -- 从文件名中提取标注员名字（去掉 .json 后缀，取最后一个下划线后的部分）
        CASE 
            WHEN af.name LIKE '%_%' THEN
                SPLIT_PART(REPLACE(af.name, '.json', ''), '_', 
                    ARRAY_LENGTH(STRING_TO_ARRAY(REPLACE(af.name, '.json', ''), '_'), 1))
            ELSE 
                af.annotator  -- 如果文件名没有下划线，使用 annotator 字段
        END as extracted_annotator
    FROM annotation_files af
    WHERE af.video_id = v.id
    AND af.name IS NOT NULL
    ORDER BY af.created_at ASC
    LIMIT 1
)
WHERE v.annotator IS NULL;

-- 4. 验证更新结果
SELECT 
    COUNT(*) as total_videos,
    COUNT(annotator) as videos_with_annotator,
    COUNT(*) - COUNT(annotator) as videos_without_annotator
FROM videos;

-- 5. 显示一些示例数据（包含文件名）
SELECT 
    v.id,
    v.name as video_name,
    v.annotator,
    af.name as annotation_file_name,
    v.status,
    v.total_sentences,
    v.annotated_sentences
FROM videos v
LEFT JOIN annotation_files af ON af.video_id = v.id
ORDER BY v.created_at DESC
LIMIT 15;
