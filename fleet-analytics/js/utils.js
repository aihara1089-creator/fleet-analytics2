/**
 * 汎用ユーティリティ関数
 * Marine Traffic Fleet Analytics System
 */

class Utils {
    
    /**
     * 日付文字列を正規化してDateオブジェクトに変換
     * @param {string} dateStr 日付文字列
     * @returns {Date|null} 変換されたDateオブジェクト、失敗時はnull
     */
    static parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            // 文字列をクリーンアップ
            const cleaned = String(dateStr).trim();
            if (!cleaned) return null;
            
            // 様々な日付フォーマットに対応
            const formats = [
                // ISO 8601
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
                // yyyy-mm-dd hh:mm:ss
                /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
                // yyyy/mm/dd hh:mm:ss
                /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
                // dd/mm/yyyy hh:mm:ss
                /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/,
                // yyyy-mm-dd
                /^\d{4}-\d{2}-\d{2}$/,
                // mm/dd/yyyy
                /^\d{2}\/\d{2}\/\d{4}$/,
                // dd-mm-yyyy
                /^\d{2}-\d{2}-\d{4}$/
            ];
            
            let date = null;
            
            // まず標準的なDate.parseを試す
            date = new Date(cleaned);
            if (!isNaN(date.getTime())) {
                return date;
            }
            
