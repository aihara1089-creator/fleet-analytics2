/**
 * CSV処理クラス
 * Marine Traffic Fleet Analytics System
 */

class CSVProcessor {
    
    constructor() {
        this.rawData = [];
        this.processedData = [];
        this.columnMapping = {};
        this.processingStats = {
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            duplicateRows: 0,
            qualityScores: []
        };
    }
    
    /**
     * CSVファイルを読み込んで処理
     * @param {File} file CSVファイル
     * @param {Function} progressCallback プログレス報告コールバック
     * @returns {Promise<Object>} 処理結果
     */
    async processCSVFile(file, progressCallback = null) {
        try {
            Utils.log('info', 'CSVファイル処理開始', { filename: file.name, size: file.size });
            
            // ファイルを読み込み
            const csvText = await this.readFileAsText(file);
            
            if (progressCallback) progressCallback(10, 'CSVファイルの解析中...');
            
            // CSVをパース
            const parsedData = this.parseCSV(csvText);
            
            if (progressCallback) progressCallback(30, 'データ構造の分析中...');
            
            // 列マッピングを自動検出
            this.columnMapping = Utils.detectColumnMapping(parsedData.headers);
            Utils.log('info', '列マッピング検出完了', this.columnMapping);
            
            if (progressCallback) progressCallback(50, 'データの正規化中...');
            
            // データを正規化・品質チェック
            await this.normalizeAndValidateData(parsedData.rows, progressCallback);
            
            if (progressCallback) progressCallback(90, '処理結果の集計中...');
            
            // 統計情報を計算
            this.calculateProcessingStats();
            
            if (progressCallback) progressCallback(100, '処理完了');
            
            Utils.log('info', 'CSV処理完了', this.processingStats);
            
            return {
                success: true,
                stats: this.processingStats,
                processedData: this.processedData,
                columnMapping: this.columnMapping
            };
            
        } catch (error) {
            Utils.log('error', 'CSV処理エラー', error);
            throw error;
        }
    }
    
