-- ========================================
-- 检查"被打回数据"页面显示的视频
-- ========================================

-- 从截图中可以看到的视频文件名，我们来查询对应的 video_id 和 annotator 信息

-- 查询1：找出所有 status='rejected' 的记录，按视频分组
SELECT 
    '被打回数据_按视频统计' as report_section,
    video_id,
    COUNT(*) as rejected_count,
    COUNT(DISTINCT sentence_no) as sentence_count,
    STRING_AGG(DISTINCT COALESCE(annotator, 'NULL'), ' | ' ORDER BY COALESCE(annotator, 'NULL')) as annotator_list,
    MIN(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as first_created,
    MAX(TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS')) as last_updated
FROM annotations
WHERE status = 'rejected'
GROUP BY video_id
ORDER BY last_updated DESC;

-- 查询2：检查郭其其的那个11条记录（1030-语文-2.mp4）
-- 从之前的信息知道郭其其的 video_id 可能是 'upload_1765171740803'
SELECT 
    '郭其其_被打回记录' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_time
FROM annotations
WHERE video_id = 'upload_1765171740803'
  AND status = 'rejected'
ORDER BY sentence_no;

-- 查询3：检查所有 rejected 状态但 annotator 为空的记录（前20条样例）
SELECT 
    '被打回但annotator为空_样例' as report_section,
    id,
    video_id,
    sentence_no,
    annotator,
    status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_time
FROM annotations
WHERE status = 'rejected'
  AND (annotator IS NULL OR annotator = '')
ORDER BY updated_at DESC
LIMIT 20;

-- 查询4：检查 videos 表，看看能否通过文件名找到对应的 video_id
SELECT 
    '被打回视频_从videos表查询' as report_section,
    id as video_id,
    filename,
    title,
    subject,
    total_sentences,
    publish_status,
    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time
FROM videos
WHERE filename IN (
    '语文01.mp4',
    '第5批第一轮-语文-1.mp4',
    '1030-语文-2.mp4',
    '第5批第一轮-物理-01.mp4',
    '第5批第一轮-英语-1.mp4'
)
OR title LIKE '%第七批第一次改写_语文-01%'
OR title LIKE '%第5轮第二批-语文-1%'
OR title LIKE '%第二批第二次改写_语文-02%'
OR title LIKE '%第5轮第二批-物理-1%'
OR title LIKE '%第5轮第二批-英语-1%'
ORDER BY created_at DESC;

