'use strict';

// ============================================================
//  lineChart.js — Temporal view with D3 brush
//
//  Shows the top N energy sources by total output over all
//  years as smooth coloured lines.
//
//  Interaction:
//    - Brush (drag) → calls onBrush() in main.js
//      which redraws the treemap and bar chart for
//      only the selected year range
//    - Hover line or point → tooltip + cross-highlight
//
//  Data shape expected (one object per year):
//    { year: 1990, Wind_Wave_Tidal: 0.001, Solar_PV: 0.0005, ... }
// ============================================================

import {
    SOURCE_KEYS,
    SOURCE_NAMES,
    sourceColour,
    appState,
    onBrush,
    onSourceClick,
    showTooltip,
    hideTooltip,
    moveTooltip
} from './main.js';

export function drawLineChart(data, state, topN) {

    // ── 1. Measure the container ──────────────────────────────
    // clientWidth/Height gives the actual rendered pixel size.
    // We use this rather than hardcoded values so the chart
    // fills whatever space CSS Grid gives it.
    const container = document.getElementById('line-chart-container');
    const totalW = container.clientWidth  || 900;
    const totalH = container.clientHeight || 400;

    // Margins: space between SVG edge and the chart area.
    // Right is large to give end-of-line labels room.
    const margin = { top: 44, right: 135, bottom: 52, left: 50 };
    const W = totalW - margin.left - margin.right;  // chart area width
    const H = totalH - margin.top  - margin.bottom; // chart area height

    // ── 2. Clear any previous SVG ────────────────────────────
    // This function is called once on init (not on brush).
    // The line chart itself never redraws — only treemap and
    // bar chart redraw. But we clear to be safe.
    d3.select('#line-chart-container').selectAll('svg').remove();

    const svg = d3.select('#line-chart-container')
        .append('svg')
        .attr('width',  totalW)
        .attr('height', totalH);

    const chart = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── 3. Select top N sources by total output ───────────────
    // Sum each source across all 34 years, take the top N.
    // This is a dynamic data operation — the spec requires it.
    const ranked = SOURCE_KEYS
        .map(key => ({
            key,
            total: d3.sum(data, d => d[key])
        }))
        .sort((a, b) => d3.descending(a.total, b.total));

    const topKeys = ranked.slice(0, topN).map(d => d.key);

    // ── 4. Build one series object per source ─────────────────
    // Each series has: source key, label, array of {year, value}
    const series = topKeys.map(key => ({
        source: key,
        label:  SOURCE_NAMES[key],
        values: data
            .map(row => ({ year: row.year, value: row[key], source: key }))
            .sort((a, b) => d3.ascending(a.year, b.year))
    }));

    // ── 5. Scales ─────────────────────────────────────────────
    const allValues = series.flatMap(s => s.values);

    // X: linear scale mapping year → pixel x position
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, W]);

    // Y: linear scale mapping Mtoe → pixel y position
    // .nice() rounds the domain to clean numbers
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(allValues, d => d.value) * 1.08])
        .nice()
        .range([H, 0]); // inverted: 0 Mtoe is at the bottom

    // ── 6. Axes ───────────────────────────────────────────────
    // d3.format('d') formats numbers as integers (no decimals)
    // — appropriate for years on the X axis
    chart.append('g')
        .attr('transform', `translate(0,${H})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8));

    chart.append('g')
        .call(d3.axisLeft(yScale).ticks(6));

    // Axis labels
    chart.append('text')
        .attr('class', 'axis-label')
        .attr('x', W / 2)
        .attr('y', H + 40)
        .attr('text-anchor', 'middle')
        .text('Year');

    chart.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(H / 2))
        .attr('y', -38)
        .attr('text-anchor', 'middle')
        .text('Energy (Mtoe)');

    // ── 7. Chart title and subtitle ───────────────────────────
    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', margin.left)
        .attr('y', 20)
        .text('Renewable Energy');

    svg.append('text')
        .attr('class', 'chart-subtitle')
        .attr('x', margin.left)
        .attr('y', 34)
        .text('Drag to filter by year range');

    // ── 8. Line generator ─────────────────────────────────────
    // d3.line() builds an SVG path string from an array of points.
    // curveMonotoneX smooths the line while preserving the shape
    // — it never overshoots a data point (unlike curveBasis).
    const lineGen = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    // ── 9. Draw one path per source ───────────────────────────
    const lines = chart.selectAll('path.line-path')
        .data(series, d => d.source)  // key function = stable join on source name
        .join('path')
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', d => sourceColour(d.source))
        .attr('stroke-width', 2)
        .attr('opacity', 0.85)
        .attr('d', d => lineGen(d.values));

    // Store in state so updateHighlight() in main.js can reach them
    appState.selections.lines = lines;

    // ── 10. Draw circles at each data point ───────────────────
    // Flat map all series into one array of individual points
    const pointData = series.flatMap(s =>
        s.values.map(v => ({ ...v, source: s.source }))
    );

    const linePoints = chart.selectAll('circle.line-point')
        .data(pointData, d => d.source + '-' + d.year)
        .join('circle')
        .attr('class', 'line-point')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.value))
        .attr('r', 3)
        .attr('fill', d => sourceColour(d.source))
        .attr('opacity', 0.85);

    appState.selections.linePoints = linePoints;

    // ── 11. End-of-line labels ────────────────────────────────
    // Draw the source name at the rightmost data point of each line.
    // This avoids needing a separate legend.
    chart.selectAll('text.line-label')
        .data(series, d => d.source)
        .join('text')
        .attr('class', 'line-label')
        .attr('x', d => xScale(d.values.at(-1).year) + 6)
        .attr('y', d => yScale(d.values.at(-1).value))
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 10)
        .attr('fill', d => sourceColour(d.source))
        .text(d => {
            // Truncate long labels so they fit in the margin
            const label = d.label;
            return label.length > 16 ? label.slice(0, 14) + '…' : label;
        });

    // ── 12. Hover events ──────────────────────────────────────

    // On line hover: cross-highlight + show summary tooltip
    lines
        .on('mouseover', function(event, d) {
            onSourceClick(d.source);
            showTooltip(event, buildLineSummaryTooltip(d));
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', function() {
            // Keep the selection — mouseout doesn't deselect.
            // User must click the treemap cell to deselect.
            hideTooltip();
        });

    // On point hover: cross-highlight + show per-year tooltip
    linePoints
        .on('mouseover', function(event, d) {
            onSourceClick(d.source);
            showTooltip(event, `
                <div class="tooltip-title">${SOURCE_NAMES[d.source]}</div>
                <div><strong>Year:</strong> ${d.year}</div>
                <div><strong>Value:</strong> ${d.value.toFixed(3)} Mtoe</div>
            `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip);

    // ── 13. Brush ─────────────────────────────────────────────
    // d3.brushX() creates a horizontal brush behaviour.
    // .extent() defines the brushable area (the full chart area).
    // The 'end' event fires when the user releases the mouse.
    const brush = d3.brushX()
        .extent([[0, 0], [W, H]])
        .on('end', function(event) {
            if (!event.selection) {
                // User clicked without dragging — clear the brush
                onBrush(null);
                return;
            }
            // Convert pixel positions back to year values
            // xScale.invert() is the reverse of xScale()
            const [x0, x1] = event.selection;
            const y0 = Math.round(xScale.invert(x0));
            const y1 = Math.round(xScale.invert(x1));
            onBrush([y0, y1]);
        });

    // Append a <g> for the brush — it must come AFTER the lines
    // so the brush overlay sits on top and captures mouse events
    chart.append('g')
        .attr('class', 'brush')
        .call(brush);
}

// ── Tooltip for a full line series ────────────────────────────
// Shows first year, last year, total growth, and cumulative sum.
function buildLineSummaryTooltip(series) {
    const vals   = series.values;
    const first  = vals[0].value;
    const last   = vals.at(-1).value;
    const growth = last - first;
    const total  = d3.sum(vals, v => v.value);

    return `
        <div class="tooltip-title">${SOURCE_NAMES[series.source]}</div>
        <div><strong>1990:</strong> ${first.toFixed(3)} Mtoe</div>
        <div><strong>2023:</strong> ${last.toFixed(3)} Mtoe</div>
        <div><strong>Growth:</strong> +${growth.toFixed(3)} Mtoe</div>
        <div><strong>Cumulative:</strong> ${total.toFixed(2)} Mtoe</div>
        <div class="tooltip-hint">Click to select · Drag chart to filter by year</div>
    `;
}