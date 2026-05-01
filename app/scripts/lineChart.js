'use strict';

function drawLineChart(data, appState, settings) {

    const width = settings.size.width;
    const height = settings.size.lineHeight;
    const margin = settings.margin.line;

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    d3.select('#line-chart').selectAll('svg').remove();

    const lineSvg = d3.select('#line-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .classed('viz linechart', true);

    const chart = lineSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // combine all line values into one list so scales can use all years and values
    const allValues = data.flatMap(function (series) {
        return series.values;
    });

    const lineColour = d3.scaleOrdinal()
        .domain(data.map(function (d) {
            return d.industry;
        }))
        .range(d3.schemeTableau10);

    data.forEach(function (d) {
        d.defaultColour = lineColour(d.industry);
    });

    // scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(allValues, function (d) {
            return d.year;
        }))
        .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
        .domain([
            0,
            d3.max(allValues, function (d) {  
                return d.value;
            })
        ])
        .nice()
        .range([chartHeight, 0]);

    // axis and labels
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format('d'));

    const yAxis = d3.axisLeft(yScale)
        .ticks(6);

    chart.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(xAxis);

    chart.append('g')
        .call(yAxis);

    chart.append('text')
        .attr('x', chartWidth / 2)  
        .attr('y', chartHeight + 42)  
        .attr('text-anchor', 'middle')
        .attr('fill', '#2e392e')
        .text('Year');

    chart.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)  
        .attr('y', -48)  
        .attr('text-anchor', 'middle')
        .attr('fill', '#2e392e')
        .text('Value');

    lineSvg.append('text')
        .attr('x', margin.left)  
        .attr('y', 28)  
        .attr('font-size', 18)
        .attr('font-weight', 700)
        .attr('fill', '#1f2a1f')
        .text('Top industries over time');

    // line generator
    const lineGen = d3.line()
        .x(function (d) {  
            return xScale(d.year);
        })
        .y(function (d) {  
            return yScale(d.value);
        });

    // draw lines. one path per industry
    const lines = chart.selectAll('path.line-path')
        .data(data, function (d) {
            return d.industry;
        })
        .join('path')
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke-width', 3)
        .attr('opacity', 0.95)
        .attr('stroke', function (d) {
            return lineColour(d.industry);
        })
        .attr('d', function (d) {
            return lineGen(d.values);
        });

    // draw points. one point per year
    const pointData = data.flatMap(function (series) {
        return series.values.map(function (point) {
            return {
                year: point.year,
                value: point.value,
                industry: point.industry,
                defaultColour: lineColour(point.industry)
            };
        });
    });

    const linePoints = chart.selectAll('circle.line-point')
        .data(pointData, function (d) {
            return d.industry + '-' + d.year;
        })
        .join('circle')
        .attr('class', 'line-point')
        .attr('cx', function (d) {
            return xScale(d.year);
        })
        .attr('cy', function (d) {
            return yScale(d.value);
        })
        .attr('r', 3.5)
        .attr('fill', function (d) {
            return lineColour(d.industry);
        })
        .attr('opacity', 1);

    // just like adding values in bar chart, add labels at the end of lines for better visualisation
    const labelData = data.map(function (series) {
        const lastValue = series.values[series.values.length - 1];

        return {
            industry: series.industry,
            year: lastValue.year,
            value: lastValue.value
        };
    });

    chart.selectAll('text.line-label')
        .data(labelData, function (d) {
            return d.industry;
        })
        .join('text')
        .attr('class', 'line-label')
        .attr('x', function (d) {  
            return xScale(d.year) + 8;
        })
        .attr('y', function (d) {  
            return yScale(d.value);
        })
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 11)
        .attr('fill', '#2e392e')
        .text(function (d) {
            return shortenName(d.industry);
        });

    // save for hover interactions
    appState.selections.lines = lines;
    appState.selections.linePoints = linePoints;

    // mouse hover interactions
    attachHoverEvents(
        lines,
        function (d) {
            return d.industry;
        },
        function (d) {
            const firstValue = d.values[0].value;
            const lastValue = d.values[d.values.length - 1].value;
            const growth = lastValue - firstValue;
            const totalValue = d3.sum(d.values, function (point) {  
                return point.value;
            });

            return buildTooltipContent({
                industry: d.industry,
                firstValue: firstValue,
                latestValue: lastValue,
                growth: growth,
                totalValue: totalValue
            });
        }
    );

    attachHoverEvents(
        linePoints,
        function (d) {
            return d.industry;
        },
        function (d) {
            return `
                <div class="tooltip-title">${d.industry}</div>
                <div><strong>Year:</strong> ${d.year}</div>
                <div><strong>Value:</strong> ${d.value.toFixed(2)}</div>
            `;
        }
    );
}