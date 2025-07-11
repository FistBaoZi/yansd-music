class MusicDownloader {
    constructor() {
        this.searchResultsData = [];
        this.selectedSongs = new Set();
        this.isDownloading = false;
        this.downloadHistory = [];
        
        this.initializeElements();
        this.bindEvents();
        this.loadDownloadedFiles();
        
        // 初始化音频播放器
        this.audioPlayer = new AudioPlayer(this);
    }
    
    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.sourceSelect = document.getElementById('sourceSelect');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResultsElement = document.getElementById('searchResults');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.resultsHeader = document.querySelector('.results-header');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
        this.selectedCount = document.getElementById('selectedCount');
        this.downloadSection = document.querySelector('.download-header');
        this.downloadStatus = document.getElementById('downloadStatus');
        this.downloadProgress = document.getElementById('downloadProgress');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.downloadedFiles = document.getElementById('downloadedFiles');
        this.refreshDownloadsBtn = document.getElementById('refreshDownloadsBtn');
        
        // 弹出框相关元素
        this.toggleDownloadsBtn = document.getElementById('toggleDownloadsBtn');
        this.downloadsPopup = document.getElementById('downloadsPopup');
        this.popupOverlay = document.getElementById('popupOverlay');
        this.closePopupBtn = document.getElementById('closePopupBtn');
    }
    
    bindEvents() {
        this.searchBtn.addEventListener('click', () => this.searchMusic());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchMusic();
        });
        
        this.selectAllBtn.addEventListener('click', () => this.selectAll());
        this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
        this.downloadSelectedBtn.addEventListener('click', () => this.downloadSelected());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.refreshDownloadsBtn.addEventListener('click', () => this.loadDownloadedFiles());
        
        // 弹出框事件
        this.toggleDownloadsBtn.addEventListener('click', () => this.showDownloadsPopup());
        this.closePopupBtn.addEventListener('click', () => this.hideDownloadsPopup());
        this.popupOverlay.addEventListener('click', () => this.hideDownloadsPopup());
    }
    
    async searchMusic() {
        const keyword = this.searchInput.value.trim();
        const source = this.sourceSelect.value;
        
        if (!keyword) {
            alert('请输入搜索关键字');
            return;
        }
        
        this.showLoading(true);
        this.resultsHeader.style.display = 'none';
        this.searchResultsElement.innerHTML = '';
        
        try {
            const response = await fetch(`/api/search?name=${encodeURIComponent(keyword)}&source=${source}&count=30`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || '搜索失败');
            }
            
            this.searchResultsElement.innerHTML = '';
            
            if (data && data.length > 0) {
                this.searchResultsData = data;
                this.renderSearchResults(data);
                this.resultsHeader.style.display = 'flex';
            } else {
                this.searchResultsElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">没有找到相关歌曲</div>';
            }
            
        } catch (error) {
            console.error('搜索失败:', error);
            this.searchResultsElement.innerHTML = `<div style="padding: 40px; text-align: center; color: #f44336;">搜索失败: ${error.message}</div>`;
        } finally {
            this.showLoading(false);
        }
    }
    
    renderSearchResults(songs) {
        this.selectedSongs.clear();
        this.updateSelectedCount();
        
        this.searchResultsElement.innerHTML = songs.map((song, index) => `
            <div class="song-item">
                <input type="checkbox" class="song-checkbox" data-index="${index}">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.name)}</div>
                    <div class="song-artist">歌手: ${this.escapeHtml(song.artist.join(', '))}</div>
                    <div class="song-album">专辑: ${this.escapeHtml(song.album || '未知专辑')}</div>
                </div>
                <div class="song-actions">
                    <button class="song-play-btn" data-index="${index}" title="播放">▶</button>
                    <button class="song-download-btn" data-index="${index}" title="下载">⬇</button>
                </div>
                <div class="song-source">${this.getSourceName(song.source)}</div>
            </div>
        `).join('');
        
        // 绑定复选框事件
        this.searchResultsElement.querySelectorAll('.song-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (e.target.checked) {
                    this.selectedSongs.add(index);
                } else {
                    this.selectedSongs.delete(index);
                }
                this.updateSelectedCount();
            });
        });
        
        // 绑定播放按钮事件
        this.searchResultsElement.querySelectorAll('.song-play-btn').forEach(playBtn => {
            playBtn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.audioPlayer.playSong(songs[index], index);
            });
        });
        
        // 绑定下载按钮事件
        this.searchResultsElement.querySelectorAll('.song-download-btn').forEach(downloadBtn => {
            downloadBtn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.downloadSingleSong(songs[index], index);
            });
        });
    }
    
    selectAll() {
        this.searchResultsElement.querySelectorAll('.song-checkbox').forEach((checkbox, index) => {
            checkbox.checked = true;
            this.selectedSongs.add(index);
        });
        this.updateSelectedCount();
    }
    
    deselectAll() {
        this.searchResultsElement.querySelectorAll('.song-checkbox').forEach((checkbox, index) => {
            checkbox.checked = false;
            this.selectedSongs.delete(index);
        });
        this.updateSelectedCount();
    }
    
    updateSelectedCount() {
        this.selectedCount.textContent = this.selectedSongs.size;
        this.downloadSelectedBtn.disabled = this.selectedSongs.size === 0 || this.isDownloading;
    }
    
    async downloadSingleSong(song, index) {
        const downloadBtn = document.querySelector(`.song-download-btn[data-index="${index}"]`);
        
        if (!downloadBtn) return;
        
        // 检查是否已在下载
        if (downloadBtn.classList.contains('downloading')) {
            return;
        }
        
        // 设置下载状态
        downloadBtn.classList.add('downloading');
        downloadBtn.innerHTML = '⏳';
        downloadBtn.title = '下载中...';
        downloadBtn.disabled = true;
        
        try {
            console.log(`开始下载单个歌曲: ${song.name} - ${song.artist.join(', ')}`);
            
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songs: [song] })
            });
            
            const data = await response.json();
            
            if (response.ok && data.results && data.results.length > 0) {
                const result = data.results[0];
                
                // 检查下载结果
                if (result.music.success || result.lyric.success) {
                    // 至少有一个成功
                    downloadBtn.classList.remove('downloading');
                    downloadBtn.classList.add('success');
                    downloadBtn.innerHTML = '✅';
                    downloadBtn.title = `下载完成 - 音乐:${result.music.success ? '成功' : '失败'} 歌词:${result.lyric.success ? '成功' : '失败'}`;
                    
                    // 显示成功消息
                    this.showDownloadNotification(`${song.name} 下载完成`, 'success');
                    
                    // 刷新已下载文件列表
                    this.loadDownloadedFiles();
                    
                } else {
                    // 都失败了
                    throw new Error('下载失败');
                }
                
                // 3秒后恢复按钮状态
                setTimeout(() => {
                    downloadBtn.classList.remove('success');
                    downloadBtn.innerHTML = '⬇';
                    downloadBtn.title = '下载';
                    downloadBtn.disabled = false;
                }, 3000);
                
            } else {
                throw new Error(data.error || '下载失败');
            }
            
        } catch (error) {
            console.error('单个歌曲下载失败:', error);
            
            // 设置错误状态
            downloadBtn.classList.remove('downloading');
            downloadBtn.classList.add('error');
            downloadBtn.innerHTML = '❌';
            downloadBtn.title = `下载失败: ${error.message}`;
            
            // 显示错误消息
            this.showDownloadNotification(`${song.name} 下载失败: ${error.message}`, 'error');
            
            // 3秒后恢复按钮状态
            setTimeout(() => {
                downloadBtn.classList.remove('error');
                downloadBtn.innerHTML = '⬇';
                downloadBtn.title = '下载';
                downloadBtn.disabled = false;
            }, 3000);
        }
    }
    
    showDownloadNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `download-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // 绑定关闭事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // 3秒后自动隐藏
        setTimeout(() => {
            this.hideNotification(notification);
        }, 3000);
    }
    
    hideNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    async downloadSelected() {
        if (this.selectedSongs.size === 0) {
            alert('请先选择要下载的歌曲');
            return;
        }
        
        if (this.isDownloading) {
            alert('正在下载中，请稍候');
            return;
        }
        
        const selectedSongData = Array.from(this.selectedSongs).map(index => this.searchResultsData[index]);
        
        this.isDownloading = true;
        this.downloadSelectedBtn.disabled = true;
        
        // 创建悬浮进度卡片
        this.createFloatingProgressCard(selectedSongData.length);
        
        try {
            // 分别下载每首歌曲并显示进度
            const results = [];
            for (let i = 0; i < selectedSongData.length; i++) {
                const song = selectedSongData[i];
                const currentIndex = i + 1;
                
                // 更新总体进度
                this.updateFloatingProgress(currentIndex, selectedSongData.length, song);
                
                // 添加当前下载项到列表
                this.addFloatingDownloadItem(song, currentIndex);
                
                try {
                    // 发送单个歌曲下载请求
                    const response = await fetch('/api/download', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ songs: [song] })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.results && data.results.length > 0) {
                        const result = data.results[0];
                        results.push(result);
                        this.updateFloatingDownloadItem(currentIndex, result, 'success');
                    } else {
                        const errorResult = {
                            song: song.name,
                            artist: song.artist.join(', '),
                            music: { success: false, error: '下载失败' },
                            lyric: { success: false, error: '下载失败' }
                        };
                        results.push(errorResult);
                        this.updateFloatingDownloadItem(currentIndex, errorResult, 'error');
                    }
                } catch (error) {
                    console.error(`下载歌曲失败: ${song.name}`, error);
                    const errorResult = {
                        song: song.name,
                        artist: song.artist.join(', '),
                        music: { success: false, error: error.message },
                        lyric: { success: false, error: error.message }
                    };
                    results.push(errorResult);
                    this.updateFloatingDownloadItem(currentIndex, errorResult, 'error');
                }
                
                // 添加延迟避免请求过于频繁
                if (i < selectedSongData.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            this.updateFloatingCurrentSong('所有下载任务完成！');
            this.loadDownloadedFiles(); // 刷新已下载文件列表
            
            // 5秒后自动隐藏悬浮卡片
            setTimeout(() => {
                this.hideFloatingProgressCard();
            }, 5000);
            
        } catch (error) {
            console.error('下载失败:', error);
            this.updateFloatingCurrentSong(`下载失败: ${error.message}`);
        } finally {
            this.isDownloading = false;
            this.downloadSelectedBtn.disabled = false;
        }
    }
    
    displayDownloadResults(results) {
        this.downloadHistory = [...results, ...this.downloadHistory];
        
        this.downloadStatus.innerHTML = results.map(result => `
            <div class="download-item">
                <div class="download-info">
                    <div class="download-name">${this.escapeHtml(result.song)} - ${this.escapeHtml(result.artist)}</div>
                    <div class="download-details">
                        音乐: ${result.music.success ? '✅ 成功' : '❌ 失败' + (result.music.error ? ` (${result.music.error})` : '')} | 
                        歌词: ${result.lyric.success ? '✅ 成功' : '❌ 失败' + (result.lyric.error ? ` (${result.lyric.error})` : '')}
                    </div>
                </div>
                <div class="download-result ${result.music.success && result.lyric.success ? 'success' : 'error'}">
                    ${result.music.success && result.lyric.success ? '完成' : '部分失败'}
                </div>
            </div>
        `).join('');
    }
    
    createProgressDisplay(totalCount) {
        this.downloadStatus.innerHTML = `
            <div class="progress-container">
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progressBar"></div>
                    <div class="progress-text" id="progressText">0 / ${totalCount}</div>
                </div>
                <div class="download-list" id="downloadList"></div>
            </div>
        `;
    }
    
    updateOverallProgress(current, total, currentSong) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
        
        this.downloadProgress.textContent = `正在下载: ${currentSong.name} - ${currentSong.artist.join(', ')} (${current}/${total})`;
    }
    
    addDownloadItem(song, index) {
        const downloadList = document.getElementById('downloadList');
        if (!downloadList) return;
        
        const itemHtml = `
            <div class="download-item" id="downloadItem${index}">
                <div class="download-info">
                    <div class="download-name">${this.escapeHtml(song.name)} - ${this.escapeHtml(song.artist.join(', '))}</div>
                    <div class="download-details">
                        <span class="status-music">音乐: ⏳ 下载中...</span> | 
                        <span class="status-lyric">歌词: ⏳ 下载中...</span>
                    </div>
                </div>
                <div class="download-result downloading">下载中...</div>
            </div>
        `;
        downloadList.insertAdjacentHTML('beforeend', itemHtml);
    }
    
    updateDownloadItem(index, result, status) {
        const item = document.getElementById(`downloadItem${index}`);
        if (!item) return;
        
        const musicStatus = item.querySelector('.status-music');
        const lyricStatus = item.querySelector('.status-lyric');
        const resultElement = item.querySelector('.download-result');
        
        if (musicStatus) {
            musicStatus.innerHTML = result.music.success ? 
                '音乐: ✅ 成功' : 
                `音乐: ❌ 失败${result.music.error ? ` (${result.music.error})` : ''}`;
        }
        
        if (lyricStatus) {
            lyricStatus.innerHTML = result.lyric.success ? 
                '歌词: ✅ 成功' : 
                `歌词: ❌ 失败${result.lyric.error ? ` (${result.lyric.error})` : ''}`;
        }
        
        if (resultElement) {
            resultElement.className = `download-result ${status}`;
            resultElement.textContent = result.music.success && result.lyric.success ? '完成' : '部分失败';
        }
    }
    
    // 悬浮卡片相关方法
    createFloatingProgressCard(totalCount) {
        // 移除现有的悬浮卡片
        const existingCard = document.getElementById('floatingProgressCard');
        if (existingCard) {
            existingCard.remove();
        }
        
        const cardHtml = `
            <div class="floating-progress-card" id="floatingProgressCard">
                <div class="floating-card-header">
                    <h3 class="floating-card-title">下载进度</h3>
                    <button class="floating-card-close" onclick="this.parentElement.parentElement.classList.remove('show')">×</button>
                </div>
                <div class="floating-card-body">
                    <div class="floating-progress-bar-container">
                        <div class="floating-progress-bar" id="floatingProgressBar"></div>
                        <div class="floating-progress-text" id="floatingProgressText">0 / ${totalCount}</div>
                    </div>
                    <div class="floating-current-song" id="floatingCurrentSong">准备下载 ${totalCount} 首歌曲...</div>
                    <div class="floating-download-list" id="floatingDownloadList"></div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', cardHtml);
        
        // 显示卡片动画
        setTimeout(() => {
            const card = document.getElementById('floatingProgressCard');
            if (card) {
                card.classList.add('show');
            }
        }, 100);
    }
    
    updateFloatingProgress(current, total, currentSong) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = document.getElementById('floatingProgressBar');
        const progressText = document.getElementById('floatingProgressText');
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${current} / ${total}`;
        }
        
        this.updateFloatingCurrentSong(`正在下载: ${currentSong.name} - ${currentSong.artist.join(', ')} (${current}/${total})`);
    }
    
    updateFloatingCurrentSong(text) {
        const currentSong = document.getElementById('floatingCurrentSong');
        if (currentSong) {
            currentSong.textContent = text;
        }
    }
    
    addFloatingDownloadItem(song, index) {
        const downloadList = document.getElementById('floatingDownloadList');
        if (!downloadList) return;
        
        const itemHtml = `
            <div class="floating-download-item" id="floatingDownloadItem${index}">
                <div class="floating-download-name">${this.escapeHtml(song.name)} - ${this.escapeHtml(song.artist.join(', '))}</div>
                <div class="floating-download-details">
                    <span class="floating-status-music">音乐: ⏳ 下载中...</span> | 
                    <span class="floating-status-lyric">歌词: ⏳ 下载中...</span>
                </div>
                <div class="floating-download-result downloading">下载中...</div>
            </div>
        `;
        downloadList.insertAdjacentHTML('beforeend', itemHtml);
        
        // 滚动到最新项
        downloadList.scrollTop = downloadList.scrollHeight;
    }
    
    updateFloatingDownloadItem(index, result, status) {
        const item = document.getElementById(`floatingDownloadItem${index}`);
        if (!item) return;
        
        const musicStatus = item.querySelector('.floating-status-music');
        const lyricStatus = item.querySelector('.floating-status-lyric');
        const resultElement = item.querySelector('.floating-download-result');
        
        if (musicStatus) {
            musicStatus.innerHTML = result.music.success ? 
                '音乐: ✅ 成功' : 
                `音乐: ❌ 失败${result.music.error ? ` (${result.music.error})` : ''}`;
        }
        
        if (lyricStatus) {
            lyricStatus.innerHTML = result.lyric.success ? 
                '歌词: ✅ 成功' : 
                `歌词: ❌ 失败${result.lyric.error ? ` (${result.lyric.error})` : ''}`;
        }
        
        if (resultElement) {
            resultElement.className = `floating-download-result ${status}`;
            resultElement.textContent = result.music.success && result.lyric.success ? '完成' : '部分失败';
        }
    }
    
    hideFloatingProgressCard() {
        const card = document.getElementById('floatingProgressCard');
        if (card) {
            card.classList.remove('show');
            setTimeout(() => {
                card.remove();
            }, 300);
        }
    }
    
    // 弹出框控制方法
    showDownloadsPopup() {
        this.downloadsPopup.classList.add('show');
        this.loadDownloadedFiles(); // 显示时刷新文件列表
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }
    
    hideDownloadsPopup() {
        this.downloadsPopup.classList.remove('show');
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
    
    clearHistory() {
        this.downloadHistory = [];
        this.downloadStatus.innerHTML = '';
        this.downloadSection.style.display = 'none';
    }
    
    async loadDownloadedFiles() {
        try {
            const response = await fetch('/api/downloads');
            const files = await response.json();
            
            if (files.length > 0) {
                this.downloadedFiles.innerHTML = files.map(file => {
                    const fileExtension = file.name.split('.').pop().toLowerCase();
                    return `
                        <div class="file-item">
                            <div class="file-info">
                                <div class="file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
                                <div class="file-size">${this.formatFileSize(file.size)}</div>
                            </div>
                            <div class="file-type ${fileExtension}">${fileExtension}</div>
                        </div>
                    `;
                }).join('');
            } else {
                this.downloadedFiles.innerHTML = `
                    <div class="empty-files">
                        <div class="empty-files-icon">📁</div>
                        <div>暂无下载文件</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载下载文件失败:', error);
            this.downloadedFiles.innerHTML = `
                <div class="empty-files">
                    <div class="empty-files-icon">❌</div>
                    <div>加载失败</div>
                </div>
            `;
        }
    }
    
    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'block' : 'none';
    }
    
    getSourceName(source) {
        const sourceMap = {
            'netease': '网易云',
            'tencent': '腾讯',
            'kugou': '酷狗',
            'kuwo': '酷我',
            'migu': '咪咕',
            'apple': 'Apple',
            'spotify': 'Spotify',
            'ytmusic': 'YouTube'
        };
        return sourceMap[source] || source.toUpperCase();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 音频播放器类
class AudioPlayer {
    constructor(musicDownloader) {
        this.musicDownloader = musicDownloader;
        this.currentSong = null;
        this.currentSongIndex = -1;
        this.playlist = [];
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.volume = 0.5;
        this.isMuted = false;
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        this.playerElement = document.getElementById('audioPlayer');
        this.audioElement = document.getElementById('audioElement');
        this.songCover = document.getElementById('playerSongCover');
        this.songTitle = document.getElementById('playerSongTitle');
        this.songArtist = document.getElementById('playerSongArtist');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        this.progressTrack = document.getElementById('progressTrack');
        this.progressFill = document.getElementById('progressFill');
        this.progressHandle = document.getElementById('progressHandle');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.muteBtn = document.getElementById('muteBtn');
    }
    
    bindEvents() {
        // 播放控制按钮事件
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.prevBtn.addEventListener('click', () => this.previousSong());
        this.nextBtn.addEventListener('click', () => this.nextSong());
        
        // 音频事件
        this.audioElement.addEventListener('loadstart', () => this.onLoadStart());
        this.audioElement.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
        this.audioElement.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audioElement.addEventListener('ended', () => this.onEnded());
        this.audioElement.addEventListener('error', (e) => this.onError(e));
        this.audioElement.addEventListener('play', () => this.onPlay());
        this.audioElement.addEventListener('pause', () => this.onPause());
        
        // 进度条事件
        this.progressTrack.addEventListener('click', (e) => this.seekTo(e));
        
        // 音量控制事件
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        // 设置初始音量
        this.audioElement.volume = this.volume;
        this.volumeSlider.value = this.volume * 100;
        
        // 键盘快捷键支持
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }
    
    handleKeyboardShortcuts(e) {
        // 只在播放器显示时响应快捷键
        if (this.playerElement.style.display === 'none') return;
        
        // 防止在输入框中触发快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.key) {
            case ' ': // 空格键：播放/暂停
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft': // 左箭头：后退10秒
                e.preventDefault();
                this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 10);
                break;
            case 'ArrowRight': // 右箭头：前进10秒
                e.preventDefault();
                this.audioElement.currentTime = Math.min(this.duration, this.audioElement.currentTime + 10);
                break;
            case 'ArrowUp': // 上箭头：增加音量
                e.preventDefault();
                this.setVolume(Math.min(1, this.volume + 0.1));
                this.volumeSlider.value = this.volume * 100;
                break;
            case 'ArrowDown': // 下箭头：减少音量
                e.preventDefault();
                this.setVolume(Math.max(0, this.volume - 0.1));
                this.volumeSlider.value = this.volume * 100;
                break;
            case 'n': // N键：下一首
                e.preventDefault();
                this.nextSong();
                break;
            case 'p': // P键：上一首
                e.preventDefault();
                this.previousSong();
                break;
            case 'm': // M键：静音
                e.preventDefault();
                this.toggleMute();
                break;
        }
    }
    
    async playSong(song, index) {
        try {
            // 更新当前播放按钮状态
            this.updatePlayButtons(-1); // 清除所有播放状态
            
            // 设置加载状态
            const playBtn = document.querySelector(`[data-index="${index}"]`);
            if (playBtn) {
                playBtn.classList.add('loading');
                playBtn.innerHTML = '⏳';
            }
            
            this.currentSong = song;
            this.currentSongIndex = index;
            this.playlist = this.musicDownloader.searchResultsData;
            
            // 更新播放器信息
            this.updatePlayerInfo();
            this.showPlayer();
            
            // 获取音频URL
            const audioUrl = await this.getAudioUrl(song);
            if (audioUrl) {
                this.audioElement.src = audioUrl;
                await this.audioElement.load();
                await this.audioElement.play();
            } else {
                throw new Error('无法获取音频链接');
            }
            
        } catch (error) {
            console.error('播放失败:', error);
            this.onError(error);
        }
    }
    
    async getAudioUrl(song) {
        try {
            // 首先尝试使用流式播放接口
            if (song.url_id) {
                const streamUrl = `/api/stream/${song.source}/${song.url_id}?br=128`;
                
                // 测试流式链接是否可用
                try {
                    const testResponse = await fetch(streamUrl, { method: 'HEAD' });
                    if (testResponse.ok) {
                        return streamUrl;
                    }
                } catch (e) {
                    console.log('流式播放不可用，尝试获取直接链接');
                }
            }
            
            // 尝试从服务器获取直接音频URL
            const response = await fetch(`/api/play?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist.join(', '))}&source=${song.source}&id=${song.url_id || ''}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    return data.url;
                }
            }
            
            // 如果服务器没有提供播放接口，使用预览URL（如果有的话）
            if (song.preview_url) {
                return song.preview_url;
            }
            
            // 最后返回null表示无法播放
            return null;
            
        } catch (error) {
            console.error('获取音频URL失败:', error);
            return null;
        }
    }
    
    updatePlayerInfo() {
        if (this.currentSong) {
            this.songTitle.textContent = this.currentSong.name;
            this.songArtist.textContent = this.currentSong.artist.join(', ');
            
            // 如果有专辑封面URL，可以在这里设置
            // this.songCover.src = this.currentSong.albumArt || 'default-cover.jpg';
        }
    }
    
    showPlayer() {
        this.playerElement.style.display = 'block';
        // 为页面底部添加内边距，避免内容被播放器遮挡
        document.body.style.paddingBottom = '80px';
    }
    
    hidePlayer() {
        this.playerElement.style.display = 'none';
        document.body.style.paddingBottom = '0';
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            this.audioElement.play();
        }
    }
    
    previousSong() {
        if (this.currentSongIndex > 0) {
            this.playSong(this.playlist[this.currentSongIndex - 1], this.currentSongIndex - 1);
        }
    }
    
    nextSong() {
        if (this.currentSongIndex < this.playlist.length - 1) {
            this.playSong(this.playlist[this.currentSongIndex + 1], this.currentSongIndex + 1);
        }
    }
    
    seekTo(e) {
        const rect = this.progressTrack.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const seekTime = percent * this.duration;
        this.audioElement.currentTime = seekTime;
    }
    
    setVolume(volume) {
        this.volume = volume;
        this.audioElement.volume = volume;
        this.updateVolumeButton();
    }
    
    toggleMute() {
        if (this.isMuted) {
            this.audioElement.volume = this.volume;
            this.isMuted = false;
        } else {
            this.audioElement.volume = 0;
            this.isMuted = true;
        }
        this.updateVolumeButton();
    }
    
    updateVolumeButton() {
        if (this.isMuted || this.audioElement.volume === 0) {
            this.muteBtn.innerHTML = '🔇';
        } else if (this.audioElement.volume < 0.5) {
            this.muteBtn.innerHTML = '🔉';
        } else {
            this.muteBtn.innerHTML = '🔊';
        }
    }
    
    updatePlayButtons(currentIndex) {
        // 重置所有播放按钮
        document.querySelectorAll('.song-play-btn').forEach((btn, index) => {
            btn.classList.remove('playing', 'loading');
            btn.innerHTML = '▶';
            
            if (index === currentIndex && this.isPlaying) {
                btn.classList.add('playing');
                btn.innerHTML = '⏸';
            }
        });
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // 音频事件处理
    onLoadStart() {
        console.log('开始加载音频');
    }
    
    onLoadedMetadata() {
        this.duration = this.audioElement.duration;
        this.totalTimeEl.textContent = this.formatTime(this.duration);
        
        // 移除加载状态
        const playBtn = document.querySelector(`[data-index="${this.currentSongIndex}"]`);
        if (playBtn) {
            playBtn.classList.remove('loading');
        }
    }
    
    onTimeUpdate() {
        this.currentTime = this.audioElement.currentTime;
        this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        
        // 更新进度条
        if (this.duration > 0) {
            const percent = (this.currentTime / this.duration) * 100;
            this.progressFill.style.width = `${percent}%`;
            this.progressHandle.style.left = `${percent}%`;
        }
    }
    
    onEnded() {
        // 自动播放下一首
        this.nextSong();
    }
    
    onError(error) {
        console.error('音频播放错误:', error);
        
        // 移除加载状态，显示错误
        const playBtn = document.querySelector(`[data-index="${this.currentSongIndex}"]`);
        if (playBtn) {
            playBtn.classList.remove('loading', 'playing');
            playBtn.innerHTML = '❌';
            playBtn.title = '播放失败，可能是音频链接无效';
            
            // 3秒后恢复播放按钮
            setTimeout(() => {
                playBtn.innerHTML = '▶';
                playBtn.title = '播放';
            }, 3000);
        }
        
        // 更新播放器状态
        this.songTitle.textContent = '播放失败';
        this.songArtist.textContent = '无法获取音频链接';
        
        // 如果是当前歌曲播放失败，尝试播放下一首
        if (this.currentSong && this.playlist.length > 1) {
            setTimeout(() => {
                if (this.currentSongIndex < this.playlist.length - 1) {
                    console.log('尝试播放下一首歌曲...');
                    this.nextSong();
                }
            }, 2000);
        }
    }
    
    onPlay() {
        this.isPlaying = true;
        this.playPauseBtn.innerHTML = '⏸';
        this.updatePlayButtons(this.currentSongIndex);
    }
    
    onPause() {
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '▶';
        this.updatePlayButtons(-1);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicDownloader();
});
