/**
 * チャート管理クラス
 * Marine Traffic Fleet Analytics System
 */

class ChartManager {
    
    constructor() {
        this.charts = new Map();
        this.colors = {
            primary: '#2563eb',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
            purple: '#8b5cf6',
            orange: '#f97316',
            teal: '#14b8a6',
            pink: '#ec4899',
            indigo: '#6366f1'
        };
        
        this.colorPalette = [
            '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#f97316', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
            '#06b6d4', '#f43f5e', '#8b5a2b', '#6b7280', '#d97706'
        ];
    }
    
    /**
     * すべてのチャートを作成・更新
     * @param {Object} analysisResults 分析結果
     */
    updateAllCharts(analysisResults) {
        try {
            Utils.log('info', 'チャート更新開始');
            
            // 基本統計を更新
            this.updateBasicStats(analysisResults.basicStats);
            
            // 各チャートを更新
            this.updateCountryChart(analysisResults.countryAnalysis);
            this.updatePortChart(analysisResults.portAnalysis);
            this.updateEventChart(analysisResults.eventAnalysis);
            this.updateMonthlyChart(analysisResults.monthlyTrend);
            
            Utils.log('info', 'チャート更新完了');
            
        } catch (error) {
            Utils.log('error', 'チャート更新エラー', error);
        }
    }
    
    /**
     * 基本統計を更新
     * @param {Object} basicStats 基本統計
     */
    updateBasicStats(basicStats) {
        document.getElementById('totalRecords').textContent = Utils.formatNumber(basicStats.totalRecords);
        document.getElementById('uniqueVessels').textContent = Utils.formatNumber(basicStats.uniqueVessels);
        document.getElementById('uniquePorts').textContent = Utils.formatNumber(basicStats.uniquePorts);
        document.getElementById('uniqueCountries').textContent = Utils.formatNumber(basicStats.uniqueCountries);
    }
    
