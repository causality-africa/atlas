// Core configuration
const API_URL = "https://api.causality.africa/v1";

const COLOR_PALETTE = {
    line: [
        "#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e",
        "#17becf", "#e377c2", "#8c564b", "#bcbd22", "#7f7f7f"
    ],
};

const CACHE_DURATION = { // In hours
    ONE_WEEK: 24 * 7,
    TWO_WEEKS: 24 * 14,
};

// Main entry point
document.addEventListener("DOMContentLoaded", async () => {
    const chartWrapperEls = document.getElementsByClassName("chart-container-wrapper");
    for (const wrapperEl of chartWrapperEls) {
        const chartEl = wrapperEl.querySelector(".chart-container .chart");
        const chartType = chartEl.dataset.chartType || "line";

        const visualizer = ChartFactory.create(chartType, wrapperEl, chartEl);
        visualizer.initialize();
    }
});

// Factory for creating appropriate visualizer
class ChartFactory {
    static create(type, wrapperEl, chartEl) {
        switch (type.toLowerCase()) {
            case "line":
                return new LineChartVisualizer(wrapperEl, chartEl);
            default:
                console.warn(`Unknown chart type: ${type}`);
                return new LineChartVisualizer(wrapperEl, chartEl);
        }
    }
}

// Base visualizer
class BaseChartVisualizer {
    constructor(wrapperEl, chartEl) {
        this.wrapperEl = wrapperEl;
        this.chartEl = chartEl;
        this.dataset = [];
        this.sources = [];
    }

    async initialize() {
        await this.fetchData();
        this.setupUI();
        this.render();
    }

    async fetchData() {
        throw new Error("fetchData method must be implemented by subclass");
    }

    setupUI() {
        this.setupLocationSelectors();
        this.setupSourceInfo();
        this.setupExportButton();
    }

    setupLocationSelectors() {
        const selectedLocationsEl = this.wrapperEl.querySelector(".selected-locations");
        if (!selectedLocationsEl) return;

        selectedLocationsEl.innerHTML = '';

        this.dataset.forEach(data => {
            const container = document.createElement("div");
            container.className = "flex items-center p-3";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = data.location;
            checkbox.checked = true;
            checkbox.className = "mr-3 h-4 w-4";
            checkbox.addEventListener("change", () => this.updateVisualization());

            const label = document.createElement("label");
            label.htmlFor = data.location;
            label.className = "text-sm text-gray-600";
            label.textContent = data.location;

            container.appendChild(checkbox);
            container.appendChild(label);

            selectedLocationsEl.appendChild(container);
        });
    }

    setupSourceInfo() {
        const sourcesEl = this.wrapperEl.querySelector(".sources");
        if (sourcesEl) {
            sourcesEl.textContent = Utils.formatSourceList(this.sources);
        }
    }

    setupExportButton() {
        const saveBtn = this.wrapperEl.querySelector(".save-chart");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => this.export());
        }
    }

    export() {
        const chartContainerEl = this.wrapperEl.querySelector(".chart-container");
        const renderingOptions = { pixelRatio: 5, backgroundColor: "#fff" };

        htmlToImage
            .toBlob(chartContainerEl, renderingOptions)
            .then((blob) => {
                saveAs(blob, `${this.chartEl.dataset.indicator}.png`);
            })
            .catch((err) => {
                console.error("Failed to save image", err);
            });
    }

    getSelectedLocations() {
        const selectedLocationsEl = this.wrapperEl.querySelector(".selected-locations");
        if (!selectedLocationsEl) return this.dataset.map(d => d.location);

        return Array.from(selectedLocationsEl.querySelectorAll("input:checked"))
            .map(input => input.id);
    }

    render() {
        throw new Error("render method must be implemented by subclass");
    }

    updateVisualization() {
        throw new Error("updateVisualization method must be implemented by subclass");
    }
}

// Line chart implementation
class LineChartVisualizer extends BaseChartVisualizer {
    constructor(wrapperEl, chartEl) {
        super(wrapperEl, chartEl);
        this.chart = null;
    }

    async fetchData() {
        const locationCodes = this.chartEl.dataset.locations.split(",");
        const timeStart = new Date(this.chartEl.dataset.timeStart);
        const timeEnd = new Date(this.chartEl.dataset.timeEnd);
        const indicator = this.chartEl.dataset.indicator;

        const result = await DataService.fetchDataPoints(
            indicator, timeStart, timeEnd, locationCodes
        );

        this.dataset = result.dataset;
        this.sources = result.sources;
    }

    render() {
        this.chart = echarts.init(this.chartEl, null, { renderer: "svg" });

        const timeStart = new Date(this.chartEl.dataset.timeStart);
        const timeEnd = new Date(this.chartEl.dataset.timeEnd);

        const option = {
            series: this.generateSeries(),
            grid: {
                top: 10,
                bottom: 0,
                left: 0,
                right: 0,
                containLabel: true,
            },
            xAxis: {
                data: Array.from(
                    { length: timeEnd.getFullYear() - timeStart.getFullYear() + 1 },
                    (_, i) => timeStart.getFullYear() + i,
                ),
            },
            yAxis: {
                min: (value) => {
                    const range = value.max - value.min;
                    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
                    return Math.floor(value.min / magnitude) * magnitude;
                },
                splitLine: {
                    lineStyle: {
                        type: "dashed",
                    }
                }
            },
            color: COLOR_PALETTE.line,
            tooltip: {
                trigger: "axis",
            },
            dataZoom: {
                show: true,
                type: "inside",
                start: 0,
                end: 100
            },
        };

        this.chart.setOption(option);

        window.addEventListener("resize", () => {
            this.chart.resize();
        });
    }

