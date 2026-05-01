'use strict';


// global settings for all charts (randomized order)
const settings = {
    colour: {
        fade: '#8d988d',
        stroke: '#ffffff',
        main: '#b843cf',
        highlight: '#1e18c7',
        line: '#b843cf'
    },
    margin: {
        scatter: { left: 70, bottom: 70, right: 30, top: 50 },
        line: { right: 120, bottom: 60, top: 50, left: 70 },
        bar: { bottom: 60, left: 150, right: 30, top: 60 }
    },
    size: {
        scatterHeight: 620,
        scatterWidth: 1300,
        width: 680,
        barHeight: 500,
        lineHeight: 500
    }
};


// handles what is being hovered and used at a given time
const appState = {
    selectedIndustry: null,
    tooltip: null,
    selections: {
        bars: null,
        lines: null,
        linePoints: null,
        scatterPoints: null
    }
};


init();

//load the csv file and draw charts from it. here i am only using data 1a
function init() {
    d3.csv('data/data1.csv')
        .then(function (rawData) {
            const chartData = processDataset(rawData);

            appState.tooltip = createTooltip();

            drawDashboard(chartData);
            updateHighlight();
        });
    }

// This function takes raw data from d3.csv and makes objects for all charts
function processDataset(rawData) {
    cleanTable(rawData, 'Industry');

    const summaryData = makeCategorySummary(rawData);

    // ar chartb
    const barData = summaryData
        .slice()
        .sort((a, b) => d3.descending(a.growth, b.growth));

    // line chart
    const topIndustries = barData
        .slice(0, 5)
        .map(d => d.industry);

    const lineData = extractTrendData(rawData, topIndustries);

    //scatter plot has all the summary data
    const scatterData = summaryData.slice();

    return {
        barData: barData,
        lineData: lineData,
        scatterData: scatterData
    };
}

/* converts text values like low and null to 0
*/
function cleanTable(data, firstColumnName) {
    data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key === firstColumnName) {
                row[key] = +row[key];
            } else {
                row[key] = cleanValue(row[key]);
            }
        });
    });
}


function cleanValue(value) {
    if (value === '[low]' || value === '' || value === null || value === undefined) {
        return 0;
    }

    const numberValue = +String(value).replace('%', '').trim();

    if (Number.isNaN(numberValue)) {
        return 0;
    }

    return numberValue;
}


// exclude industry and total and get the columns that are actually industries
function getCategoryNames(data) {
    return Object.keys(data[0]).filter(function (key) {
        return key !== 'Industry' && key !== 'Total';
    });
}

// create one object per industry. used for tooltips and all charts 
function makeCategorySummary(data) {
    const industryNames = getCategoryNames(data);

    const firstRow = data[0];
    const lastRow = data[data.length - 1];

    return industryNames.map(function (industryName) {
        const firstValue = firstRow[industryName];
        const latestValue = lastRow[industryName];
        const growth = latestValue - firstValue;
        const totalValue = d3.sum(data, function (row) {
            return row[industryName];
        });

        return {
            industry: industryName,
            firstValue: firstValue,
            latestValue: latestValue,
            growth: growth,
            totalValue: totalValue
        };
    });
}


function extractTrendData(dataset, categories) {
    return categories.map(category => {
        const values = dataset
            .map(row => ({
                year: row.Industry,
                value: row[category],
                industry: category
            }))
            .sort((a, b) => d3.ascending(a.year, b.year));

        return {
            industry: category,
            values 
        };
    });
}


    // Calls the chart functions from the other files.
    function drawDashboard(chartData) {
    drawBarChart(chartData.barData, appState, settings);
    drawLineChart(chartData.lineData, appState, settings);
    drawScatterPlot(chartData.scatterData, appState, settings);
}




// buikd tooltip for charts 

function buildTooltipContent(item) {
    return `
        <div class="tooltip-title">${item.industry}</div>
        <div><strong>First year:</strong> ${item.firstValue.toFixed(2)}</div>
        <div><strong>Latest year:</strong> ${item.latestValue.toFixed(2)}</div>
        <div><strong>Increase:</strong> ${item.growth.toFixed(2)}</div>
        <div><strong>Total value:</strong> ${item.totalValue.toFixed(2)}</div>
    `;
}


