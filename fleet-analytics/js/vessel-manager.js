/**
 * 船舶管理・詳細表示クラス
 * MyFleet Analytics System
 */

class VesselManager {
    
    constructor() {
        this.vessels = new Map();
        this.currentVessel = null;
        this.data = [];
    }
    
    /**
     * データを設定して船舶リストを構築
     * @param {Array} data 分析対象データ
     */
    setData(data) {
        this.data = data || [];
        this.buildVesselIndex();
        this.populateVesselSelector();
        Utils.log('info', '船舶データ設定完了', { vessels: this.vessels.size });
    }
    
    /**
     * 船舶インデックスを構築
     */
    buildVesselIndex() {
        this.vessels.clear();
        
        this.data.forEach(record => {
            const vesselId = this.getVesselId(record);
            if (!vesselId) return;
            
            if (!this.vessels.has(vesselId)) {
                this.vessels.set(vesselId, {
                    id: vesselId,
                    name: record.vessel || vesselId,
                    imo: record.imo || '',
                    mmsi: record.mmsi || '',
                    records: [],
                    stats: {
                        totalEvents: 0,
                        uniquePorts: new Set(),
                        uniqueCountries: new Set(),
                        uniqueEventTypes: new Set(),
                        firstActivity: null,
                        lastActivity: null,
                        qualityScoreSum: 0,
                        qualityScoreCount: 0
                    }
                });
            }
            
            const vessel = this.vessels.get(vesselId);
            vessel.records.push(record);
            
            // 統計を更新
            this.updateVesselStats(vessel, record);
        });
        
        // 統計を完成させる
        this.vessels.forEach(vessel => {
            vessel.stats.totalEvents = vessel.records.length;
            vessel.stats.averageQualityScore = vessel.stats.qualityScoreCount > 0 ? 
                vessel.stats.qualityScoreSum / vessel.stats.qualityScoreCount : 0;
            
            // レコードを時系列でソート
            vessel.records.sort((a, b) => {
                const aTime = a.timestamp ? a.timestamp.getTime() : 0;
                const bTime = b.timestamp ? b.timestamp.getTime() : 0;
                return bTime - aTime; // 新しい順
            });
        });
    }
    
    /**
     * 船舶統計を更新
     * @param {Object} vessel 船舶オブジェクト
     * @param {Object} record レコード
     */
    updateVesselStats(vessel, record) {
        const stats = vessel.stats;
        
        if (record.port) stats.uniquePorts.add(record.port);
        if (record.country) stats.uniqueCountries.add(record.country);
        if (record.event) stats.uniqueEventTypes.add(record.event);
        
        if (record.qualityScore) {
            stats.qualityScoreSum += record.qualityScore;
            stats.qualityScoreCount++;
        }
        
        if (record.timestamp && record.timestamp instanceof Date) {
            if (!stats.firstActivity || record.timestamp < stats.firstActivity) {
                stats.firstActivity = record.timestamp;
            }
            if (!stats.lastActivity || record.timestamp > stats.lastActivity) {
                stats.lastActivity = record.timestamp;
            }
        }
    }
    
    /**
     * 船舶選択セレクターを更新
     */
    populateVesselSelector() {
        const selector = document.getElementById('vesselSelector');
        if (!selector) return;
        
        // 既存のオプションをクリア（最初のオプションは残す）
        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }
        
        // 船舶を活動回数でソート
        const sortedVessels = Array.from(this.vessels.values())
            .sort((a, b) => b.stats.totalEvents - a.stats.totalEvents);
        
        sortedVessels.forEach(vessel => {
            const option = document.createElement('option');
            option.value = vessel.id;
            option.textContent = `${vessel.name} (${vessel.stats.totalEvents}イベント)`;
            if (vessel.imo) {
                option.textContent += ` - IMO: ${vessel.imo}`;
            }
            selector.appendChild(option);
        });
        
