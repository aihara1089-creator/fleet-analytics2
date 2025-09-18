/**
 * データ分析エンジン
 * Marine Traffic Fleet Analytics System
 */

class DataAnalyzer {
    
    constructor() {
        this.data = [];
        this.analysisResults = {};
    }
    
    /**
     * データを設定
     * @param {Array} data 分析対象データ
     */
    setData(data) {
        this.data = data || [];
        Utils.log('info', 'データ分析用データ設定完了', { records: this.data.length });
    }
    
    /**
     * 包括的な分析を実行
     * @returns {Object} 分析結果
     */
    performFullAnalysis() {
        Utils.log('info', '包括分析開始');
        
        try {
            this.analysisResults = {
                basicStats: this.calculateBasicStats(),
                countryAnalysis: this.analyzeCountries(),
                portAnalysis: this.analyzePorts(),
                eventAnalysis: this.analyzeEvents(),
                monthlyTrend: this.analyzeMonthlyTrend(),
                routePatterns: this.analyzeRoutePatterns(),
                fleetStatistics: this.analyzeFleetStatistics(),
                vesselActivity: this.analyzeVesselActivity()
            };
            
            Utils.log('info', '包括分析完了', {
                countriesCount: this.analysisResults.countryAnalysis.length,
                portsCount: this.analysisResults.portAnalysis.length,
                routesCount: this.analysisResults.routePatterns.length
            });
            
            return this.analysisResults;
            
        } catch (error) {
            Utils.log('error', '分析エラー', error);
            throw error;
        }
    }
    
    /**
     * 基本統計を計算
     * @returns {Object} 基本統計
     */
    calculateBasicStats() {
        const stats = {
            totalRecords: this.data.length,
            uniqueVessels: new Set(),
            uniquePorts: new Set(),
            uniqueCountries: new Set(),
            dateRange: { min: null, max: null }
        };
        
        this.data.forEach(record => {
            // 船舶
            if (record.vessel) stats.uniqueVessels.add(record.vessel);
            if (record.imo) stats.uniqueVessels.add(record.imo);
            
            // 港
            if (record.port) stats.uniquePorts.add(record.port);
            
            // 国
            if (record.country) stats.uniqueCountries.add(record.country);
            
            // 日付範囲
            if (record.timestamp && record.timestamp instanceof Date) {
                if (!stats.dateRange.min || record.timestamp < stats.dateRange.min) {
                    stats.dateRange.min = record.timestamp;
                }
                if (!stats.dateRange.max || record.timestamp > stats.dateRange.max) {
                    stats.dateRange.max = record.timestamp;
                }
            }
        });
        
        return {
            totalRecords: stats.totalRecords,
            uniqueVessels: stats.uniqueVessels.size,
            uniquePorts: stats.uniquePorts.size,
            uniqueCountries: stats.uniqueCountries.size,
            dateRange: stats.dateRange
        };
    }
    
