document.addEventListener("DOMContentLoaded", () => {
    const charts = document.querySelectorAll(".chart-container");

    charts.forEach(chartContainer => {
        const chart = echarts.init(chartContainer);

        const testData = [
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

        const option = {
            title: {
                text: chartContainer.dataset.title,
                top: 20,
                left: 15,
                textStyle: {
                    overflow: "break",
                },

                subtext: chartContainer.dataset.description,
                subtextStyle: {
                    fontStyle: "oblique",
                    overflow: "break",
                    fontSize: 14,
                }
            },
            xAxis: {
                name: chartContainer.dataset.xLabel,
                nameTextStyle: {
                    fontWeight: "bold",
                },
                data: Array.from({ length: 65 }, (_, i) => 1960 + i),
            },
            yAxis: {
                name: chartContainer.dataset.yLabel,
                nameTextStyle: {
                    fontWeight: "bold",
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        type: "dashed",
                    }
                }
            },
            grid: {
                top: 110,
                left: 20,
                containLabel: true,
            },
            series: testData.map(data => ({
                name: data.location,
                type: "line",
                data: data.data,
                showSymbol: false,
                endLabel: {
                    show: true,
                    formatter: "{a}",
                },
                emphasis: {
                    focus: "series"
                },
            })),
            tooltip: {
                trigger: "axis",
            },
            dataZoom: {
                show: chartContainer.dataset.slider.toLowerCase() === "true",
                type: "inside",
                start: 0,
                end: 100
            },
            toolbox: {
                feature: {
                    saveAsImage: {
                        show: true,
                        title: "Save",
                        excludeComponents: ["toolbox", "dataZoom"],
                        pixelRatio: 4,
                    },
                }
            },
            textStyle: {
                fontFamily: "Source Sans Pro",
            },
            graphic: [
                {
                    type: "image",
                    right: 80,
                    top: 20,
                    bounding: "raw",
                    style: {
                        image: "/images/logo.png",
                        width: 40,
                        height: 40,
                        opacity: 0.9
                    }
                },
                {
                    type: "text",
                    right: 30,
                    top: 35,
                    style: {
                        text: "{text|Causality}",
                        rich: {
                            text: {
                                fontWeight: "bold",
                                fill: "#333"
                            },
                        }
                    }
                },
                {
                    type: "text",
                    right: 30,
                    bottom: 20,
                    style: {
                        text: "{text|causality.africa} | CC BY 4.0",
                        rich: {
                            text: {
                                fontWeight: "bold",
                                fontStyle: "italic",
                                fill: "#333"
                            },
                        }
                    }
                },
                {
                    type: "text",
                    left: 25,
                    bottom: 20,
                    style: {
                        text: [
                            "{bold|Note:}",
                            `{text|${chartContainer.dataset.note}}`,
                        ].join(" "),
                        rich: {
                            bold: {
                                fontWeight: "bold",
                                fill: "#545454"
                            },
                            text: {
                                fill: "#545454"
                            },
                        }
                    }
                },
                {
                    type: "text",
                    right: 30,
                    bottom: 40,
                    style: {
                        text: [
                            "{bold|Source:}",
                            "{text|World Bank (2025)}"
                        ].join(" "),
                        rich: {
                            bold: {
                                fontWeight: "bold",
                                fill: "#333"
                            },
                            text: {
                                fill: "#333"
                            }
                        }
                    }
                }
            ],
        };

        chart.setOption(option);

        window.addEventListener("resize", function () {
            chart.resize();
        });
    });
});
