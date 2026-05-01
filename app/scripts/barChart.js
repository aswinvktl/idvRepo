'use strict';

// creates the barchart, is referenced in main
function drawBarChart(data, appState, settings) {
    const width = settings.size.width;
    const height = settings.size.barHeight;
    const margin = settings.margin.bar;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // deletes if there is already an existing svg. more sort of a futureproofing if the function runs more than once
    d3.select('#bar-chart').selectAll('svg').remove();

    const barSvg = d3.select('#bar-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .classed('viz barchart', true);

    const chart = barSvg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // scales
    const maxGrowth = d3.max(data, function (d) {  
        return d.growth;
    });

    const xScale = d3.scaleLinear()
        .domain([0, maxGrowth])
        .range([0, chartWidth]);

    const yScale = d3.scaleBand()
        .domain(data.map(function (d) {
            return d.industry;
        }))
        .range([0, chartHeight])
        .padding(0.2);

    // x and y axis. keep the names shorter for improved readability
    const xAxis = d3.axisBottom(xScale)
        .ticks(6);

    const yAxis = d3.axisLeft(yScale)
        .tickFormat(function (d) {
            return shortenName(d);
        });

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
        .text('Growth from first year to latest year');

    barSvg.append('text')
        .attr('x', margin.left)  
        .attr('y', 28)  
        .attr('font-size', 18)
        .attr('font-weight', 700)
        .attr('fill', '#1f2a1f')
        .text('industry growth by sector');

    // use a keyed join system
    const bars = chart.selectAll('rect.bar')
        .data(data, function (d) {
            return d.industry;
        })
        .join('rect')
        .classed('bar', true)
        .attr('x', 0)
        .attr('y', function (d) { 
            return yScale(d.industry);
        })
        .attr('width', function (d) {
            return xScale(d.growth);
        })
        .attr('height', yScale.bandwidth())
        .attr('fill', settings.colour.main)
        .attr('opacity', 0.9);

    // adding the exact value as a number for improved readability
    chart.selectAll('text.bar-label')
        .data(data, function (d) {
            return d.industry;
        })
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', function (d) { 
            return xScale(d.growth) + 6;
        })
        .attr('y', function (d) { 
            return yScale(d.industry) + yScale.bandwidth() / 2;
        })
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 12)
        .text(function (d) {
            return d.growth.toFixed(2);
        });

    appState.selections.bars = bars;

    // hover interactions
    attachHoverEvents(
        bars,
        function (d) {
            return d.industry;
        },
        function (d) {
            return buildTooltipContent(d);
        }
    );
}