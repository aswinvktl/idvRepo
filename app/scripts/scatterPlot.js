'use strict';

function drawScatterPlot(data, appState, settings) {
    const width = settings.size.scatterWidth;
    const height = settings.size.scatterHeight;
    const margin = settings.margin.scatter;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    d3.select('#scatter-plot').selectAll('svg').remove();

    const scatterSvg = d3.select('#scatter-plot')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .classed('viz scatterplot', true);

    const chart = scatterSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const xMax = d3.max(data, function (d) {  
        return d.latestValue;
    });

    const yMax = d3.max(data, function (d) {
        return d.growth;
    });

    const xScale = d3.scaleSymlog()
        .domain([0, xMax * 1.05])
        .range([0, chartWidth]);

    const yScale = d3.scaleSymlog()
        .domain([0, yMax * 1.05])
        .range([chartHeight, 0]);

    const xAxis = d3.axisBottom(xScale)
        .ticks(8);

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
        .text('Latest year value');

    chart.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -48)  
        .attr('text-anchor', 'middle')
        .attr('fill', '#2e392e')
        .text('Change from first year to latest year');

    scatterSvg.append('text')
        .attr('x', margin.left)  
        .attr('y', 28)  
        .attr('font-size', 18)
        .attr('font-weight', 700)
        .attr('fill', '#1f2a1f')
        .text('Latest value compared with growth');

    chart.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', chartHeight)
        .attr('y2', chartHeight)
        .attr('stroke', '#d9ded9');

    chart.append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', '#d9ded9');

    const scatterPoints = chart.selectAll('circle.scatter-point')
        .data(data, function (d) {
            return d.industry;
        })
        .join('circle')
        .attr('class', 'scatter-point')
        .attr('cx', function (d) {
            return xScale(d.latestValue);
        })
        .attr('cy', function (d) {
            return yScale(d.growth);
        })
        .attr('r', 7)
        .attr('fill', settings.colour.main)
        .attr('stroke', settings.colour.stroke)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85);

    appState.selections.scatterPoints = scatterPoints;

    attachHoverEvents(
        scatterPoints,
        function (d) {
            return d.industry;
        },
        function (d) {
            return buildTooltipContent(d);
        }
    );
}