            // dd/mm/yyyy形式の場合は手動で変換
            const ddmmyyMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})( \d{2}:\d{2}:\d{2})?$/);
            if (ddmmyyMatch) {
                const [, day, month, year, time] = ddmmyyMatch;
                const timeStr = time ? time.trim() : '00:00:00';
                date = new Date(`${year}-${month}-${day}T${timeStr}Z`);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
            
            // dd-mm-yyyy形式の場合は手動で変換
            const ddmmyyDashMatch = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})( \d{2}:\d{2}:\d{2})?$/);
            if (ddmmyyDashMatch) {
                const [, day, month, year, time] = ddmmyyDashMatch;
                const timeStr = time ? time.trim() : '00:00:00';
                date = new Date(`${year}-${month}-${day}T${timeStr}Z`);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
            
            console.warn(`Unable to parse date: ${dateStr}`);
            return null;
            
        } catch (error) {
            console.warn(`Error parsing date "${dateStr}":`, error);
            return null;
        }
    }
    
    /**
     * 文字列をクリーンアップ（前後の空白除去、空文字列の統一）
     * @param {string} str 対象文字列
     * @returns {string} クリーンアップされた文字列
     */
    static cleanString(str) {
        if (str === null || str === undefined) return '';
        return String(str).trim();
    }
    
    /**
     * IMO番号を正規化（7桁の数字のみ抽出）
     * @param {string} imo IMO番号文字列
     * @returns {string} 正規化されたIMO番号
     */
    static normalizeIMO(imo) {
        if (!imo) return '';
        const cleaned = String(imo).replace(/[^\d]/g, '');
        return cleaned.length === 7 ? cleaned : '';
    }
    
    /**
     * MMSI番号を正規化（9桁の数字のみ抽出）
     * @param {string} mmsi MMSI番号文字列
     * @returns {string} 正規化されたMMSI番号
     */
    static normalizeMMSI(mmsi) {
        if (!mmsi) return '';
        const cleaned = String(mmsi).replace(/[^\d]/g, '');
        return cleaned.length === 9 ? cleaned : '';
    }
    
    /**
     * データ品質スコアを計算
     * @param {Object} record レコードオブジェクト
     * @returns {number} 品質スコア（0-100）
     */
    static calculateQualityScore(record) {
        let score = 0;
        
        // 船舶識別情報（40点）
        if (record.vessel) score += 15;
        if (record.imo) score += 15;
        if (record.mmsi) score += 10;
        
        // 位置・イベント情報（40点）
        if (record.port) score += 20;
        if (record.event) score += 10;
        if (record.country) score += 10;
        
        // 日時情報（20点）
        if (record.timestamp) score += 20;
        
        return Math.min(100, score);
    }
    
    /**
     * CSVヘッダーから列のマッピングを自動推定
     * @param {Array} headers CSVヘッダー配列
     * @returns {Object} 列マッピングオブジェクト
     */
    static detectColumnMapping(headers) {
        const mapping = {
            vessel: -1,
            imo: -1,
            mmsi: -1,
            event: -1,
            port: -1,
            country: -1,
            timestamp: -1
        };
        
        const patterns = {
            vessel: /vessel|ship|name|shipname|vesselname/i,
            imo: /imo/i,
            mmsi: /mmsi/i,
            event: /event|status|movement|port.?event/i,
            port: /port|location|destination|terminal/i,
            country: /country|flag/i,
            timestamp: /arrival|departure|event.?time|date|datetime|eta|etd|time/i
        };
        
        headers.forEach((header, index) => {
            const headerLower = String(header).toLowerCase().trim();
            
            for (const [key, pattern] of Object.entries(patterns)) {
                if (pattern.test(headerLower) && mapping[key] === -1) {
                    mapping[key] = index;
                    break;
                }
            }
        });
        
        return mapping;
    }
    
    /**
     * 月次集計用のキーを生成（yyyy-MM形式）
     * @param {Date} date 日付オブジェクト
     * @returns {string} 月次キー
     */
    static getMonthKey(date) {
        if (!date || isNaN(date.getTime())) return 'unknown';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    
    /**
     * 配列をチャンク（塊）に分割
     * @param {Array} array 分割対象の配列
     * @param {number} chunkSize チャンクサイズ
     * @returns {Array} チャンクの配列
     */
    static chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    /**
     * オブジェクト配列から重複を除去
     * @param {Array} array 配列
     * @param {string} keyField 重複判定キー
     * @returns {Array} 重複除去された配列
     */
    static removeDuplicates(array, keyField) {
        const seen = new Set();
        return array.filter(item => {
            const key = item[keyField];
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    
    /**
     * 数値をカンマ区切りでフォーマット
     * @param {number} num 数値
     * @returns {string} フォーマットされた文字列
     */
    static formatNumber(num) {
        return new Intl.NumberFormat('ja-JP').format(num);
    }
    
    /**
     * 日付を日本語形式でフォーマット
     * @param {Date} date 日付
     * @returns {string} フォーマットされた日付文字列
     */
    static formatDate(date) {
        if (!date || isNaN(date.getTime())) return '不明';
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    /**
     * 滞在時間（時間）を計算
     * @param {Date} arrival 到着日時
     * @param {Date} departure 出発日時
     * @returns {number} 滞在時間（時間単位）
     */
    static calculateStayHours(arrival, departure) {
        if (!arrival || !departure || isNaN(arrival.getTime()) || isNaN(departure.getTime())) {
            return 0;
        }
        const diffMs = departure.getTime() - arrival.getTime();
        return Math.max(0, diffMs / (1000 * 60 * 60)); // ミリ秒を時間に変換
    }
    
    /**
     * 配列を値でソート
     * @param {Array} array ソート対象配列
     * @param {string} key ソートキー
     * @param {boolean} descending 降順フラグ
     * @returns {Array} ソートされた配列
     */
    static sortBy(array, key, descending = true) {
        return [...array].sort((a, b) => {
            const aVal = a[key] || 0;
            const bVal = b[key] || 0;
            
            if (descending) {
                return bVal - aVal;
            } else {
                return aVal - bVal;
            }
        });
    }
    
    /**
     * 配列の要素をカウント
     * @param {Array} array 配列
     * @param {string} key カウントするキー
     * @returns {Object} カウント結果オブジェクト
     */
    static countBy(array, key) {
        const counts = {};
        array.forEach(item => {
            const value = item[key] || 'unknown';
            counts[value] = (counts[value] || 0) + 1;
        });
        return counts;
    }
    
    /**
     * デバウンス関数
     * @param {Function} func 実行する関数
     * @param {number} wait 待機時間（ミリ秒）
     * @returns {Function} デバウンスされた関数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * ログレベル付きのログ出力
     * @param {string} level ログレベル
     * @param {string} message メッセージ
     * @param {*} data 追加データ
     */
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        switch (level.toLowerCase()) {
            case 'error':
                console.error(logMessage, data);
                break;
            case 'warn':
                console.warn(logMessage, data);
                break;
            case 'info':
                console.info(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
    }
}

// Window オブジェクトに追加
window.Utils = Utils;