        // セレクター変更イベント
        selector.addEventListener('change', (e) => {
            this.selectVessel(e.target.value);
        });
    }
    
    /**
     * 船舶を選択
     * @param {string} vesselId 船舶ID
     */
    selectVessel(vesselId) {
        if (!vesselId) {
            this.clearVesselDisplay();
            return;
        }
        
        const vessel = this.vessels.get(vesselId);
        if (!vessel) {
            Utils.log('warn', '船舶が見つかりません', { vesselId });
            return;
        }
        
        this.currentVessel = vessel;
        this.displayVesselDetails(vessel);
        
        Utils.log('info', '船舶選択', {
            name: vessel.name,
            events: vessel.stats.totalEvents
        });
    }
    
    /**
     * 船舶詳細を表示
     * @param {Object} vessel 船舶オブジェクト
     */
    displayVesselDetails(vessel) {
        this.displayBasicInfo(vessel);
        this.displayActivitySummary(vessel);
        this.displayActivityTimeline(vessel);
        
        // タイムラインセクションを表示
        const timelineSection = document.getElementById('vesselTimelineSection');
        if (timelineSection) {
            timelineSection.classList.remove('hidden');
        }
    }
    
    /**
     * 基本情報を表示
     * @param {Object} vessel 船舶オブジェクト
     */
    displayBasicInfo(vessel) {
        const container = document.getElementById('vesselBasicInfo');
        if (!container) return;
        
        container.innerHTML = `
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">船名</span>
                <span class="font-semibold">${vessel.name}</span>
            </div>
            ${vessel.imo ? `
                <div class="flex justify-between items-center py-1">
                    <span class="text-gray-600">IMO番号</span>
                    <span class="font-mono text-sm">${vessel.imo}</span>
                </div>
            ` : ''}
            ${vessel.mmsi ? `
                <div class="flex justify-between items-center py-1">
                    <span class="text-gray-600">MMSI番号</span>
                    <span class="font-mono text-sm">${vessel.mmsi}</span>
                </div>
            ` : ''}
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">データ品質</span>
                <span class="badge ${this.getQualityBadgeClass(vessel.stats.averageQualityScore)}">
                    ${vessel.stats.averageQualityScore.toFixed(1)}点
                </span>
            </div>
        `;
    }
    
    /**
     * 活動サマリーを表示
     * @param {Object} vessel 船舶オブジェクト
     */
    displayActivitySummary(vessel) {
        const container = document.getElementById('vesselActivitySummary');
        if (!container) return;
        
        const activityPeriod = this.calculateActivityPeriod(vessel);
        
        container.innerHTML = `
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">総イベント数</span>
                <span class="font-semibold text-blue-600">${Utils.formatNumber(vessel.stats.totalEvents)}</span>
            </div>
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">訪問港数</span>
                <span class="font-semibold text-green-600">${vessel.stats.uniquePorts.size}</span>
            </div>
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">訪問国数</span>
                <span class="font-semibold text-purple-600">${vessel.stats.uniqueCountries.size}</span>
            </div>
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">イベント種類</span>
                <span class="font-semibold text-orange-600">${vessel.stats.uniqueEventTypes.size}</span>
            </div>
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">活動期間</span>
                <span class="text-xs text-gray-500">${activityPeriod}</span>
            </div>
            <div class="flex justify-between items-center py-1">
                <span class="text-gray-600">最終活動</span>
                <span class="text-xs text-gray-500">
                    ${vessel.stats.lastActivity ? Utils.formatDate(vessel.stats.lastActivity).replace(' ', '<br>') : '不明'}
                </span>
            </div>
        `;
    }
    
    /**
     * 活動履歴タイムラインを表示
     * @param {Object} vessel 船舶オブジェクト
     */
    displayActivityTimeline(vessel) {
        const tbody = document.getElementById('vesselActivityBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // 最新20件を表示
        const recentRecords = vessel.records.slice(0, 20);
        
        recentRecords.forEach(record => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            
            row.innerHTML = `
                <td class="p-3 text-xs">
                    ${record.timestamp ? Utils.formatDate(record.timestamp) : '不明'}
                </td>
                <td class="p-3">
                    <span class="badge ${this.getEventBadgeClass(record.event)}">
                        ${record.event || '不明'}
                    </span>
                </td>
                <td class="p-3 text-sm">${record.port || '不明'}</td>
                <td class="p-3 text-sm">${record.country || '不明'}</td>
                <td class="p-3">
                    <span class="badge ${this.getQualityBadgeClass(record.qualityScore)}">
                        ${record.qualityScore || 0}
                    </span>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    /**
     * 船舶表示をクリア
     */
    clearVesselDisplay() {
        this.currentVessel = null;
        
        const basicInfo = document.getElementById('vesselBasicInfo');
        const activitySummary = document.getElementById('vesselActivitySummary');
        const timelineSection = document.getElementById('vesselTimelineSection');
        
        if (basicInfo) {
            basicInfo.innerHTML = '<div class="text-gray-500">船舶を選択してください</div>';
        }
        
        if (activitySummary) {
            activitySummary.innerHTML = '<div class="text-gray-500">船舶を選択してください</div>';
        }
        
        if (timelineSection) {
            timelineSection.classList.add('hidden');
        }
    }
    
    /**
     * 船舶IDを取得
     * @param {Object} record レコード
     * @returns {string} 船舶ID
     */
    getVesselId(record) {
        return record.imo || record.vessel || record.mmsi || null;
    }
    
    /**
     * 活動期間を計算
     * @param {Object} vessel 船舶オブジェクト
     * @returns {string} 活動期間文字列
     */
    calculateActivityPeriod(vessel) {
        const { firstActivity, lastActivity } = vessel.stats;
        
        if (!firstActivity || !lastActivity) {
            return '不明';
        }
        
        if (firstActivity.getTime() === lastActivity.getTime()) {
            return '単一日';
        }
        
        const diffMs = lastActivity.getTime() - firstActivity.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        return `${diffDays}日間`;
    }
    
    /**
     * 品質スコア用のバッジクラスを取得
     * @param {number} score 品質スコア
     * @returns {string} CSSクラス名
     */
    getQualityBadgeClass(score) {
        if (score >= 80) return 'badge-success';
        if (score >= 50) return 'badge-warning';
        return 'badge-error';
    }
    
    /**
     * イベント用のバッジクラスを取得
     * @param {string} event イベント名
     * @returns {string} CSSクラス名
     */
    getEventBadgeClass(event) {
        if (!event) return 'badge-error';
        
        const eventLower = event.toLowerCase();
        if (eventLower.includes('arriv')) return 'badge-success';
        if (eventLower.includes('depart')) return 'badge-primary';
        if (eventLower.includes('anchor')) return 'badge-warning';
        return 'badge-primary';
    }
    
    /**
     * 船舶統計を取得
     * @returns {Object} 船舶統計
     */
    getVesselStats() {
        return {
            totalVessels: this.vessels.size,
            currentVessel: this.currentVessel?.name || null,
            vesselsWithIMO: Array.from(this.vessels.values()).filter(v => v.imo).length,
            vesselsWithMMSI: Array.from(this.vessels.values()).filter(v => v.mmsi).length
        };
    }
    
    /**
     * データをリセット
     */
    reset() {
        this.vessels.clear();
        this.currentVessel = null;
        this.data = [];
        
        // UIをクリア
        const selector = document.getElementById('vesselSelector');
        if (selector) {
            while (selector.children.length > 1) {
                selector.removeChild(selector.lastChild);
            }
            selector.value = '';
        }
        
        this.clearVesselDisplay();
    }
}

// Windowオブジェクトに追加
window.VesselManager = VesselManager;