// show details near mouse pointer
function showTooltip(event, htmlContent) {
    appState.tooltip
        .html(htmlContent)
        .style('top', (event.pageY + 14) + 'px')
        .style('left', (event.pageX + 14) + 'px')
        .style('opacity', 1);
}


// create a reusable tooltip that also removes old ones to make sure there are no duplicates 
function createTooltip() {
    d3.selectAll('.tooltip').remove();

    return d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('opacity', 0)
        .style('pointer-events', 'none');
}


function hideTooltip() {
    appState.tooltip
        .style('opacity', 0);
}


function moveTooltip(event) {
    appState.tooltip
        .style('top', (event.pageY + 14) + 'px')
        .style('left', (event.pageX + 14) + 'px');
}



// sees what indutry is hovered and matches that in all charts
function setHighlight(industryName) {
    appState.selectedIndustry = industryName;
    updateHighlight();
}

// removes the active industry as mouse moves and makes it normal
function clearHighlight() {
    appState.selectedIndustry = null;
    updateHighlight();
}

/*
    updateHighlight()
*/

/*this function updates the appearnace of marks on all charts based on what is being hovered
ones that are the same are highlighted and the ones that aren't are faded for better visualisation
*/

function updateHighlight() {
    const activeIndustry = appState.selectedIndustry;
    const colours = settings.colour;

    // this updates scatter plot. when hovered the visualisation becomes larger, brighter and bolder
    if (appState.selections.scatterPoints) {
        appState.selections.scatterPoints
            .attr('opacity', function (d) {
                if (activeIndustry === null) return 0.85;
                return d.industry === activeIndustry ? 1 : 0.45;
            })
            .attr('r', function (d) {
                if (activeIndustry === null) return 7;
                return d.industry === activeIndustry ? 9 : 6;
            })
            .attr('stroke-width', function (d) {
                if (activeIndustry === null) return 1.5;
                return d.industry === activeIndustry ? 3 : 1.5;
            })
            .attr('fill', function (d) {
                if (activeIndustry === null) return colours.main;
                return d.industry === activeIndustry ? colours.highlight : colours.fade;
            });
    }
    // same as above for line points
    if (appState.selections.linePoints) {
        appState.selections.linePoints
            .attr('opacity', function (d) {
                if (activeIndustry === null) return 1;
                return d.industry === activeIndustry ? 1 : 0.4;
            })
            .attr('fill', function (d) {
                if (activeIndustry === null) return d.defaultColour;
                return d.industry === activeIndustry ? colours.highlight : colours.fade;
            })
            .attr('r', function (d) {
                if (activeIndustry === null) return 3.5;
                return d.industry === activeIndustry ? 5 : 3;
            });
    }

    // same as above
    if (appState.selections.bars) {
        appState.selections.bars
            .attr('opacity', function (d) {
                if (activeIndustry === null) return 0.9;
                return d.industry === activeIndustry ? 1 : 0.5;
            })
            .attr('fill', function (d) {
                if (activeIndustry === null) return colours.main;
                return d.industry === activeIndustry ? colours.highlight : colours.fade;
            });
    }

    if (appState.selections.lines) {
        appState.selections.lines
            .attr('stroke-width', function (d) {
                if (activeIndustry === null) return 3;
                return d.industry === activeIndustry ? 4.5 : 2;
            })
            .attr('opacity', function (d) {
                if (activeIndustry === null) return 0.95;
                return d.industry === activeIndustry ? 1 : 0.35;
            })
            .attr('stroke', function (d) {
                if (activeIndustry === null) return d.defaultColour;
                return d.industry === activeIndustry ? colours.highlight : colours.fade;
            });
    }
}
// helps avoid repeating the same mouse events in every chart script 
function attachHoverEvents(selection, getIndustryName, getTooltiphtmlContent) {
    selection

        .on('mouseout', function () {
            clearHighlight();
            hideTooltip();
        })

        .on('mousemove', function (event) {
            moveTooltip(event);
        })
        .on('mouseover', function (event, d) {
            setHighlight(getIndustryName(d));
            showTooltip(event, getTooltiphtmlContent(d));
        });
}

// if text is longer than 12 characters then add dots
function shortenName(name) {
    if (name.length > 16) {
        return name.slice(0, 12) + '...';
    }
    
    return name;
}