    generateSeries() {
        const selectedLocations = this.getSelectedLocations();

        return this.dataset
            .filter(data => selectedLocations.includes(data.location))
            .map(data => ({
                name: data.location,
                type: "line",
                data: data.data,
                showSymbol: false,
                itemStyle: {
                    color: data.color
                },
                endLabel: {
                    show: true,
                    formatter: "{a}",
                    distance: 1,
                    minMargin: 2,
                },
                labelLayout(_) {
                    return {
                        align: "right",
                        moveOverlap: "shiftY",
                    }
                },
                emphasis: {
                    focus: "series"
                },
            }));
    }

    updateVisualization() {
        const series = this.generateSeries();
        this.chart.setOption({ series }, { replaceMerge: ["series"] });
    }
}

// Services for data fetching and caching
class DataService {
    static async fetchDataPoints(indicator, start, end, locationCodes) {
        const locationsStr = locationCodes.join(",");
        const startStr = start.toISOString().split("T")[0];
        const endStr = end.toISOString().split("T")[0];
        const queryStr = `/query?indicator=${indicator}&start=${startStr}&end=${endStr}&locations=${locationsStr}`;

        try {
            const locationNames = await this.fetchLocationNames(locationCodes);

            const dataResponse = await fetch(API_URL + queryStr);
            if (!dataResponse.ok) {
                throw new Error(`API request failed with status ${dataResponse.status}`);
            }

            const rawData = await dataResponse.json();
            const sources = await this.fetchSourceInfo(rawData);

            let i = 0;
            const dataset = [];
            for (const locationCode in rawData) {
                dataset.push({
                    location: locationNames[locationCode] || locationCode,
                    data: rawData[locationCode].map(point => point.numeric_value),
                    color: COLOR_PALETTE.line[i % COLOR_PALETTE.line.length],
                });
                i++;
            }

            dataset.sort((a, b) => a.location.localeCompare(b.location));
            return { dataset, sources };
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error;
        }
    }

    static async fetchLocationNames(locationCodes) {
        const locationNames = {};
        await Promise.all(locationCodes.map(async (code) => {
            const path = "/locations/" + code;
            const locData = CacheService.getFromCache(path);

            if (locData) {
                locationNames[code] = locData.name;
                return;
            }

            try {
                const locResponse = await fetch(API_URL + path);
                if (locResponse.ok) {
                    const locData = await locResponse.json();
                    locationNames[code] = locData.name;
                    CacheService.saveToCache(path, locData, CACHE_DURATION.TWO_WEEKS);
                } else {
                    locationNames[code] = code;
                }
            } catch (error) {
                locationNames[code] = code;
                console.error(`Failed to fetch location name for ${code}:`, error);
            }
        }));

        return locationNames;
    }

    static async fetchSourceInfo(rawData) {
        const sourceFrequency = {};
        Object.values(rawData).forEach(dataPoints => {
            dataPoints.forEach(point => {
                if (point.source_id) {
                    sourceFrequency[point.source_id] = (sourceFrequency[point.source_id] || 0) + 1;
                }
            });
        });

        const sourceInfoMap = {};
        const sourceIds = Object.keys(sourceFrequency);

        await Promise.all(sourceIds.map(async (sourceId) => {
            try {
                const path = "/sources/" + sourceId;
                const sourceData = CacheService.getFromCache(path);

                if (sourceData) {
                    sourceInfoMap[sourceId] = {
                        ...sourceData,
                        year: new Date(sourceData.date).getFullYear(),
                        frequency: sourceFrequency[sourceId]
                    };
                    return;
                }

                const response = await fetch(`${API_URL}/sources/${sourceId}`);
                if (response.ok) {
                    const sourceData = await response.json();
                    sourceInfoMap[sourceId] = {
                        ...sourceData,
                        year: new Date(sourceData.date).getFullYear(),
                        frequency: sourceFrequency[sourceId]
                    };

                    CacheService.saveToCache(path, sourceData, CACHE_DURATION.ONE_WEEK);
                }
            } catch (error) {
                console.error(`Error fetching source info for ${sourceId}:`, error);
            }
        }));

        return Object.values(sourceInfoMap).sort((a, b) => b.frequency - a.frequency);
    }
}

// Cache utilities
class CacheService {
    static saveToCache(key, data, expiryHours, jitter = 0.2) {
        try {
            // Add jitter to prevent hammering the API when
            // everything expires at the same time
            expiryHours += Utils.getRandomInt(jitter * expiryHours);
            const item = {
                data: data,
                expiry: Date.now() + (expiryHours * 60 * 60 * 1000)
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            if (error instanceof DOMException &&
                (error.code === 22 || error.code === 1014 ||
                    error.name === 'QuotaExceededError' ||
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                localStorage.clear();
            }
        }
    }

    static getFromCache(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const parsedItem = JSON.parse(item);
        if (Date.now() > parsedItem.expiry) {
            localStorage.removeItem(key);
            return null;
        }

        return parsedItem.data;
    }
}

// Utility functions
class Utils {
    static formatSourceList(sources) {
        if (!sources || sources.length === 0) {
            return "...";
        }

        const formatSource = (source) => `${source.name} (${source.year})`;
        if (sources.length === 1) {
            return formatSource(sources[0]);
        }

        if (sources.length <= 3) {
            return sources.map(formatSource).join(", ");
        }

        return sources.slice(0, 3).map(formatSource).join(", ") + ", et al.";
    }

    static getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }
}
