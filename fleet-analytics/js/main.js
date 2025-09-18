/**
 * メインアプリケーション
 * Marine Traffic Fleet Analytics System
 */

class MarineTrafficApp {
    
    constructor() {
        this.csvProcessor = new CSVProcessor();
        this.dataAnalyzer = new DataAnalyzer();
        this.chartManager = new ChartManager();
        this.vesselManager = new VesselManager();
        
        this.currentData = [];
        this.isProcessing = false;
        
        this.init();
    }
    
    /**
     * アプリケーション初期化
     */
    init() {
        Utils.log('info', 'MyFleet Analytics 初期化開始');
        
        this.setupEventListeners();
        this.setupWindowEvents();
        
        // 初期状態の設定
        this.updateUI();
        
        Utils.log('info', 'アプリケーション初期化完了');
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // CSVファイル選択
        const csvFileInput = document.getElementById('csvFile');
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }
        
        // 処理開始ボタン
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processCSVData());
        }
    }
    
    /**
     * ウィンドウイベントの設定
     */
    setupWindowEvents() {
        // ウィンドウリサイズ時のチャート調整
        window.addEventListener('resize', Utils.debounce(() => {
            this.chartManager.resizeCharts();
        }, 250));
        
        // ページ離脱時の確認
        window.addEventListener('beforeunload', (e) => {
            if (this.isProcessing) {
                e.preventDefault();
                e.returnValue = 'データ処理中です。ページを離れますか？';
            }
        });
    }
    
    /**
     * ファイル選択ハンドラー
     * @param {Event} event ファイル選択イベント
     */
    handleFileSelection(event) {
        const file = event.target.files[0];
        const processBtn = document.getElementById('processBtn');
        const statusDiv = document.getElementById('processingStatus');
        
        if (!file) {
            processBtn.disabled = true;
            statusDiv.textContent = 'CSVファイルを選択してください';
            statusDiv.className = 'p-3 bg-gray-100 rounded text-sm text-gray-600';
            return;
        }
        
        // ファイルサイズチェック（50MB制限）
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('ファイルサイズが大きすぎます（最大50MB）');
            event.target.value = '';
            return;
        }
        
        // ファイル形式チェック
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('CSVファイルを選択してください');
            event.target.value = '';
            return;
        }
        
        // 処理ボタンを有効化
        processBtn.disabled = false;
        statusDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-file-csv text-green-600"></i>
                <span class="text-green-700">
                    ${file.name} (${this.formatFileSize(file.size)}) - 処理準備完了
                </span>
            </div>
        `;
        statusDiv.className = 'p-3 bg-green-50 rounded text-sm border border-green-200';
        
        Utils.log('info', 'CSVファイル選択完了', {
            name: file.name,
            size: file.size,
            type: file.type
        });
    }
    
    /**
     * CSVデータ処理メイン関数
     */
    async processCSVData() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('CSVファイルが選択されていません');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // UIの更新
            this.showProcessingModal();
            this.updateProcessingProgress(0, 'CSV処理を開始しています...');
            
            Utils.log('info', 'CSV処理開始', { filename: file.name });
            
            // CSV処理
            const result = await this.csvProcessor.processCSVFile(file, 
                (progress, message) => this.updateProcessingProgress(progress, message)
            );
            
            if (result.success) {
                this.currentData = result.processedData;
                
                // データ分析
                this.updateProcessingProgress(93, 'データ分析を実行中...');
                this.dataAnalyzer.setData(this.currentData);
                const analysisResults = this.dataAnalyzer.performFullAnalysis();
                
                // 船舶管理データ設定
                this.updateProcessingProgress(96, '船舶データを構築中...');
                this.vesselManager.setData(this.currentData);
                
                // UI更新
                this.updateProcessingProgress(98, 'ダッシュボードを更新中...');
                await this.updateDashboard(analysisResults);
                
                // 完了
                this.updateProcessingProgress(100, '処理完了！');
                
                setTimeout(() => {
                    this.hideProcessingModal();
                    this.showSuccess(`処理完了: ${Utils.formatNumber(result.stats.validRows)}件のレコードを処理しました`);
                    this.showDashboard();
                }, 1000);
                
                Utils.log('info', 'CSV処理完了', result.stats);
                
            } else {
                throw new Error('CSV処理に失敗しました');
            }
            
        } catch (error) {
            Utils.log('error', 'CSV処理エラー', error);
            this.hideProcessingModal();
            this.showError(`処理エラー: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * ダッシュボード更新
     * @param {Object} analysisResults 分析結果
     */
    async updateDashboard(analysisResults) {
        // チャートの更新
        this.chartManager.updateAllCharts(analysisResults);
        
        // テーブルの更新
        this.chartManager.updateRouteTable(analysisResults.routePatterns);
        this.chartManager.updateActiveVesselsTable(analysisResults.vesselActivity);
        this.chartManager.updateFleetSummary(analysisResults.fleetStatistics);
        
        // 少し待機してUIの更新を確実に行う
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    /**
     * ダッシュボードを表示
     */
    showDashboard() {
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection) {
            dashboardSection.classList.remove('hidden');
            dashboardSection.classList.add('animate-fade-in');
        }
    }
    
    /**
     * 処理モーダルを表示
     */
    showProcessingModal() {
        const modal = document.getElementById('processingModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    /**
     * 処理モーダルを非表示
     */
    hideProcessingModal() {
        const modal = document.getElementById('processingModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    /**
     * 処理プログレスを更新
     * @param {number} progress 進捗率（0-100）
     * @param {string} message メッセージ
     */
    updateProcessingProgress(progress, message) {
        const progressBar = document.getElementById('processingProgress');
        const messageDiv = document.getElementById('processingMessage');
        const percentDiv = document.getElementById('processingPercent');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (messageDiv) {
            messageDiv.textContent = message;
        }
        
        if (percentDiv) {
            percentDiv.textContent = `${Math.round(progress)}%`;
        }
    }
    
    /**
     * 成功メッセージを表示
     * @param {string} message メッセージ
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * エラーメッセージを表示
     * @param {string} message メッセージ
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * 警告メッセージを表示
     * @param {string} message メッセージ
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    }
    
    /**
     * 通知を表示
     * @param {string} message メッセージ
     * @param {string} type 通知タイプ
     */
    showNotification(message, type = 'info') {
        // 既存の通知を削除
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = 'notification fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg';
        
        const colors = {
            success: 'bg-green-100 border border-green-400 text-green-700',
            error: 'bg-red-100 border border-red-400 text-red-700',
            warning: 'bg-yellow-100 border border-yellow-400 text-yellow-700',
            info: 'bg-blue-100 border border-blue-400 text-blue-700'
        };
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };
        
        notification.className += ` ${colors[type] || colors.info}`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="${icons[type] || icons.info} mr-3"></i>
                <span class="flex-1">${message}</span>
                <button class="ml-3 text-lg font-semibold hover:opacity-70" onclick="this.parentElement.parentElement.remove()">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * ファイルサイズをフォーマット
     * @param {number} bytes バイト数
     * @returns {string} フォーマットされたサイズ
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * UIの更新
     */
    updateUI() {
        const processBtn = document.getElementById('processBtn');
        const statusDiv = document.getElementById('processingStatus');
        
        if (processBtn) {
            processBtn.disabled = true;
        }
        
        if (statusDiv) {
            statusDiv.textContent = 'CSVファイルを選択してください';
            statusDiv.className = 'p-3 bg-gray-100 rounded text-sm text-gray-600';
        }
    }
    
    /**
     * データをリセット
     */
    resetData() {
        this.csvProcessor.reset();
        this.dataAnalyzer.reset();
        this.chartManager.destroyAllCharts();
        this.vesselManager.reset();
        
        this.currentData = [];
        
        // ダッシュボードを非表示
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection) {
            dashboardSection.classList.add('hidden');
        }
        
        // ファイル入力をクリア
        const csvFileInput = document.getElementById('csvFile');
        if (csvFileInput) {
            csvFileInput.value = '';
        }
        
        this.updateUI();
        
        Utils.log('info', 'アプリケーションデータリセット完了');
    }
    
    /**
     * アプリケーション統計を取得
     * @returns {Object} アプリケーション統計
     */
    getAppStats() {
        return {
            currentDataCount: this.currentData.length,
            isProcessing: this.isProcessing,
            hasData: this.currentData.length > 0,
            processingStats: this.csvProcessor.getProcessingStats(),
            analysisResults: this.dataAnalyzer.getAnalysisResults(),
            vesselStats: this.vesselManager.getVesselStats()
        };
    }
}

// DOM読み込み完了時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', function() {
    Utils.log('info', 'DOM読み込み完了 - アプリケーション開始');
    
    try {
        // グローバルアプリケーションインスタンスを作成
        window.marineApp = new MarineTrafficApp();
        
        Utils.log('info', 'MyFleet Analytics システム準備完了');
        
        // デバッグ用: コンソールにヘルプを表示
        if (console && console.info) {
            console.info(`
%c🚢 MyFleet Analytics システム 🚢
%c
利用可能なコマンド:
• marineApp.getAppStats() - アプリケーション統計
• marineApp.resetData() - データリセット
• marineApp.vesselManager.selectVessel('vessel-id') - 船舶選択
• Utils.log('info', 'message') - ログ出力

システム準備完了！CSVファイルをアップロードしてください。
            `, 'color: #2563eb; font-size: 16px; font-weight: bold;', 'color: #6b7280;');
        }
        
    } catch (error) {
        Utils.log('error', 'アプリケーション初期化エラー', error);
        console.error('MyFleet Analytics initialization failed:', error);
    }
});