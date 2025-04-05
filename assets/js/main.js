const API_URL = "https://api.causality.africa/v1";

document.addEventListener("DOMContentLoaded", async () => {
    const wrapperEls = document.getElementsByClassName("chart-container-wrapper");
    for (const wrapperEl of wrapperEls) {
        renderChart(wrapperEl);
    }
});


// Chart handlers

async function renderChart(wrapperEl) {
    const chartContainerEl = wrapperEl.querySelector(".chart-container");
    const chartEl = chartContainerEl.querySelector(".chart");

    const chart = echarts.init(chartEl, null, { renderer: "svg" });

    const locationCodes = chartEl.dataset.locations.split(",");
    const timeStart = new Date(chartEl.dataset.timeStart);
    const timeEnd = new Date(chartEl.dataset.timeEnd);

    const dataset = await getDataPoints(
        chartEl.dataset.indicator,
        timeStart,
        timeEnd,
        locationCodes,
    );

    const selectedLocationsEl = wrapperEl.querySelector(".selected-locations");
    dataset.forEach(data => {
        const container = document.createElement("div");
        container.className = "flex items-center p-3";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = data.location;
        checkbox.checked = true;
        checkbox.className = "mr-3 h-4 w-4";
        checkbox.addEventListener("change", () => generateSeries());

        const label = document.createElement("label");
        label.htmlFor = data.location;
        label.className = "text-sm text-gray-600";
        label.textContent = data.location;

        container.appendChild(checkbox);
        container.appendChild(label);

        selectedLocationsEl.appendChild(container);
    });

    const option = {
        series: generateSeries(true),
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

    chart.setOption(option);

    window.addEventListener("resize", function () {
        chart.resize();
    });

    wrapperEl.querySelector(".save-chart").addEventListener("click", () => {
        const renderingOptions = { pixelRatio: 5, backgroundColor: "#fff" };

        htmlToImage
            .toBlob(chartContainerEl, renderingOptions)
            .then((blob) => {
                saveAs(blob, `${chartEl.dataset.indicator}.png`);
            })
            .catch((err) => {
                console.error("Failed to save image", err);
            });
    });

    function generateSeries(initial = false) {
        const selectedLocations = Array.from(selectedLocationsEl.querySelectorAll("input:checked"))
            .map(input => input.id);

        const filteredSeries = dataset
            .filter(data => selectedLocations.includes(data.location))
            .map(data => ({
                name: data.location,
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

        if (!initial) {
            chart.setOption({ series: filteredSeries }, { replaceMerge: ["series"] });
        }

        return filteredSeries;
    }
}

// Utilities

async function getDataPoints(indicator, start, end, locationCodes) {
    const locationsStr = locationCodes.join(",");
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    const queryStr = `/query?indicator=${indicator}&start=${startStr}&end=${endStr}&locations=${locationsStr}`;

    try {
        const locationNames = {};
        await Promise.all(locationCodes.map(async (code) => {
            const locResponse = await fetch(`${API_URL}/locations/${code}`);
            if (locResponse.ok) {
                const locData = await locResponse.json();
                locationNames[code] = locData.name;
            } else {
                locationNames[code] = code;
            }
        }))

        const dataResponse = await fetch(API_URL + queryStr);
        if (!dataResponse.ok) {
            throw new Error(`API request failed with status ${dataResponse.status}`);
        }

        const dataset = [];
        const rawData = await dataResponse.json();
        for (const locationCode in rawData) {
            dataset.push({
                location: locationNames[locationCode] || locationCode,
                data: rawData[locationCode].map(point => point.numeric_value)
            });
        }

        return dataset;
    } catch (error) {
        console.error("Error fetching data:", error);
        throw error;
    }
}
