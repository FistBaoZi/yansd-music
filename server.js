#!/usr/bin/env node
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 支持打包后的路径
const publicPath = path.join(__dirname, 'public');
const distPublicPath = path.join(process.cwd(), 'public');

if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log('使用开发环境静态文件路径:', publicPath);
} else if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
    console.log('使用打包环境静态文件路径:', distPublicPath);
} else {
    console.log('未找到静态文件目录，请确保public文件夹存在');
}

// 创建下载目录
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

// 文件名安全处理
function sanitizeFileName(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
}

// 搜索音乐API
app.get('/api/search', async (req, res) => {
    try {
        const { name, source = 'netease', count = 20, pages = 1 } = req.query;
        
        if (!name) {
            return res.status(400).json({ error: '请提供搜索关键字' });
        }
        
        const url = `https://music-api.gdstudio.xyz/api.php?types=search&source=${source}&name=${encodeURIComponent(name)}&count=${count}&pages=${pages}`;
        const response = await axios.get(url);
        
        res.json(response.data);
    } catch (error) {
        console.error('搜索失败:', error.message);
        res.status(500).json({ error: '搜索失败: ' + error.message });
    }
});

// 下载音乐文件
async function downloadMusic(song) {
    try {
        const url = `https://music-api.gdstudio.xyz/api.php?types=url&source=${song.source}&id=${song.url_id}&br=320`;
        const response = await axios.get(url);
        
        if (response.data && response.data.url) {
            const musicUrl = response.data.url;
            const artistName = song.artist.join(', ');
            const fileName = sanitizeFileName(`${artistName} - ${song.name}.mp3`);
            const filePath = path.join(downloadDir, fileName);
            
            console.log(`正在下载音乐: ${song.name} - ${artistName}`);
            
            const musicResponse = await axios.get(musicUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(filePath);
            
            musicResponse.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`音乐下载完成: ${fileName}`);
                    resolve({ success: true, fileName });
                });
                writer.on('error', (error) => {
                    console.error(`下载失败: ${fileName}`, error);
                    reject(error);
                });
            });
        } else {
            throw new Error('获取音乐链接失败');
        }
    } catch (error) {
        console.error(`下载音乐失败: ${song.name}`, error.message);
        throw error;
    }
}

// 下载歌词文件
async function downloadLyric(song) {
    try {
        const url = `https://music-api.gdstudio.xyz/api.php?types=lyric&source=${song.source}&id=${song.lyric_id}`;
        const response = await axios.get(url);
        
        if (response.data && response.data.lyric) {
            const artistName = song.artist.join(', ');
            const fileName = sanitizeFileName(`${artistName} - ${song.name}.lrc`);
            const filePath = path.join(downloadDir, fileName);
            
            console.log(`正在下载歌词: ${song.name} - ${artistName}`);
            
            fs.writeFileSync(filePath, response.data.lyric, 'utf8');
            console.log(`歌词下载完成: ${fileName}`);
            return { success: true, fileName };
        } else {
            throw new Error('获取歌词失败');
        }
    } catch (error) {
        console.error(`下载歌词失败: ${song.name}`, error.message);
        throw error;
    }
}

// 批量下载API
app.post('/api/download', async (req, res) => {
    try {
        const { songs } = req.body;
        
        if (!songs || !Array.isArray(songs) || songs.length === 0) {
            return res.status(400).json({ error: '请提供要下载的歌曲列表' });
        }
        
        console.log(`开始下载 ${songs.length} 首歌曲和歌词...`);
        
        const results = [];
        
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            console.log(`\n进度: ${i + 1}/${songs.length}`);
            
            const result = {
                song: song.name,
                artist: song.artist.join(', '),
                music: { success: false },
                lyric: { success: false }
            };
            
            try {
                // 同时下载音乐和歌词
                const [musicResult, lyricResult] = await Promise.allSettled([
                    downloadMusic(song),
                    downloadLyric(song)
                ]);
                
                if (musicResult.status === 'fulfilled') {
                    result.music = musicResult.value;
                } else {
                    result.music = { success: false, error: musicResult.reason.message };
                }
                
                if (lyricResult.status === 'fulfilled') {
                    result.lyric = lyricResult.value;
                } else {
                    result.lyric = { success: false, error: lyricResult.reason.message };
                }
                
            } catch (error) {
                result.error = error.message;
            }
            
            results.push(result);
            
            // 添加延迟避免请求过于频繁
            if (i < songs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('\n所有下载任务完成！');
        res.json({ success: true, results });
        
    } catch (error) {
        console.error('批量下载失败:', error);
        res.status(500).json({ error: '批量下载失败: ' + error.message });
    }
});

// 获取下载列表
app.get('/api/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(downloadDir);
        const downloadedFiles = files.map(file => ({
            name: file,
            path: path.join(downloadDir, file),
            size: fs.statSync(path.join(downloadDir, file)).size
        }));
        res.json(downloadedFiles);
    } catch (error) {
        res.status(500).json({ error: '获取下载列表失败: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`音乐下载服务器运行在 http://localhost:${PORT}`);
});
