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
                throw new Error(`Unsupported chart type: ${type}`);
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
        this.locations = {};
        this.regions = {};

        this.urlParams = new URLSearchParams(window.location.search);
        this.locationCodes = [];
        this.regionCodes = [];
    }

    async initialize() {
        this.applyURLParams();
        this.locationCodes = this.chartEl.dataset.locations.split(",");
        this.regionCodes = this.chartEl.dataset.regions.split(",");

        await this.prefetchData();
        await this.setupUI();
        await this.render();
    }

    applyURLParams() {
        throw new Error("applyURLParams method must be implemented by subclass");
    }

    updateURLParams() {
        throw new Error("updateURLParams method must be implemented by subclass");
    }

    async prefetchData() {
        throw new Error("prefetchData method must be implemented by subclass");
    }

    async setupUI() {
        await this.setupLocationSelectors();
        this.setupExportButton();
    }

    async setupLocationSelectors() {
        const selectedLocationsEl = this.wrapperEl.querySelector(".selected-locations");
        selectedLocationsEl.innerHTML = "";

        await Promise.all(this.regions["AF"].locations.map(async (location) => {
            const container = document.createElement("div");
            container.className = "flex items-center p-3";

            const locations = await DataService.fetchLocations([location.location_code]);
            const locationName = locations[location.location_code].name;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = location.location_code;
            checkbox.checked = this.locationCodes.includes(location.location_code);
            checkbox.className = "mr-3 h-4 w-4";
            checkbox.addEventListener("change", async () => await this.updateVisualization());

            const label = document.createElement("label");
            label.htmlFor = location.location_code;
            label.className = "text-sm text-gray-600";
            label.textContent = locationName;

            container.appendChild(checkbox);
            container.appendChild(label);

            selectedLocationsEl.appendChild(container);
        }));
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

        const selected = Array.from(selectedLocationsEl.querySelectorAll("input:checked")).map(input => input.id);
        if (selected.length == 0) {
            return this.locationCodes;
        }
        return selected;
    }

    async render() {
        throw new Error("render method must be implemented by subclass");
    }

    async updateVisualization() {
        throw new Error("updateVisualization method must be implemented by subclass");
    }
}

// Line chart
class LineChartVisualizer extends BaseChartVisualizer {
    constructor(wrapperEl, chartEl) {
        super(wrapperEl, chartEl);
        this.chart = null;

        this.indicator = this.chartEl.dataset.indicator;
        this.timeStart = new Date(this.chartEl.dataset.timeStart);
        this.timeEnd = new Date(this.chartEl.dataset.timeEnd);
    }

    applyURLParams() {
        const timeStart = this.urlParams.get("start");
        if (timeStart) {
            this.chartEl.dataset.timeStart = timeStart;
        }

        const timeEnd = this.urlParams.get("end");
        if (timeEnd) {
            this.chartEl.dataset.timeEnd = timeEnd;
        }

        const locations = this.urlParams.get("locations");
        if (locations) {
            this.chartEl.dataset.locations = locations.split("~").join(",");
        }

        const regions = this.urlParams.get("regions");
        if (regions) {
            this.chartEl.dataset.regions = regions.split("~").join(",");
        }

        console.log(this.chartEl.dataset);
    }

    updateURLParams() {
        this.urlParams.set("start", this.timeStart.getFullYear());
        this.urlParams.set("end", this.timeEnd.getFullYear());
        this.urlParams.set("locations", this.locationCodes.join("~"))
        this.urlParams.set("regions", this.regionCodes.join("~"))

        history.pushState(null, null, "?"+this.urlParams.toString());
    }

    async prefetchData() {
        this.regions = await DataService.fetchRegions(this.regionCodes);
    }

    async render() {
        this.chart = echarts.init(this.chartEl, null, { renderer: "svg" });

        const option = {
            series: await this.generateSeries(),
            grid: {
                top: 10,
                bottom: 0,
                left: 0,
                right: 0,
                containLabel: true,
            },
            xAxis: {
                data: Array.from(
                    { length: this.timeEnd.getFullYear() - this.timeStart.getFullYear() + 1 },
                    (_, i) => this.timeStart.getFullYear() + i,
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

        this.setupSourceInfo();
    }

    async generateSeries() {
        this.locationCodes = this.getSelectedLocations();
        const result = await DataService.fetchDataPoints(
            this.indicator,
            this.timeStart,
            this.timeEnd,
            this.locationCodes,
        );

        this.dataset = result.dataset;
        this.sources = result.sources;
        this.locations = result.locations;

        return this.dataset
            .map(data => ({
                name: data.name,
                type: "line",
                data: data.data,
                showSymbol: false,
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

    async updateVisualization() {
        const series = await this.generateSeries();
        this.chart.setOption({ series }, { replaceMerge: ["series"] });

        this.updateURLParams();
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
            const locations = await this.fetchLocations(locationCodes);

            const response = await fetch(API_URL + queryStr);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const rawData = await response.json();
            const sources = await this.fetchSourceInfo(rawData);

            let i = 0;
            const dataset = [];
            for (const locationCode in rawData) {
                dataset.push({
                    code: locationCode,
                    name: locations[locationCode].name,
                    data: rawData[locationCode].map(point => point.numeric_value),
                });
                i++;
            }

            dataset.sort((a, b) => a.name.localeCompare(b.name));
            return { dataset, sources, locations };
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error;
        }
    }

    static async fetchLocations(locationCodes) {
        const locations = {};
        await Promise.all(locationCodes.map(async (code) => {
            const path = "/locations/" + code;
            const data = CacheService.getFromCache(path);

            if (data) {
                locations[code] = data;
                return;
            }

            try {
                const response = await fetch(API_URL + path);
                if (response.ok) {
                    const data = await response.json();
                    locations[code] = data;
                    CacheService.saveToCache(path, data, CACHE_DURATION.TWO_WEEKS);
                } else {
                    throw new Error(`API request failed with status ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to fetch location with ${code}:`, error);
                throw error;
            }
        }));

        return locations;
    }

    static async fetchRegions(regionCodes) {
        if (!regionCodes.includes("AF")) {
            regionCodes.push("AF");
        }

        const regions = {};
        await Promise.all(regionCodes.map(async (code) => {
            const path = "/regions/" + code;
            const data = CacheService.getFromCache(path);

            if (data) {
                regions[code] = data;
                return;
            }

            try {
                const response = await fetch(API_URL + path);
                if (response.ok) {
                    const data = await response.json();
                    regions[code] = data;
                    CacheService.saveToCache(path, data, CACHE_DURATION.TWO_WEEKS);
                } else {
                    throw new Error(`API request failed with status ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to fetch region with ${code}:`, error);
                throw error;
            }
        }));

        return regions;
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
