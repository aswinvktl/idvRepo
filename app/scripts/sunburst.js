'use strict';

// ============================================================
//  sunburst.js — Hierarchical / part-to-whole view
//
//  Displays each renewable energy source as a wedge.
//  Wedge angle = proportion of total energy for the period.
//  Redraws whenever the brush in lineChart changes.
//
//  Interaction:
//    - Click a wedge → cross-highlights that source in line chart
//    - Click same wedge again → deselects (back to normal)
//    - Click the background → also deselects
//    - Hover → tooltip showing value and % share
//
//  Uses d3.partition() + d3.arc() — self-study (beyond lectures)
//  Reference: https://observablehq.com/@d3/sunburst
// ============================================================

import {
    SOURCE_KEYS,
    SOURCE_NAMES,
    sourceColour,
    appState,
    onSourceClick,
    showTooltip,
    hideTooltip,
    moveTooltip
} from './main.js';

export function drawSunburst(data, state) {

    // ── 1. Measure container ──────────────────────────────────
    const container = document.getElementById('treemap-container');
    const totalW = container.clientWidth  || 900;
    const totalH = container.clientHeight || 400;

    const titleH  = 44;
    const chartH  = totalH - titleH;
    const cx      = totalW / 2;
    const cy      = titleH + chartH / 2;

    const outerRadius = Math.min(totalW, chartH) / 2 - 10;
    const innerRadius = outerRadius * 0.42;

    // ── 2. Clear previous SVG ─────────────────────────────────
    d3.select('#treemap-container').selectAll('svg').remove();

    const svg = d3.select('#treemap-container')
        .append('svg')
        .attr('width',  totalW)
        .attr('height', totalH);

    // Click the SVG background to deselect
    svg.on('click', function(event) {
        if (event.target === this || event.target.tagName === 'svg') {
            onSourceClick(appState.selectedSource); // toggles to null
        }
    });

    const chart = svg.append('g')
        .attr('transform', `translate(${cx},${cy})`);

    // ── 3. Aggregate ──────────────────────────────────────────
    const sourceTotals = SOURCE_KEYS
        .map(key => ({
            key,
            label: SOURCE_NAMES[key],
            value: d3.sum(data, d => d[key])
        }))
        .filter(d => d.value > 0.001);

    const grandTotal = d3.sum(sourceTotals, d => d.value);

    // ── 4. Build D3 hierarchy ─────────────────────────────────
    const root = d3.hierarchy({ children: sourceTotals })
        .sum(d => d.value)
        .sort((a, b) => d3.descending(a.value, b.value));

    // ── 5. Partition layout ───────────────────────────────────
    d3.partition()
        .size([2 * Math.PI, 1])
        (root);

    // ── 6. Arc generator — square segment ends ────────────────
    // cornerRadius(0) = sharp square corners
    // No padRadius = flat segment ends (not rounded)
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(0.008)
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .cornerRadius(0);

    // Expanded arc for hover effect
    const arcHover = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(0.008)
        .innerRadius(innerRadius)
        .outerRadius(outerRadius + 10)
        .cornerRadius(0);

    // ── 7. Draw wedges ────────────────────────────────────────
    const wedges = chart.selectAll('g.sunburst-wedge')
        .data(root.leaves(), d => d.data.key)
        .join('g')
        .attr('class', 'sunburst-wedge')
        .style('cursor', 'pointer');

    wedges.append('path')
        .attr('d', arc)
        .attr('fill',        d => sourceColour(d.data.key))
        .attr('stroke',      '#1e1e1e')
        .attr('stroke-width', 1);

    // ── 8. Wedge labels ───────────────────────────────────────
    wedges.each(function(d) {
        const angularSpan = d.x1 - d.x0;
        if (angularSpan < 0.26) return;

        const midAngle    = (d.x0 + d.x1) / 2;
        const labelRadius = (innerRadius + outerRadius) / 2;
        const x = Math.sin(midAngle) * labelRadius;
        const y = -Math.cos(midAngle) * labelRadius;

        const degrees = (midAngle * 180 / Math.PI) - 90;
        const flip    = midAngle > Math.PI ? 180 : 0;

        const maxChars = Math.floor(angularSpan * labelRadius / 7);
        const label    = d.data.label.length > maxChars
            ? d.data.label.slice(0, maxChars - 1) + '…'
            : d.data.label;

        d3.select(this).append('text')
            .attr('transform',
                `translate(${x},${y}) rotate(${degrees + flip})`)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('class', 'wedge-label')
            .attr('font-size', 10)
            .attr('font-weight', 600)
            .attr('pointer-events', 'none')
            .text(label);
    });

    // ── 9. Centre label ───────────────────────────────────────
    const yearRange = data.length > 0
        ? `${data[0].year}–${data[data.length - 1].year}`
        : 'All';

    chart.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', -10)

        .attr('font-size', 18)
        .attr('font-weight', 700)
        .attr('fill', '#e8e8e8')
        .text(grandTotal.toFixed(1));

    chart.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', 10)
        .attr('font-size', 10)
        .attr('fill', '#aaaaaa')

        .text('Mtoe total');

    chart.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('y', 26)
        .attr('font-size', 10)
        .attr('fill', '#888888')

        .text(yearRange);

    // ── 10. Apply current highlight state ────────────────────
    // No opacity fade — just stroke on selected wedge
    const sel = appState.selectedSource;
    wedges.select('path')
        .attr('stroke', d =>
            sel !== null && d.data.key === sel ? '#ffffff' : '#1e1e1e'
        )
        .attr('stroke-width', d =>
            sel !== null && d.data.key === sel ? 2.5 : 1
        );

    appState.selections.treemapCells = wedges;

    // ── 11. Click — toggle selection / deselect ──────────────
    // Clicking same wedge twice returns to normal
    wedges.on('click', function(event, d) {
        event.stopPropagation(); // prevent SVG background handler
        onSourceClick(d.data.key);
    });

    // ── 12. Hover ─────────────────────────────────────────────
    wedges
        .on('mouseover', function(event, d) {
            d3.select(this).select('path').attr('d', arcHover(d));

            const pct = grandTotal > 0
                ? ((d.data.value / grandTotal) * 100).toFixed(1)
                : '0.0';

            showTooltip(event, `
                <div class="tooltip-title">${d.data.label}</div>
                <div><strong>Total:</strong> ${d.data.value.toFixed(3)} Mtoe</div>
                <div><strong>Share:</strong> ${pct}% of selected period</div>
                <div class="tooltip-hint">Click to highlight · Click again to reset</div>
            `);
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', function(event, d) {
            d3.select(this).select('path').attr('d', arc(d));
            hideTooltip();
        });

    // ── 13. Title ─────────────────────────────────────────────
    svg.append('text')
        .attr('class', 'chart-title')
        .attr('x', 12)
        .attr('y', 18)
        .text('Energy Sources');

    svg.append('text')
        .attr('class', 'chart-subtitle')
        .attr('x', 12)
        .attr('y', 32)
        .text(`${yearRange} · Click a segment to highlight in line chart`);
}