    /**
     * ファイルをテキストとして読み込み
     * @param {File} file ファイルオブジェクト
     * @returns {Promise<string>} ファイル内容
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (error) => {
                reject(new Error('ファイル読み込みエラー: ' + error));
            };
            
            // UTF-8で読み込み、失敗した場合はShift_JISを試行
            try {
                reader.readAsText(file, 'UTF-8');
            } catch (e) {
                reader.readAsText(file, 'Shift_JIS');
            }
        });
    }
    
    /**
     * CSVテキストをパース
     * @param {string} csvText CSV文字列
     * @returns {Object} パース結果 {headers: Array, rows: Array}
     */
    parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
            throw new Error('CSVファイルが空です');
        }
        
        // ヘッダー行を解析
        const headers = this.parseCsvLine(lines[0]);
        
        if (headers.length === 0) {
            throw new Error('CSVヘッダーが見つかりません');
        }
        
        // データ行を解析
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCsvLine(lines[i]);
            if (row.length > 0) {
                rows.push(row);
            }
        }
        
        Utils.log('info', 'CSV解析完了', { 
            headers: headers.length, 
            rows: rows.length 
        });
        
        return { headers, rows };
    }
    
    /**
     * CSV行をパース（カンマ区切りとクォート処理）
     * @param {string} line CSV行
     * @returns {Array} パースされた値の配列
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes) {
                if (char === '"' || char === "'") {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            } else {
                if (char === quoteChar) {
                    if (nextChar === quoteChar) {
                        // エスケープされたクォート
                        current += char;
                        i++; // 次の文字をスキップ
                    } else {
                        // クォート終了
                        inQuotes = false;
                        quoteChar = '';
                    }
                } else {
                    current += char;
                }
            }
        }
        
        // 最後のフィールドを追加
        result.push(current.trim());
        
        return result;
    }
    
    /**
     * データを正規化・品質チェック
     * @param {Array} rows データ行配列
     * @param {Function} progressCallback プログレス報告コールバック
     */
    async normalizeAndValidateData(rows, progressCallback = null) {
        this.processedData = [];
        const seenRecords = new Set();
        const chunkSize = 1000; // バッチ処理のサイズ
        
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            
            for (const row of chunk) {
                const record = this.normalizeRecord(row);
                
                if (this.validateRecord(record)) {
                    // 重複チェック
                    const duplicateKey = this.generateDuplicateKey(record);
                    
                    if (!seenRecords.has(duplicateKey)) {
                        seenRecords.add(duplicateKey);
                        this.processedData.push(record);
                    } else {
                        this.processingStats.duplicateRows++;
                    }
                } else {
                    this.processingStats.invalidRows++;
                }
            }
            
            // プログレス更新
            if (progressCallback) {
                const progress = Math.min(90, 50 + (i / rows.length) * 40);
                progressCallback(progress, `データ処理中... ${i + chunk.length}/${rows.length}`);
            }
            
            // UIブロックを防ぐため少し待機
            if (i % (chunkSize * 5) === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        this.processingStats.totalRows = rows.length;
        this.processingStats.validRows = this.processedData.length;
    }
    
    /**
     * レコードを正規化
     * @param {Array} row 行データ
     * @returns {Object} 正規化されたレコード
     */
    normalizeRecord(row) {
        const record = {
            vessel: '',
            imo: '',
            mmsi: '',
            event: '',
            port: '',
            country: '',
            timestamp: null,
            originalData: [...row],
            dataSource: 'CSV_Import',
            processedAt: new Date(),
            qualityScore: 0
        };
        
        // 列マッピングに基づいてデータを抽出
        if (this.columnMapping.vessel >= 0 && row[this.columnMapping.vessel]) {
            record.vessel = Utils.cleanString(row[this.columnMapping.vessel]);
        }
        
        if (this.columnMapping.imo >= 0 && row[this.columnMapping.imo]) {
            record.imo = Utils.normalizeIMO(row[this.columnMapping.imo]);
        }
        
        if (this.columnMapping.mmsi >= 0 && row[this.columnMapping.mmsi]) {
            record.mmsi = Utils.normalizeMMSI(row[this.columnMapping.mmsi]);
        }
        
        if (this.columnMapping.event >= 0 && row[this.columnMapping.event]) {
            record.event = Utils.cleanString(row[this.columnMapping.event]);
        }
        
        if (this.columnMapping.port >= 0 && row[this.columnMapping.port]) {
            record.port = Utils.cleanString(row[this.columnMapping.port]);
        }
        
        if (this.columnMapping.country >= 0 && row[this.columnMapping.country]) {
            record.country = Utils.cleanString(row[this.columnMapping.country]);
        }
        
        if (this.columnMapping.timestamp >= 0 && row[this.columnMapping.timestamp]) {
            record.timestamp = Utils.parseDate(row[this.columnMapping.timestamp]);
        }
        
        // 品質スコアを計算
        record.qualityScore = Utils.calculateQualityScore(record);
        
        return record;
    }
    
    /**
     * レコードの妥当性をチェック
     * @param {Object} record レコードオブジェクト
     * @returns {boolean} 妥当性
     */
    validateRecord(record) {
        // 必須フィールドチェック: 船舶識別情報
        const hasVesselId = record.vessel || record.imo || record.mmsi;
        
        // 必須フィールドチェック: イベントまたは港
        const hasLocationEvent = record.event || record.port;
        
        // 品質スコア閾値（30点以上）
        const qualityThreshold = record.qualityScore >= 30;
        
        return hasVesselId && hasLocationEvent && qualityThreshold;
    }
    
    /**
     * 重複判定用のキーを生成
     * @param {Object} record レコードオブジェクト
     * @returns {string} 重複キー
     */
    generateDuplicateKey(record) {
        const vesselId = record.imo || record.vessel || record.mmsi || 'unknown';
        const port = record.port || 'unknown';
        const timestamp = record.timestamp ? record.timestamp.getTime() : 'unknown';
        
        return `${vesselId}|${port}|${timestamp}`;
    }
    
    /**
     * 処理統計を計算
     */
    calculateProcessingStats() {
        this.processingStats.qualityScores = this.processedData.map(record => record.qualityScore);
        
        // 品質スコアの分布
        const qualityDistribution = {
            high: this.processedData.filter(r => r.qualityScore >= 80).length,
            medium: this.processedData.filter(r => r.qualityScore >= 50 && r.qualityScore < 80).length,
            low: this.processedData.filter(r => r.qualityScore < 50).length
        };
        
        this.processingStats.qualityDistribution = qualityDistribution;
        
        Utils.log('info', '処理統計計算完了', {
            totalRows: this.processingStats.totalRows,
            validRows: this.processingStats.validRows,
            invalidRows: this.processingStats.invalidRows,
            duplicateRows: this.processingStats.duplicateRows,
            qualityDistribution
        });
    }
    
    /**
     * 処理済みデータを取得
     * @returns {Array} 処理済みデータ配列
     */
    getProcessedData() {
        return this.processedData;
    }
    
    /**
     * 処理統計を取得
     * @returns {Object} 処理統計オブジェクト
     */
    getProcessingStats() {
        return this.processingStats;
    }
    
    /**
     * 列マッピング情報を取得
     * @returns {Object} 列マッピングオブジェクト
     */
    getColumnMapping() {
        return this.columnMapping;
    }
    
    /**
     * データをリセット
     */
    reset() {
        this.rawData = [];
        this.processedData = [];
        this.columnMapping = {};
        this.processingStats = {
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            duplicateRows: 0,
            qualityScores: []
        };
    }
}

// Windowオブジェクトに追加
window.CSVProcessor = CSVProcessor;