    /**
     * 国別チャートを更新
     * @param {Array} countryData 国別データ
     */
    updateCountryChart(countryData) {
        const ctx = document.getElementById('countryChart');
        if (!ctx) return;
        
        // 既存のチャートを破棄
        if (this.charts.has('country')) {
            this.charts.get('country').destroy();
        }
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: countryData.map(item => item.country),
                datasets: [{
                    data: countryData.map(item => item.count),
                    backgroundColor: this.generateColors(countryData.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const count = data.datasets[0].data[i];
                                        return {
                                            text: `${label} (${Utils.formatNumber(count)})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = Utils.formatNumber(context.parsed);
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${label}: ${value}件 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('country', chart);
    }
    
    /**
     * 港別チャートを更新
     * @param {Array} portData 港別データ
     */
    updatePortChart(portData) {
        const ctx = document.getElementById('portChart');
        if (!ctx) return;
        
        // 既存のチャートを破棄
        if (this.charts.has('port')) {
            this.charts.get('port').destroy();
        }
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: portData.map(item => item.port),
                datasets: [{
                    label: '寄港回数',
                    data: portData.map(item => item.count),
                    backgroundColor: this.colors.success,
                    borderColor: this.colors.success,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.x}件`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 10
                            },
                            maxRotation: 0,
                            callback: function(value, index, values) {
                                const label = this.getLabelForValue(value);
                                return label.length > 20 ? label.substring(0, 20) + '...' : label;
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('port', chart);
    }
    
    /**
     * イベント別チャートを更新
     * @param {Array} eventData イベント別データ
     */
    updateEventChart(eventData) {
        const ctx = document.getElementById('eventChart');
        if (!ctx) return;
        
        // 既存のチャートを破棄
        if (this.charts.has('event')) {
            this.charts.get('event').destroy();
        }
        
        const chart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: eventData.map(item => item.event),
                datasets: [{
                    data: eventData.map(item => item.count),
                    backgroundColor: this.generateColors(eventData.length, 0.7),
                    borderColor: this.generateColors(eventData.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = Utils.formatNumber(context.parsed.r);
                                return `${label}: ${value}件`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('event', chart);
    }
    
    /**
     * 月次トレンドチャートを更新
     * @param {Array} monthlyData 月次データ
     */
    updateMonthlyChart(monthlyData) {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;
        
        // 既存のチャートを破棄
        if (this.charts.has('monthly')) {
            this.charts.get('monthly').destroy();
        }
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.map(item => item.month),
                datasets: [{
                    label: '寄港イベント数',
                    data: monthlyData.map(item => item.count),
                    borderColor: this.colors.orange,
                    backgroundColor: this.hexToRgba(this.colors.orange, 0.1),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: this.colors.orange,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${Utils.formatNumber(context.parsed.y)}件`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '月'
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'イベント数'
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('monthly', chart);
    }
    
    /**
     * 航路テーブルを更新
     * @param {Array} routeData 航路データ
     */
    updateRouteTable(routeData) {
        const tbody = document.getElementById('routeTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        routeData.forEach((route, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-3 font-medium">${index + 1}</td>
                <td class="p-3">${route.from}</td>
                <td class="p-3">${route.to}</td>
                <td class="p-3 font-semibold text-blue-600">${Utils.formatNumber(route.count)}</td>
                <td class="p-3 text-gray-600">${Utils.formatNumber(route.vesselCount)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    /**
     * 活発船舶テーブルを更新
     * @param {Array} vesselData 船舶活動データ
     */
    updateActiveVesselsTable(vesselData) {
        const tbody = document.getElementById('activeVesselsBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        vesselData.forEach((vessel) => {
            const row = document.createElement('tr');
            const lastActivity = vessel.lastActivity ? 
                Utils.formatDate(vessel.lastActivity).replace(' ', '<br>') : 
                '不明';
            
            row.innerHTML = `
                <td class="p-2 font-medium text-sm">
                    ${vessel.name}
                    ${vessel.imo ? `<br><span class="text-xs text-gray-500">IMO: ${vessel.imo}</span>` : ''}
                </td>
                <td class="p-2 font-semibold text-blue-600">${Utils.formatNumber(vessel.events)}</td>
                <td class="p-2 text-gray-700">${Utils.formatNumber(vessel.portCount)}</td>
                <td class="p-2 text-xs text-gray-500">${lastActivity}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    /**
     * フリート統計サマリーを更新
     * @param {Object} fleetStats フリート統計
     */
    updateFleetSummary(fleetStats) {
        const container = document.getElementById('fleetSummary');
        if (!container) return;
        
        container.innerHTML = `
            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                <span class="text-gray-600">活動船舶数</span>
                <span class="font-semibold text-green-600">${Utils.formatNumber(fleetStats.activeVessels)}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                <span class="text-gray-600">総寄港イベント数</span>
                <span class="font-semibold text-blue-600">${Utils.formatNumber(fleetStats.totalEvents)}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                <span class="text-gray-600">訪問国数</span>
                <span class="font-semibold text-purple-600">${Utils.formatNumber(fleetStats.totalCountries)}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                <span class="text-gray-600">訪問港数</span>
                <span class="font-semibold text-orange-600">${Utils.formatNumber(fleetStats.totalPorts)}</span>
            </div>
            <div class="flex justify-between items-center py-2">
                <span class="text-gray-600">平均船舶活動</span>
                <span class="font-semibold text-indigo-600">
                    ${(fleetStats.totalEvents / fleetStats.activeVessels).toFixed(1)} イベント/隻
                </span>
            </div>
        `;
    }
    
    /**
     * 色配列を生成
     * @param {number} count 必要な色数
     * @param {number} alpha 透明度（オプション）
     * @returns {Array} 色の配列
     */
    generateColors(count, alpha = 1) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const colorIndex = i % this.colorPalette.length;
            const color = this.colorPalette[colorIndex];
            if (alpha < 1) {
                colors.push(this.hexToRgba(color, alpha));
            } else {
                colors.push(color);
            }
        }
        return colors;
    }
    
    /**
     * HEXカラーをRGBAに変換
     * @param {string} hex HEXカラー
     * @param {number} alpha 透明度
     * @returns {string} RGBAカラー
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * すべてのチャートを破棄
     */
    destroyAllCharts() {
        this.charts.forEach(chart => {
            try {
                chart.destroy();
            } catch (error) {
                console.warn('Chart destruction error:', error);
            }
        });
        this.charts.clear();
    }
    
    /**
     * チャートのリサイズ
     */
    resizeCharts() {
        this.charts.forEach(chart => {
            try {
                chart.resize();
            } catch (error) {
                console.warn('Chart resize error:', error);
            }
        });
    }
}

// Windowオブジェクトに追加
window.ChartManager = ChartManager;