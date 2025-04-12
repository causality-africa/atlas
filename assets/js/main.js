const API_URL = window.siteConfig.apiUrl;

const COLOR_PALETTE = {
    line: [
        "#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e",
        "#17becf", "#e377c2", "#8c564b", "#bcbd22", "#7f7f7f"
    ],
};

const CACHE_DURATION = { // In hours
    ONE_DAY: 24,
    ONE_WEEK: 24 * 7,
    TWO_WEEKS: 24 * 14,
};

const URLParams = {
    get() {
        return new URLSearchParams(window.location.search);
    },

    update(updates) {
        const params = this.get();
        for (const [key, value] of Object.entries(updates)) {
            params.set(key, value);
        }
        history.pushState(null, null, "?" + params.toString());

        document.dispatchEvent(new CustomEvent("urlParamsChanged"));
    }
};


document.addEventListener("DOMContentLoaded", async () => {
    const chartWrapperEls = document.querySelectorAll(".chart-container-wrapper");
    for (const wrapperEl of chartWrapperEls) {
        const chartEl = wrapperEl.querySelector(".chart-container .chart");
        const chartType = chartEl.dataset.chartType || "line";

        const visualizer = ChartFactory.create(chartType, wrapperEl, chartEl);
        await visualizer.initialize();
    }

    const tableEls = document.querySelectorAll(".data-table");
    for (const tableEl of tableEls) {
        const tableVisualizer = new TableVisualizer(tableEl);
        await tableVisualizer.initialize();
    }
});

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

class BaseChartVisualizer {
    constructor(wrapperEl, chartEl) {
        this.wrapperEl = wrapperEl;
        this.chartEl = chartEl;

        this.dataset = [];
        this.sources = [];

        this.timeStart = new Date(this.chartEl.dataset.timeStart);
        this.timeEnd = new Date(this.chartEl.dataset.timeEnd);

        this.region = null;
        this.regionCode = this.chartEl.dataset.region;

        this.locations = {};
        this.locationCodes = this.chartEl.dataset.locations.split(",");

        document.addEventListener("urlParamsChanged", () => this.syncFromURL());
    }

    async initialize() {
        this.syncFromURL();

        await this.fetchData();
        await this.setupUI();
        await this.render();
    }

    syncFromURL() {
        const params = URLParams.get();
        let needsUpdate = false;

        if (params.has("start")) {
            this.chartEl.dataset.timeStart = params.get("start");
            this.timeStart = new Date(this.chartEl.dataset.timeStart);
            needsUpdate = true;
        }

        if (params.has("end")) {
            this.chartEl.dataset.timeEnd = params.get("end");
            this.timeEnd = new Date(this.chartEl.dataset.timeEnd);
            needsUpdate = true;
        }

        if (params.has("region")) {
            this.regionCode = this.chartEl.dataset.region = params.get("region").toUpperCase();
            needsUpdate = true;
        }

        if (params.has("locations")) {
            this.chartEl.dataset.locations = params.get("locations").toUpperCase().split(".").join(",");
            this.locationCodes = this.chartEl.dataset.locations.split(",")
            needsUpdate = true;
        }

        if (needsUpdate && this.chart) {
            this.fetchData().then(() => this.render());
        }
    }

    updateURLParams() {
        URLParams.update({
            start: this.timeStart.toISOString().split("T")[0],
            end: this.timeEnd.toISOString().split("T")[0],
            locations: this.locationCodes.join("."),
            region: this.regionCode
        });
    }

    async fetchData() {
        throw new Error("fetchData method must be implemented by subclass");
    }

    async setupUI() {
        await this.setupLocationSelectors();
        this.setupExportButton();
    }

