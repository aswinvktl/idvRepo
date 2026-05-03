'use strict';

// ============================================================
//  main.js — CW2 Dashboard Orchestrator
//
//  This file:
//    1. Defines shared lookup tables (SIC names, source names)
//    2. Loads both CSV files in parallel
//    3. Holds appState — the single source of truth for
//       what is currently selected / brushed
//    4. Exports callback functions that charts call when
//       the user interacts (onBrush, onSourceClick)
//    5. Draws the initial dashboard
// ============================================================

import { drawLineChart } from './lineChart.js';
import { drawSunburst } from './sunburst.js';
import { drawBarChart }  from './barChart.js';

// ── How many sources to show as individual lines ─────────────
// Increase to show more lines (gets cluttered above ~10)
const TOP_N = 8;

// ── SIC code → readable name ──────────────────────────────────
// Used by the bar chart for Y-axis labels and tooltips.
// Keys match the column headers in data4.csv exactly.
export const SIC_NAMES = {
    A: 'Agriculture',
    B: 'Mining',
    C: 'Manufacturing',
    D: 'Electricity & Gas',
    E: 'Water & Waste',
    F: 'Construction',
    G: 'Wholesale & Retail',
    H: 'Transport',
    I: 'Accommodation',
    J: 'ICT',
    K: 'Finance',
    L: 'Real Estate',
    M: 'Professional Services',
    N: 'Admin & Support',
    O: 'Public Admin',
    P: 'Education',
    Q: 'Health & Social',
    R: 'Arts & Recreation',
    S: 'Other Services',
    T: 'Households',
    Z: 'Consumer Expenditure'
};

// ── Energy source key → readable name ────────────────────────
// Used by line chart labels, treemap cells, and tooltips.
// Keys match the column headers in data5.csv exactly.
export const SOURCE_NAMES = {
    Hydroelectric:       'Hydroelectric',
    Wind_Wave_Tidal:     'Wind / Wave / Tidal',
    Solar_PV:            'Solar PV',
    Geothermal:          'Geothermal',
    Landfill_Gas:        'Landfill Gas',
    Sewage_Gas:          'Sewage Gas',
    Biogas:              'Biogas',
    Municipal_Waste:     'Municipal Waste',
    Non_Municipal_Waste: 'Non-Municipal Waste',
    Animal_Biomass:      'Animal Biomass',
    Plant_Biomass:       'Plant Biomass',
    Straw:               'Straw',
    Wood:                'Wood (all)',
    Wood_Dry:            'Wood – Dry',
    Wood_Seasoned:       'Wood – Seasoned',
    Wood_Wet:            'Wood – Wet',
    Coffee_Logs:         'Coffee Logs',
    Woodchip:            'Woodchip',
    Wood_Pellets:        'Wood Pellets',
    Wood_Briquettes:     'Wood Briquettes',
    Charcoal:            'Charcoal',
    Liquid_Biofuels:     'Liquid Biofuels',
    Bioethanol:          'Bioethanol',
    Biodiesel:           'Biodiesel',
    SAF:                 'Aviation Fuel (SAF)'
};

// Ordered list of all source keys — used for iteration
export const SOURCE_KEYS = Object.keys(SOURCE_NAMES);

// ── Colour scale — one colour per energy source ───────────────
// Hand-picked palette for dark Obsidian background.
// Avoids colours that are too similar or too dark to read.
const PALETTE = [
    '#f97316', // orange       — Wind/Wave/Tidal (dominant)
    '#22d3ee', // cyan         — Wood (all)
    '#a3e635', // lime green   — Landfill Gas
    '#f43f5e', // rose         — Biogas
    '#818cf8', // indigo       — Municipal Waste
    '#fb923c', // light orange — Plant Biomass
    '#34d399', // emerald      — Hydroelectric
    '#e879f9', // fuchsia      — Solar PV
    '#facc15', // yellow       — Non-Municipal Waste
    '#60a5fa', // blue         — Liquid Biofuels
    '#4ade80', // green        — Wood Pellets
    '#f472b6', // pink         — Biodiesel
    '#c084fc', // purple       — Woodchip
    '#38bdf8', // sky blue     — Straw
    '#fb7185', // light rose   — Animal Biomass
    '#a78bfa', // violet       — Sewage Gas
    '#86efac', // light green  — Bioethanol
    '#fcd34d', // amber        — Wood Dry
    '#67e8f9', // light cyan   — Wood Seasoned
    '#f9a8d4', // light pink   — Wood Wet
    '#d9f99d', // light lime   — Coffee Logs
    '#fdba74', // peach        — Wood Briquettes
    '#93c5fd', // light blue   — Charcoal
    '#c4b5fd', // light violet — SAF
    '#6ee7b7'  // light emerald— Geothermal
];

