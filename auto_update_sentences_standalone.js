#!/usr/bin/env node

/**
 * 完整的自动化脚本：添加字段并更新 videos.total_sentences
 * 包括 DDL 操作和数据更新
 */

const https = require('https');

const SUPABASE_URL = 'https://dcqwxvekgxgjujurpipg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcXd4dmVrZ3hnanVqdXJwaXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwODYzODAsImV4cCI6MjA3ODY2MjM4MH0.AW8O6XG3Zj75B1eqfpCNNLACfdKYhcQhYYWzVPuTPAw';

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    const symbols = {
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: '📊'
    };
    const prefix = symbols[type] || '📊';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

function httpRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const response = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(response.message || `HTTP ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function checkTableStructure() {
    try {
        log('检查 videos 表结构...', 'info');
        
        const data = await httpRequest('GET', '/rest/v1/videos?limit=1&select=*');
        
        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            const hasColumn = columns.includes('total_sentences');
            
            if (hasColumn) {
                log('total_sentences 字段已存在！', 'success');
                return true;
            } else {
                log('total_sentences 字段不存在', 'warning');
                return false;
            }
        }
        
        return false;
    } catch (error) {
        log(`检查失败: ${error.message}`, 'error');
        return false;
    }
}

async function executeSQL() {
    try {
        log('尝试执行 SQL 添加字段...', 'info');
        
        // 尝试通过 PostgREST 的 rpc 功能
        const sql = 'ALTER TABLE videos ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0';
        
        try {
            await httpRequest('POST', '/rest/v1/rpc/exec', { query: sql });
            log('字段添加成功！', 'success');
            return true;
        } catch (e) {
            log('无法通过 API 执行 DDL 语句', 'warning');
            log('请手动在 Supabase SQL Editor 中执行:', 'warning');
            console.log('\n' + '='.repeat(80));
            console.log('ALTER TABLE videos ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0;');
            console.log('='.repeat(80) + '\n');
            log('SQL Editor 链接: https://supabase.com/dashboard/project/dcqwxvekgxgjujurpipg/sql', 'info');
            return false;
        }
    } catch (error) {
        log(`执行 SQL 失败: ${error.message}`, 'error');
        return false;
    }
}

async function updateData() {
    try {
        log('获取所有视频...', 'info');
        
        const videos = await httpRequest('GET', '/rest/v1/videos?select=id,name,total_sentences');
        
        log(`获取到 ${videos.length} 个视频`, 'success');
        
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            
            // 查询该视频的所有句子编号
            const annotations = await httpRequest('GET', 
                `/rest/v1/annotations?video_id=eq.${video.id}&select=sentence_no`);
            
            // 去重计算总句数
            const uniqueSentences = new Set(annotations.map(a => a.sentence_no));
            const totalSentences = uniqueSentences.size;
            
            // 如果已经有值且相同，则跳过
            if (video.total_sentences === totalSentences) {
                skippedCount++;
                process.stdout.write(`\r⏭️  [${i + 1}/${videos.length}] 处理中... (跳过: ${skippedCount})`);
                continue;
            }
            
            // 更新
            try {
                await httpRequest('PATCH', 
                    `/rest/v1/videos?id=eq.${video.id}`, 
                    { total_sentences: totalSentences });
                
                updatedCount++;
                console.log(); // 换行
                log(`[${i + 1}/${videos.length}] ${video.name}: ${video.total_sentences || 0} → ${totalSentences}`, 'success');
            } catch (updateError) {
                console.log(); // 换行
                log(`[${i + 1}/${videos.length}] 更新 ${video.name} 失败`, 'error');
                errorCount++;
            }
        }
        
        console.log('\n');
        log('='.repeat(60), 'info');
        log(`更新统计: 成功 ${updatedCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个`, 'success');
        log('='.repeat(60), 'info');
        
    } catch (error) {
        log(`更新失败: ${error.message}`, 'error');
        throw error;
    }
}

async function verifyResults() {
    try {
        log('\n验证最近的视频...', 'info');
        
        const videos = await httpRequest('GET', 
            '/rest/v1/videos?select=id,name,total_sentences,created_at&order=created_at.desc&limit=10');
        
        log(`查询到最近 ${videos.length} 个视频`, 'success');
        console.log('\n验证结果:');
        console.log('='.repeat(80));
        console.log(
            '视频名称'.padEnd(40, ' ') + 
            'total_sentences'.padEnd(20, ' ') + 
            '实际句数'.padEnd(10, ' ') + 
            '状态'
        );
        console.log('-'.repeat(80));
        
        let matchCount = 0;
        let mismatchCount = 0;
        
        for (const video of videos) {
            const annotations = await httpRequest('GET', 
                `/rest/v1/annotations?video_id=eq.${video.id}&select=sentence_no`);
            
            const actualCount = new Set(annotations.map(a => a.sentence_no)).size;
            const isMatch = video.total_sentences === actualCount;
            const statusText = isMatch ? '✅ 正确' : '❌ 不匹配';
            
            if (isMatch) matchCount++;
            else mismatchCount++;
            
            const name = video.name.length > 38 ? video.name.substring(0, 35) + '...' : video.name;
            console.log(
                name.padEnd(40, ' ') + 
                String(video.total_sentences || 0).padEnd(20, ' ') + 
                String(actualCount).padEnd(10, ' ') + 
                statusText
            );
        }
        
        console.log('='.repeat(80));
        
        if (mismatchCount === 0) {
            log(`验证完成：所有 ${matchCount} 个视频数据都正确！`, 'success');
        } else {
            log(`验证完成：${matchCount} 个正确，${mismatchCount} 个不匹配`, 'warning');
        }
        
    } catch (error) {
        log(`验证失败: ${error.message}`, 'error');
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    log('🚀 开始自动更新 videos.total_sentences 字段', 'info');
    console.log('='.repeat(60) + '\n');
    
    try {
        // 步骤1：检查表结构
        log('========== 步骤1：检查表结构 ==========', 'info');
        let hasColumn = await checkTableStructure();
        
        if (!hasColumn) {
            // 步骤1.5：尝试添加字段
            log('\n========== 步骤1.5：添加字段 ==========', 'info');
            const added = await executeSQL();
            
            if (added) {
                // 重新检查
                hasColumn = await checkTableStructure();
            }
            
            if (!hasColumn) {
                log('\n请手动添加字段后，重新运行此脚本', 'error');
                log('运行命令: node auto_update_sentences.js', 'info');
                process.exit(1);
            }
        }
        
        // 步骤2：更新数据
        log('\n========== 步骤2：更新数据 ==========', 'info');
        await updateData();
        
        // 步骤3：验证结果
        log('\n========== 步骤3：验证结果 ==========', 'info');
        await verifyResults();
        
        console.log('\n' + '='.repeat(60));
        log('🎉 所有操作完成！', 'success');
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        log(`执行失败: ${error.message}`, 'error');
        console.error(error);
        process.exit(1);
    }
}

// 运行主函数
main();