    async setupLocationSelectors() {
        const selectedLocationsEl = this.wrapperEl.querySelector(".selected-locations");
        selectedLocationsEl.innerHTML = "";

        for (const location of [this.region, ...this.region.children]) {
            const container = document.createElement("div");
            container.className = "flex items-center p-3";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = location.code;
            checkbox.checked = this.locationCodes.includes(location.code);
            checkbox.className = "mr-3 h-4 w-4";
            checkbox.addEventListener("change", async () => await this.updateVisualization());

            const label = document.createElement("label");
            label.htmlFor = location.code;
            label.className = "text-sm text-gray-600";
            label.textContent = location.name;

            container.appendChild(checkbox);
            container.appendChild(label);

            selectedLocationsEl.appendChild(container);
        }
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

class LineChartVisualizer extends BaseChartVisualizer {
    constructor(wrapperEl, chartEl) {
        super(wrapperEl, chartEl);
        this.chart = null;

        this.indicator = this.chartEl.dataset.indicator;
    }

    async fetchData() {
        const result = await DataService.fetchIndicatorData(
            this.indicator,
            this.timeStart,
            this.timeEnd,
            this.regionCode,
        );

        this.dataset = result.dataset;
        this.sources = result.sources;
        this.region = result.region;
        this.locations = result.locations;
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
        const filteredDataset = this.dataset.filter(data =>
            this.locationCodes.includes(data.code)
        );

        return filteredDataset
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


class TableVisualizer {
    constructor(tableEl) {
        this.tableEl = tableEl;

        this.sources = [];
        this.datasetByIndicator = {};

        this.indicators = this.tableEl.dataset.indicators.split(",");
        this.units = this.tableEl.dataset.units.split(",")

        this.timeStart = new Date(this.tableEl.dataset.timeStart);
        this.timeEnd = new Date(this.tableEl.dataset.timeEnd);
        this.currentYear = Math.min(new Date().getFullYear(), this.timeEnd.getFullYear());
        this.yearSelect = document.getElementById("year-select");

        this.locations = {};
        this.regionCode = this.tableEl.dataset.region;

        document.addEventListener("urlParamsChanged", () => this.syncFromURL());
    }

    async initialize() {
        this.syncFromURL();

        await this.setupYearSelector();
        await this.fetchData();
        this.renderTable();

        this.yearSelect.addEventListener("change", () => {
            this.currentYear = parseInt(this.yearSelect.value);
            this.renderTable();
        });
    }

    syncFromURL() {
        const params = URLParams.get();
        let needsUpdate = false;

        if (params.has("start")) {
            this.tableEl.dataset.timeStart = params.get("start");
            this.timeStart = new Date(this.tableEl.dataset.timeStart);
            needsUpdate = true;
        }

        if (params.has("end")) {
            this.timeEnd = this.tableEl.dataset.timeEnd = params.get("end");
            this.timeEnd = new Date(this.tableEl.dataset.timeEnd);
            this.currentYear = this.timeEnd.getFullYear();
            needsUpdate = true;
        }

        if (params.has("region")) {
            this.regionCode = this.tableEl.dataset.region = params.get("region");
            needsUpdate = true;
        }

        if (needsUpdate && this.tableEl.querySelector("tbody")) {
            this.fetchData().then(() => this.renderTable());
        }
    }

    async setupYearSelector() {
        this.yearSelect.innerHTML = "";

        const startYear = this.timeStart.getFullYear();
        const endYear = this.timeEnd.getFullYear();

        for (let year = endYear; year >= startYear; year--) {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            this.yearSelect.appendChild(option);
        }

        this.yearSelect.value = this.currentYear;
    }

    async fetchData() {
        try {
            const result = await DataService.fetchMultiIndicatorData(
                this.indicators,
                this.timeStart,
                this.timeEnd,
                this.regionCode,
            );

            this.datasetByIndicator = result.datasetByIndicator;
            this.sources = result.sources;
            this.locations = result.locations;
        } catch (error) {
            console.error("Error fetching data for table:", error);
            this.renderErrorState();
        }
    }

    renderTable() {
        const headerRow = this.tableEl.querySelector("thead tr");
        headerRow.innerHTML = "";

        const counterHeader = document.createElement("th");
        counterHeader.textContent = "#";
        counterHeader.className = "px-3 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider";
        headerRow.appendChild(counterHeader);

        const countryHeader = document.createElement("th");
        countryHeader.textContent = "Country";
        countryHeader.className = "px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider";
        headerRow.appendChild(countryHeader);

        this.indicators.forEach((column, index) => {
            const th = document.createElement("th");
            th.textContent = `${this.formatColumnName(column)} (${this.units[index]})`;
            th.className = "px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider";
            headerRow.appendChild(th);
        });

        const tbody = this.tableEl.querySelector("tbody");
        tbody.innerHTML = "";

        const yearIndex = this.currentYear - this.timeStart.getFullYear();

        const baseDataset = this.datasetByIndicator[this.indicators[0]] || [];

        const dataByLocationAndIndicator = {};

        this.indicators.forEach(column => {
            dataByLocationAndIndicator[column] = {};
            (this.datasetByIndicator[column] || []).forEach(item => {
                dataByLocationAndIndicator[column][item.code] = item.data;
            });
        });

        baseDataset.forEach((country, index) => {
            const tr = document.createElement("tr");
            tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
            tr.classList.add("hover:bg-gray-100");

            const counterCell = document.createElement("td");
            counterCell.textContent = index + 1;
            counterCell.className = "px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900";
            tr.appendChild(counterCell);

            const countryCell = document.createElement("td");
            countryCell.textContent = country.name;
            countryCell.className = "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900";
            tr.appendChild(countryCell);

            this.indicators.forEach(column => {
                const td = document.createElement("td");
                td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900";

                const dataForIndicator = dataByLocationAndIndicator[column][country.code];
                const value = dataForIndicator ? dataForIndicator[yearIndex] : null;

                td.textContent = this.formatValue(value);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        const sourcesEl = document.querySelector(".table-sources");
        if (sourcesEl) {
            sourcesEl.textContent = Utils.formatSourceList(this.sources);
        }
    }

    renderErrorState() {
        const tbody = this.tableEl.querySelector("tbody");
        tbody.innerHTML = "";

        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = this.indicators.length + 1;
        td.className = "px-6 py-4 text-center text-sm text-red-500";
        td.textContent = "Error loading data. Please try again later.";

        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    formatColumnName(column) {
        return column.split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    formatValue(value) {
        if (value === undefined || value === null) {
            return "—";
        }

        return new Intl.NumberFormat().format(value);
    }
}

class DataService {
    static async fetchGeoEntity(code) {
        const path = "/geo/" + code;
        let data = CacheService.getFromCache(path);
        if (data) {
            return data;
        }

        try {
            const response = await fetch(API_URL + path);
            if (response.ok) {
                data = await response.json();

                CacheService.saveToCache(path, data, CACHE_DURATION.TWO_WEEKS);
            } else {
                throw new Error(`API request failed with status ${response.status}`);
            }
        } catch (error) {
            console.error(`Failed to fetch region with ${code}:`, error);
            throw error;
        }

        return data;
    }

    static async fetchGeoEntities(codes) {
        const geoEntities = {};

        await Promise.all(codes.map(async (code) => {
            geoEntities[code] = await DataService.fetchGeoEntity(code);
        }))

        return geoEntities;
    }

    static async fetchIndicatorData(
        indicator,
        timeStart,
        timeEnd,
        regionCode,
    ) {
        const result = await this.fetchMultiIndicatorData(
            [indicator],
            timeStart,
            timeEnd,
            regionCode,
        )
        return {
            dataset: result.datasetByIndicator[indicator],
            sources: result.sources,
            region: result.region,
            geoEntities: result.geoEntities,
        }
    }

    static async fetchMultiIndicatorData(
        indicators,
        timeStart,
        timeEnd,
        regionCode,
    ) {
        const region = await this.fetchGeoEntity(regionCode);
        const geoEntities = [regionCode, ...region.children.map((entity) => entity.code)];

        const batches = [];
        for (let i = 0; i < geoEntities.length; i += 50) {
            batches.push(geoEntities.slice(i, i + 50));
        }

        let allSources = [];
        const datasetByIndicator = {};
        for (const indicator of indicators) {
            let datasetForIndicator = [];

            for (const batch of batches) {
                const result = await this.fetchDataPoints(
                    indicator,
                    timeStart,
                    timeEnd,
                    batch
                );

                datasetForIndicator = [...datasetForIndicator, ...result.dataset];
                allSources = [...allSources, ...result.sources];
            }

            datasetForIndicator.sort((a, b) => a.name.localeCompare(b.name));
            datasetByIndicator[indicator] = datasetForIndicator;
        }

        const dedupedSources = this.deduplicateSources(allSources);

        return {
            datasetByIndicator,
            sources: dedupedSources,
            region,
            geoEntities,
        };
    }

    static async fetchDataPoints(indicator, start, end, geoCodes) {
        const geoCodesStr = geoCodes.join(",");
        const startStr = start.toISOString().split("T")[0];
        const endStr = end.toISOString().split("T")[0];
        const queryStr = `/query?indicator=${indicator}&start=${startStr}&end=${endStr}&geo_codes=${geoCodesStr}`;

        const data = CacheService.getFromCache(queryStr);
        if (data) {
            return data;
        }

        try {
            const geoEntities = await DataService.fetchGeoEntities(geoCodes);
            const response = await fetch(API_URL + queryStr);

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const rawData = await response.json();
            const sources = await this.fetchSourceInfo(rawData);

            const startYear = start.getFullYear();
            const endYear = end.getFullYear();
            const yearCount = endYear - startYear + 1;
            const dataset = Object.entries(rawData).map(([geoCode, dataPoints]) => {
                const alignedData = Array(yearCount).fill(null);

                dataPoints.forEach(point => {
                    const pointYear = new Date(point.date).getFullYear();
                    const index = pointYear - startYear;
                    if (index >= 0 && index < yearCount) {
                        alignedData[index] = point.numeric_value;
                    }
                });

                return {
                    code: geoCode,
                    name: geoEntities[geoCode].name,
                    data: alignedData
                };
            });

            const result = { dataset, sources, geoEntities };

            CacheService.saveToCache(queryStr, result, CACHE_DURATION.ONE_DAY);

            return result;
        } catch (error) {
            console.error("Error fetching data:", error);
            throw error;
        }
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
                        year: new Date(sourceData.last_updated).getFullYear(),
                        frequency: sourceFrequency[sourceId]
                    };
                    return;
                }

                const response = await fetch(`${API_URL}/sources/${sourceId}`);
                if (response.ok) {
                    const sourceData = await response.json();
                    sourceInfoMap[sourceId] = {
                        ...sourceData,
                        year: new Date(sourceData.last_updated).getFullYear(),
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

    static deduplicateSources(sources) {
        const sourceIds = new Set();
        return sources.filter(source => {
            if (sourceIds.has(source.id)) {
                return false;
            }
            sourceIds.add(source.id);
            return true;
        });
    }
}

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

class Utils {
    static formatSourceList(sources) {
        if (!sources || sources.length === 0) {
            return "...";
        }

        if (sources.length > 1) {
            sources = sources.filter((source) => source.name != "Derived")
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
