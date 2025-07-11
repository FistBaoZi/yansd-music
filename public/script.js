class MusicDownloader {
    constructor() {
        this.searchResultsData = [];
        this.selectedSongs = new Set();
        this.isDownloading = false;
        this.downloadHistory = [];
        
        this.initializeElements();
        this.bindEvents();
        this.loadDownloadedFiles();
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

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MusicDownloader();
});