    /**
     * 国別分析
     * @param {number} limit 上位N件
     * @returns {Array} 国別統計配列
     */
    analyzeCountries(limit = 15) {
        const countryCounts = {};
        
        this.data.forEach(record => {
            const country = record.country || 'Unknown';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        });
        
        return Object.entries(countryCounts)
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * 港別分析
     * @param {number} limit 上位N件
     * @returns {Array} 港別統計配列
     */
    analyzePorts(limit = 20) {
        const portCounts = {};
        
        this.data.forEach(record => {
            const port = record.port || 'Unknown';
            portCounts[port] = (portCounts[port] || 0) + 1;
        });
        
        return Object.entries(portCounts)
            .map(([port, count]) => ({ port, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * イベント別分析
     * @returns {Array} イベント別統計配列
     */
    analyzeEvents() {
        const eventCounts = {};
        
        this.data.forEach(record => {
            const event = record.event || 'Unknown';
            eventCounts[event] = (eventCounts[event] || 0) + 1;
        });
        
        return Object.entries(eventCounts)
            .map(([event, count]) => ({ event, count }))
            .sort((a, b) => b.count - a.count);
    }
    
    /**
     * 月次トレンド分析
     * @returns {Array} 月次統計配列
     */
    analyzeMonthlyTrend() {
        const monthlyCounts = {};
        
        this.data.forEach(record => {
            if (record.timestamp && record.timestamp instanceof Date) {
                const monthKey = Utils.getMonthKey(record.timestamp);
                monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
            }
        });
        
        return Object.entries(monthlyCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }
    
    /**
     * 航路パターン分析
     * @param {number} limit 上位N件
     * @returns {Array} 航路パターン配列
     */
    analyzeRoutePatterns(limit = 25) {
        const vesselRoutes = new Map();
        const routeCounts = new Map();
        
        // 船舶ごとに時系列でソート
        const vesselData = new Map();
        
        this.data.forEach(record => {
            const vesselId = record.imo || record.vessel || record.mmsi;
            if (!vesselId || !record.port || !record.timestamp) return;
            
            if (!vesselData.has(vesselId)) {
                vesselData.set(vesselId, []);
            }
            vesselData.get(vesselId).push(record);
        });
        
        // 各船舶の航路を分析
        vesselData.forEach((records, vesselId) => {
            // 時系列でソート
            const sortedRecords = records.sort((a, b) => 
                (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0)
            );
            
            // 連続する港のペアを抽出
            for (let i = 0; i < sortedRecords.length - 1; i++) {
                const from = sortedRecords[i].port;
                const to = sortedRecords[i + 1].port;
                
                // 同一港の連続は除外
                if (from && to && from !== to) {
                    const routeKey = `${from} → ${to}`;
                    
                    if (!routeCounts.has(routeKey)) {
                        routeCounts.set(routeKey, {
                            from,
                            to,
                            count: 0,
                            vessels: new Set()
                        });
                    }
                    
                    const route = routeCounts.get(routeKey);
                    route.count++;
                    route.vessels.add(vesselId);
                }
            }
        });
        
        // 上位航路を返す
        return Array.from(routeCounts.values())
            .map(route => ({
                from: route.from,
                to: route.to,
                count: route.count,
                vesselCount: route.vessels.size
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    
    /**
     * フリート統計分析
     * @returns {Object} フリート統計
     */
    analyzeFleetStatistics() {
        const stats = {
            totalVessels: new Set(),
            activeVessels: new Set(),
            totalPorts: new Set(),
            totalCountries: new Set(),
            totalEvents: this.data.length,
            activityByVessel: new Map()
        };
        
        this.data.forEach(record => {
            const vesselId = record.imo || record.vessel || record.mmsi;
            
            if (vesselId) {
                stats.totalVessels.add(vesselId);
                stats.activeVessels.add(vesselId);
                
                if (!stats.activityByVessel.has(vesselId)) {
                    stats.activityByVessel.set(vesselId, {
                        name: record.vessel || vesselId,
                        imo: record.imo,
                        events: 0,
                        ports: new Set(),
                        countries: new Set(),
                        lastActivity: null
                    });
                }
                
                const activity = stats.activityByVessel.get(vesselId);
                activity.events++;
                
                if (record.port) activity.ports.add(record.port);
                if (record.country) activity.countries.add(record.country);
                if (record.timestamp && (!activity.lastActivity || record.timestamp > activity.lastActivity)) {
                    activity.lastActivity = record.timestamp;
                }
            }
            
            if (record.port) stats.totalPorts.add(record.port);
            if (record.country) stats.totalCountries.add(record.country);
        });
        
        return {
            totalVessels: stats.totalVessels.size,
            activeVessels: stats.activeVessels.size,
            totalPorts: stats.totalPorts.size,
            totalCountries: stats.totalCountries.size,
            totalEvents: stats.totalEvents,
            activityByVessel: stats.activityByVessel
        };
    }
    
    /**
     * 船舶活動分析
     * @param {number} limit 上位N件
     * @returns {Array} 活発な船舶リスト
     */
    analyzeVesselActivity(limit = 20) {
        const fleetStats = this.analyzeFleetStatistics();
        
        return Array.from(fleetStats.activityByVessel.entries())
            .map(([vesselId, activity]) => ({
                vesselId,
                name: activity.name,
                imo: activity.imo,
                events: activity.events,
                portCount: activity.ports.size,
                countryCount: activity.countries.size,
                lastActivity: activity.lastActivity
            }))
            .sort((a, b) => b.events - a.events)
            .slice(0, limit);
    }
    
    /**
     * 滞在時間分析（到着・出発ペアがある場合）
     * @param {number} limit 上位N件
     * @returns {Array} 滞在時間統計
     */
    analyzeStayDuration(limit = 10) {
        const vesselStays = new Map();
        
        // 船舶ごとに到着・出発ペアを検索
        const vesselData = new Map();
        
        this.data.forEach(record => {
            const vesselId = record.imo || record.vessel || record.mmsi;
            if (!vesselId) return;
            
            if (!vesselData.has(vesselId)) {
                vesselData.set(vesselId, []);
            }
            vesselData.get(vesselId).push(record);
        });
        
        vesselData.forEach((records, vesselId) => {
            const sortedRecords = records.sort((a, b) => 
                (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0)
            );
            
            for (let i = 0; i < sortedRecords.length - 1; i++) {
                const current = sortedRecords[i];
                const next = sortedRecords[i + 1];
                
                // 同一港で到着→出発のパターンを検索
                if (current.port === next.port && 
                    current.event?.toLowerCase().includes('arriv') &&
                    next.event?.toLowerCase().includes('depart')) {
                    
                    const stayHours = Utils.calculateStayHours(current.timestamp, next.timestamp);
                    
                    if (stayHours > 0) {
                        if (!vesselStays.has(current.port)) {
                            vesselStays.set(current.port, {
                                port: current.port,
                                totalStayHours: 0,
                                stayCount: 0,
                                averageStayHours: 0
                            });
                        }
                        
                        const portStats = vesselStays.get(current.port);
                        portStats.totalStayHours += stayHours;
                        portStats.stayCount++;
                        portStats.averageStayHours = portStats.totalStayHours / portStats.stayCount;
                    }
                }
            }
        });
        
        return Array.from(vesselStays.values())
            .filter(stat => stat.stayCount >= 3) // 最低3回の滞在記録
            .sort((a, b) => b.averageStayHours - a.averageStayHours)
            .slice(0, limit);
    }
    
    /**
     * 分析結果を取得
     * @returns {Object} 分析結果オブジェクト
     */
    getAnalysisResults() {
        return this.analysisResults;
    }
    
    /**
     * 特定の分析結果を取得
     * @param {string} analysisType 分析タイプ
     * @returns {*} 指定された分析結果
     */
    getAnalysis(analysisType) {
        return this.analysisResults[analysisType];
    }
    
    /**
     * データをリセット
     */
    reset() {
        this.data = [];
        this.analysisResults = {};
    }
}

// Windowオブジェクトに追加
window.DataAnalyzer = DataAnalyzer;