export const sourceColour = d3.scaleOrdinal()
    .domain(SOURCE_KEYS)
    .range(PALETTE);

// ── Global colour settings ────────────────────────────────────
// These match the CSS variables in main.css.
// Used directly in D3 .attr('fill', ...) calls.
export const COLOURS = {
    main:      '#8b5cf6',   // Obsidian violet — default bar/mark colour
    highlight: '#6366f1',   // indigo — hovered bar
    fade:      '#3a3a3a',   // de-emphasised marks when something is selected
    stroke:    '#1e1e1e'    // matches page background — used as gap between marks
};

// ── Shared application state ──────────────────────────────────
// This is the single source of truth for the dashboard.
// All three chart files read from this object.
// None of them write to it directly — they call the
// callback functions below (onBrush, onSourceClick) instead.
export const appState = {

    // The year range currently selected by the brush.
    // Format: [startYear, endYear] e.g. [2005, 2015]
    // null means no brush active — show all years.
    brushedYears: null,

    // The energy source key currently selected via treemap click.
    // e.g. 'Wind_Wave_Tidal' or null if nothing selected.
    selectedSource: null,

    // D3 selections stored so updateHighlight() can reach
    // marks in all three charts at once.
    selections: {
        lines:        null,   // line paths in lineChart
        linePoints:   null,   // circles in lineChart
        bars:         null,   // rects in barChart
        treemapCells: null    // g elements in treemap
    },

    // The tooltip div — created once in init(), shared by all charts
    tooltip: null,

    // Raw parsed data — stored after loading, never modified
    data4: null,   // industry data  (cw2_table1a / data4.csv)
    data5: null    // source data    (cw2_table1c / data5.csv)
};

// ── Tooltip helpers ───────────────────────────────────────────
// Defined here because all three charts need them.
// Charts call these directly — no duplication.

export function showTooltip(event, html) {
    appState.tooltip
        .html(html)
        .style('top',  (event.pageY + 14) + 'px')
        .style('left', (event.pageX + 14) + 'px')
        .style('opacity', 1);
}

export function hideTooltip() {
    appState.tooltip.style('opacity', 0);
}

export function moveTooltip(event) {
    appState.tooltip
        .style('top',  (event.pageY + 14) + 'px')
        .style('left', (event.pageX + 14) + 'px');
}

// ── Cross-chart highlight ─────────────────────────────────────
// Called whenever selectedSource changes.
// Fades all marks that don't match the selected source,
// brightens the one that does.
export function updateHighlight() {
    const sel = appState.selectedSource;

    // Lines — thicken selected line, keep others normal (no fade)
    if (appState.selections.lines) {
        appState.selections.lines
            .attr('stroke-width', d =>
                sel === null ? 2 : d.source === sel ? 4.5 : 2
            )
            .attr('opacity', 1); // never fade lines
    }

    // Line points — enlarge selected points only (no fade)
    if (appState.selections.linePoints) {
        appState.selections.linePoints
            .attr('r', d =>
                sel === null ? 3 : d.source === sel ? 6 : 3
            )
            .attr('opacity', 1); // never fade points
    }

    // Sunburst wedges — accent stroke on selected, nothing on others
    if (appState.selections.treemapCells) {
        appState.selections.treemapCells
            .attr('opacity', 1) // never fade wedges
            .classed('selected', d => d.data.key === sel);

        // Add bright stroke to selected wedge only
        appState.selections.treemapCells.select('path')
            .attr('stroke', d =>
                sel !== null && d.data.key === sel ? '#ffffff' : '#1e1e1e'
            )
            .attr('stroke-width', d =>
                sel !== null && d.data.key === sel ? 2.5 : 1
            );
    }
}

