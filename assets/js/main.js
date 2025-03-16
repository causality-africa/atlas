document.addEventListener("DOMContentLoaded", () => {
    const chartContainer = document.getElementById("chart-container");
    const chart = echarts.init(chartContainer, null, { renderer: "svg" });

    const dataset = [
        {
            location: "Kenya",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 1000 + (i * 45);
                const volatility = Math.sin(i * 0.5) * 400 + (Math.random() - 0.5) * 300;
                const crisis = i % 15 === 0 ? -400 : (i % 20 === 0 ? 500 : 0);
                return Math.max(100, Math.round(baseValue + volatility + crisis));
            })
        },
        {
            location: "Ethiopia",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 300 + (i * 25);
                const volatility = Math.cos(i * 0.4) * 350 + (Math.random() - 0.5) * 250;
                const crisis = i % 12 === 0 ? -300 : (i % 18 === 0 ? 400 : 0);
                return Math.max(100, Math.round(baseValue + volatility + crisis));
            })
        },
        {
            location: "Sub Saharan Africa",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 600 + (i * 40);
                const volatility = Math.sin(i * 0.3) * 450 + (Math.random() - 0.5) * 400;
                const crisis = i % 14 === 0 ? -500 : (i % 19 === 0 ? 600 : 0);
                return Math.max(200, Math.round(baseValue + volatility + crisis));
            })
        },
        {
            location: "South Africa",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 2000 + (i * 100);
                const volatility = Math.sin(i * 0.6) * 800 + (Math.random() - 0.5) * 600;
                const crisis = i % 16 === 0 ? -800 : (i % 21 === 0 ? 1000 : 0);
                return Math.max(500, Math.round(baseValue + volatility + crisis));
            })
        },
        {
            location: "Rwanda",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 400 + (i * 20);
                const volatility = Math.cos(i * 0.7) * 300 + (Math.random() - 0.5) * 200;
                const crisis = i % 13 === 0 ? -250 : (i % 17 === 0 ? 350 : 0);
                return Math.max(100, Math.round(baseValue + volatility + crisis));
            })
        },
        {
            location: "Egypt",
            data: Array.from({ length: 65 }, (_, i) => {
                const baseValue = 1000 + (i * 50);
                const volatility = Math.sin(i * 0.45) * 500 + (Math.random() - 0.5) * 400;
                const crisis = i % 15 === 0 ? -600 : (i % 20 === 0 ? 700 : 0);
                return Math.max(300, Math.round(baseValue + volatility + crisis));
            })
        }
    ];

    const selectedLocationsEl = document.getElementById("selected-locations");
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
        label.className = "text-gray-800";
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
            data: Array.from({ length: 65 }, (_, i) => 1960 + i),
        },
        yAxis: {
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

    document.getElementById("save-chart").addEventListener("click", () => {
        const chartContainerWrapper = document.getElementById("chart-container-wrapper");
        const renderingOptions = { pixelRatio: 5, backgroundColor: "#fff" };

        htmlToImage
            .toBlob(chartContainerWrapper, renderingOptions)
            .then((blob) => {
                saveAs(blob, `${chartContainer.dataset.yIndicator}.png`);
            })
            .catch((err) => {
                console.error("Failed to save image", err);
            });
    });

    function generateSeries(initial = false) {
        const selectedLocations = Array.from(document.querySelectorAll("#selected-locations input:checked"))
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

        console.log(initial)

        if (!initial) {
            console.log(filteredSeries)
            chart.setOption({ series: filteredSeries }, { replaceMerge: ["series"] });
        }

        return filteredSeries;
    }
});
