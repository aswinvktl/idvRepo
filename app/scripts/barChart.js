'use strict';

// ============================================================
//  barChart.js — Industry sector totals (filtered by brush)
//
//  Shows the cumulative renewable energy consumption for each
//  SIC industry sector, aggregated across the selected years.
//  Redraws completely whenever the brush in lineChart changes.
//
//  Interaction:
//    - Hover bar → tooltip with sector name and total
//    - No click selection — bar chart is a read-only output
//      of the brush selection, not an input to other charts
//
//  Data shape expected (one object per year):
//    { year: 1990, A: 0.077, B: 0.003, C: 0.122, ... }
// ============================================================

import {
    SIC_NAMES,
    COLOURS,
    appState,
    showTooltip,
    hideTooltip,
    moveTooltip
} from './main.js';

export function drawBarChart(data, state) {

    // ── 1. Measure container ──────────────────────────────────
    const container = document.getElementById('bar-chart-container');
    const totalW = container.clientWidth  || 1800;
    const totalH = container.clientHeight || 340;

    // Left margin is large to fit full industry names on Y axis
    const margin = { top: 44, right: 50, bottom: 32, left: 168 };
    const W = totalW - margin.left - margin.right;
    const H = totalH - margin.top  - margin.bottom;

    // ── 2. Clear previous SVG ─────────────────────────────────
    d3.select('#bar-chart-container').selectAll('svg').remove();

    const svg = d3.select('#bar-chart-container')
        .append('svg')
        .attr('width',  totalW)
        .attr('height', totalH);

    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── 3. Aggregate: sum each SIC code across filtered rows ──
    // data is the filtered subset (e.g. only 2005–2015 rows).
    // For each SIC code we sum all values in that range.
    // This is the dynamic data operation required by the spec.
    const SIC_CODES = Object.keys(SIC_NAMES);

    const barData = SIC_CODES
        .map(code => ({
            code,
            name:  SIC_NAMES[code],
            value: d3.sum(data, d => d[code])
        }))
        .sort((a, b) => d3.descending(a.value, b.value));

    // ── 4. Scales ─────────────────────────────────────────────
    // X: linear, 0 to max value with a little padding
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.value) * 1.08])
        .range([0, W])
        .nice();

    // Y: band scale, one band per industry
    // .padding() controls the gap between bars
    const yScale = d3.scaleBand()
        .domain(barData.map(d => d.code))
        .range([0, H])
        .padding(0.28);

    // ── 5. Axes ───────────────────────────────────────────────
    // X axis at the bottom
    chart.append('g')
        .attr('transform', `translate(0,${H})`)
        .call(d3.axisBottom(xScale).ticks(8));

    // Y axis: show full industry name (from SIC_NAMES lookup)
    chart.append('g')
        .call(
            d3.axisLeft(yScale)
                .tickFormat(code => SIC_NAMES[code])
        );

    // X axis label
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('x', W / 2)
        .attr('y', H + 28)
        .attr('text-anchor', 'middle')
        .text('Total Energy Consumption (Mtoe)');

    // ── 6. Draw bars ──────────────────────────────────────────
    const bars = chart.selectAll('rect.bar')
        .data(barData, d => d.code) // keyed join on SIC code
        .join('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y',      d => yScale(d.code))
        .attr('width',  d => xScale(d.value))
        .attr('height', yScale.bandwidth())
        .attr('fill',   COLOURS.main)
        .attr('rx', 2)   // slight rounding on bar ends
        .attr('opacity', 0.88);

    // Store in state so updateHighlight() could reach them
    // (currently bars aren't part of the source highlight system,
    // but stored in case you want to extend this later)
    appState.selections.bars = bars;

    // ── 7. Value labels ───────────────────────────────────────
    // Show the numeric value to the right of each bar.
    // Only shown if the bar is wide enough to not overlap.
    chart.selectAll('text.bar-label')
        .data(barData, d => d.code)
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.value) + 5)
        .attr('y', d => yScale(d.code) + yScale.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 10)
        .text(d => d.value > 0.001 ? d.value.toFixed(2) : '');

    // ── 8. Hover interactions ─────────────────────────────────
    bars
        .on('mouseover', function(event, d) {
            // Highlight this bar
            d3.select(this)
                .attr('fill', COLOURS.highlight)
                .attr('opacity', 1);

            showTooltip(event, `
                <div class="tooltip-title">${d.name}</div>
                <div><strong>SIC code:</strong> ${d.code}</div>
                <div><strong>Total:</strong> ${d.value.toFixed(3)} Mtoe</div>
            `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', function() {
            d3.select(this)
                .attr('fill', COLOURS.main)
                .attr('opacity', 0.88);
            hideTooltip();
        });

    // ── 9. Title and subtitle ─────────────────────────────────
    // Subtitle dynamically shows the active year range.
    // If no brush, shows "1990–2023". If brush active, shows
    // e.g. "2005–2015" — user always knows what is displayed.
    const yearRange = data.length > 0
        ? `${data[0].year}–${data[data.length - 1].year}`
        : 'All years';

    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', margin.left)
        .attr('y', 18)
        .text('Energy by Sector');

    svg.append('text')
        .attr('class', 'chart-subtitle')
        .attr('x', margin.left)
        .attr('y', 32)
        .text(`Cumulative totals · ${yearRange} · Updates when you brush the line chart`);
}