const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 歌曲列表数据
const songs = [];

// 创建下载目录
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

// 文件名安全处理
function sanitizeFileName(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
}

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
                    resolve();
                });
                writer.on('error', reject);
            });
        } else {
            console.log(`获取音乐链接失败: ${song.name}`);
        }
    } catch (error) {
        console.error(`下载音乐失败: ${song.name}`, error.message);
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
        } else {
            console.log(`获取歌词失败: ${song.name}`);
        }
    } catch (error) {
        console.error(`下载歌词失败: ${song.name}`, error.message);
    }
}

// 主函数
async function downloadAllSongs() {
    console.log(`开始下载 ${songs.length} 首歌曲和歌词...`);
    
    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        console.log(`\n进度: ${i + 1}/${songs.length}`);
        
        // 同时下载音乐和歌词
        await Promise.all([
            downloadMusic(song),
            downloadLyric(song)
        ]);
        
        // 添加延迟避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n所有下载任务完成！');
}

// 开始下载
downloadAllSongs().catch(console.error);