// ── onBrush — called by lineChart when brush changes ─────────
// Updates brushedYears in state, then redraws the two
// filtered charts (treemap + bar chart) with filtered data.
export function onBrush(yearRange) {
    appState.brushedYears = yearRange;

    // Show or hide the Reset button
    d3.select('#reset-btn')
        .style('display', yearRange ? 'block' : 'none');

    // Redraw both filtered charts with new data subset
    drawSunburst(getFilteredData5(), appState);
    drawBarChart(getFilteredData4(), appState);
}

// ── onSourceClick — called by treemap when cell is clicked ───
// Toggles selectedSource: clicking same source twice clears it.
export function onSourceClick(sourceKey) {
    appState.selectedSource =
        appState.selectedSource === sourceKey ? null : sourceKey;
    updateHighlight();
}

// ── Data filter helpers ───────────────────────────────────────
// Return the rows of each dataset filtered to brushedYears.
// If no brush active, return all rows.

export function getFilteredData5() {
    if (!appState.brushedYears) return appState.data5;
    const [y0, y1] = appState.brushedYears;
    return appState.data5.filter(d => d.year >= y0 && d.year <= y1);
}

export function getFilteredData4() {
    if (!appState.brushedYears) return appState.data4;
    const [y0, y1] = appState.brushedYears;
    return appState.data4.filter(d => d.year >= y0 && d.year <= y1);
}

// ── Value cleaner ─────────────────────────────────────────────
// d3.csv returns everything as strings.
// [low] = ONS notation for "real but below reporting threshold"
// We use 0.0005 (not 0) to keep it on log scales if needed.
function cleanValue(v) {
    if (v === '[low]' || v === '' || v === null || v === undefined) {
        return 0.0005;
    }
    const n = +String(v).replace('%', '').trim();
    return isNaN(n) ? 0 : n;
}

// ── init — entry point ────────────────────────────────────────
function init() {

    // Create the shared tooltip div (one tooltip for all charts)
    d3.selectAll('.tooltip').remove();
    appState.tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip');

    // Add the Reset button inside the line chart panel
    // (hidden until a brush is active)
    d3.select('#line-chart-container')
        .append('button')
        .attr('id', 'reset-btn')
        .text('Reset')
        .on('click', () => onBrush(null));

    // ── Load both CSV files in parallel ──────────────────────
    // Promise.all fires .then() only when BOTH files have loaded.
    // This is better than nesting two .then() calls.
    Promise.all([
        d3.csv('data/data4.csv'),   // industry data (table 1a)
        d3.csv('data/data5.csv')    // source data   (table 1c)
    ]).then(([raw4, raw5]) => {

        // Parse data4: year + 21 SIC columns
        // d3.csv gives us strings — convert numbers
        appState.data4 = raw4.map(row => {
            const entry = { year: +row.year };
            Object.keys(SIC_NAMES).forEach(code => {
                entry[code] = cleanValue(row[code]);
            });
            return entry;
        });

        // Parse data5: year + 25 source columns
        appState.data5 = raw5.map(row => {
            const entry = { year: +row.year };
            SOURCE_KEYS.forEach(key => {
                entry[key] = cleanValue(row[key]);
            });
            return entry;
        });

        // Draw all three charts
        drawDashboard();

    }).catch(err => {
        // If CSV files are missing or path is wrong, log clearly
        console.error('❌ Failed to load data — check file paths:', err);
    });
}

// ── drawDashboard ─────────────────────────────────────────────
// Called once after data loads.
// lineChart gets the FULL data5 (all years) — it shows
// the complete timeline and the brush sits on top of it.
// treemap and barChart get filtered data (initially all years).
function drawDashboard() {
    drawLineChart(appState.data5, appState, TOP_N);
    drawSunburst(getFilteredData5(), appState);
    drawBarChart(getFilteredData4(), appState);
}

// ── Start everything ──────────────────────────────────────────
init();