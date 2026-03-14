/**
 * Chart Exporter
 *
 * Generates SVG charts for reports without external dependencies.
 */

import type {
  ChartConfig,
  GaugeOptions,
  TrendDataPoint,
  BarChartData,
} from '../reporting.types.js';

/**
 * Default chart colors
 */
const COLORS = {
  excellent: '#10b981',
  good: '#22c55e',
  fair: '#eab308',
  poor: '#f97316',
  critical: '#ef4444',
  primary: '#3b82f6',
  secondary: '#6366f1',
  background: '#ffffff',
  text: '#1f2937',
  grid: '#e5e7eb',
} as const;

/**
 * Dark mode colors
 */
const DARK_COLORS = {
  excellent: '#059669',
  good: '#16a34a',
  fair: '#ca8a04',
  poor: '#ea580c',
  critical: '#dc2626',
  primary: '#2563eb',
  secondary: '#4f46e5',
  background: '#1f2937',
  text: '#f9fafb',
  grid: '#374151',
} as const;

/**
 * Chart exporter for SVG generation
 */
export class ChartExporter {
  /**
   * Generate a gauge chart SVG
   *
   * @param options - Gauge options
   * @returns SVG string
   */
  static generateGauge(options: GaugeOptions): string {
    const {
      value,
      label,
      width = 200,
      height = 120,
      min = 0,
      max = 100,
      color,
      backgroundColor,
      textColor,
      zones,
    } = options;

    const colors = backgroundColor?.startsWith('#1') ? DARK_COLORS : COLORS;
    const bgColor = backgroundColor ?? colors.background;
    const txtColor = textColor ?? colors.text;

    // Determine color based on value
    const getValueColor = (val: number): string => {
      if (zones) {
        const zone = zones.find(z => val >= z.from && val < z.to);
        if (zone) return zone.color;
      }
      if (color) return color;
      if (val >= 90) return colors.excellent;
      if (val >= 70) return colors.good;
      if (val >= 50) return colors.fair;
      if (val >= 30) return colors.poor;
      return colors.critical;
    };

    const valueColor = getValueColor(value);
    const clampedValue = Math.max(min, Math.min(max, value));
    const percentage = (clampedValue - min) / (max - min);

    // SVG parameters
    const cx = width / 2;
    const cy = height - 20;
    const radius = Math.min(width, height * 2) / 2 - 20;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const valueAngle = startAngle + (endAngle - startAngle) * percentage;

    // Generate SVG
    const svg = [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
      `  <defs>`,
      `    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">`,
      `      <stop offset="0%" style="stop-color:${colors.critical};stop-opacity:1" />`,
      `      <stop offset="25%" style="stop-color:${colors.poor};stop-opacity:1" />`,
      `      <stop offset="50%" style="stop-color:${colors.fair};stop-opacity:1" />`,
      `      <stop offset="75%" style="stop-color:${colors.good};stop-opacity:1" />`,
      `      <stop offset="100%" style="stop-color:${colors.excellent};stop-opacity:1" />`,
      `    </linearGradient>`,
      `  </defs>`,

      // Background arc
      `  <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"`,
      `        fill="none" stroke="${colors.grid}" stroke-width="16" stroke-linecap="round"/>`,

      // Value arc
      `  <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${percentage > 0.5 ? 1 : 0} 1 ${cx + radius * Math.cos(valueAngle)} ${cy - radius * Math.sin(valueAngle)}"`,
      `        fill="none" stroke="${valueColor}" stroke-width="16" stroke-linecap="round"/>`,

      // Value text
      `  <text x="${cx}" y="${cy - radius / 2}" text-anchor="middle"`,
      `        font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="${txtColor}">`,
      `    ${Math.round(value)}`,
      `  </text>`,

      // Label text
      `  <text x="${cx}" y="${cy - radius / 2 + 20}" text-anchor="middle"`,
      `        font-family="system-ui, sans-serif" font-size="12" fill="${colors.secondary}">`,
      `    ${label || ''}`,
      `  </text>`,
      `</svg>`,
    ].join('\n');

    return svg;
  }

  /**
   * Generate a trend line chart SVG
   *
   * @param data - Trend data points
   * @param config - Chart configuration
   * @returns SVG string
   */
  static generateTrendChart(
    data: TrendDataPoint[],
    config: Partial<ChartConfig> = {}
  ): string {
    const {
      width = 400,
      height = 200,
      color,
      backgroundColor,
      textColor,
      showGrid = true,
      showLabels = true,
    } = config;

    const colors = backgroundColor?.startsWith('#1') ? DARK_COLORS : COLORS;
    const bgColor = backgroundColor ?? colors.background;
    const txtColor = textColor ?? colors.text;
    const lineColor = color ?? colors.primary;

    if (data.length < 2) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" fill="${txtColor}">Insufficient data</text>
      </svg>`;
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal - minVal || 1;

    // Generate points for the line
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.value - minVal) / valRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // Generate area fill points
    const areaPoints = [
      `${padding.left},${padding.top + chartHeight}`,
      points,
      `${padding.left + chartWidth},${padding.top + chartHeight}`,
    ].join(' ');

    // Y-axis labels
    const yLabels = [];
    for (let i = 0; i <= 4; i++) {
      const val = minVal + (valRange * i) / 4;
      const y = padding.top + chartHeight - (i / 4) * chartHeight;
      yLabels.push(
        `  <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end"`,
        `        font-family="system-ui, sans-serif" font-size="11" fill="${colors.secondary}">`,
        `    ${Math.round(val)}`,
        `  </text>`
      );

      if (showGrid) {
        yLabels.push(
          `  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"`,
          `        stroke="${colors.grid}" stroke-width="1"/>`
        );
      }
    }

    // X-axis labels (first and last)
    const xLabels = [];
    if (showLabels && data.length > 0) {
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      xLabels.push(
        `  <text x="${padding.left}" y="${height - 10}" text-anchor="middle"`,
        `      font-family="system-ui, sans-serif" font-size="10" fill="${colors.secondary}">`,
        `    ${formatDate(data[0].timestamp)}`,
        `  </text>`,
        `  <text x="${width - padding.right}" y="${height - 10}" text-anchor="middle"`,
        `      font-family="system-ui, sans-serif" font-size="10" fill="${colors.secondary}">`,
        `    ${formatDate(data[data.length - 1].timestamp)}`,
        `  </text>`
      );
    }

    const svg = [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
      `  <rect width="100%" height="100%" fill="${bgColor}"/>`,

      // Y-axis labels and grid
      ...yLabels,

      // X-axis labels
      ...xLabels,

      // Area fill
      `  <polygon points="${areaPoints}" fill="${lineColor}" opacity="0.1"/>`,

      // Line
      `  <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,

      // Data points
      ...data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((d.value - minVal) / valRange) * chartHeight;
        return `  <circle cx="${x}" cy="${y}" r="4" fill="${bgColor}" stroke="${lineColor}" stroke-width="2"/>`;
      }),

      `</svg>`,
    ].join('\n');

    return svg;
  }

  /**
   * Generate a bar chart SVG
   *
   * @param data - Bar chart data
   * @param config - Chart configuration
   * @returns SVG string
   */
  static generateBarChart(
    data: BarChartData[],
    config: Partial<ChartConfig> = {}
  ): string {
    const {
      width = 400,
      height = 250,
      backgroundColor,
      textColor,
      showLabels = true,
    } = config;

    const colors = backgroundColor?.startsWith('#1') ? DARK_COLORS : COLORS;
    const bgColor = backgroundColor ?? colors.background;
    const txtColor = textColor ?? colors.text;

    if (data.length === 0) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" fill="${txtColor}">No data</text>
      </svg>`;
    }

    const padding = { top: 20, right: 20, bottom: 60, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...data.map(d => d.value), 100);
    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    const bars = data.map((d, i) => {
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const barHeight = (d.value / maxVal) * chartHeight;
      const y = padding.top + chartHeight - barHeight;
      const barColor = d.color ?? this.getBarColor(d.value);

      return [
        `  <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"`,
        `        fill="${barColor}" rx="4"/>`,
        `  <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle"`,
        `        font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="${txtColor}">`,
        `    ${d.value}`,
        `  </text>`,
        `  <text x="${x + barWidth / 2}" y="${height - 15}" text-anchor="middle"`,
        `        font-family="system-ui, sans-serif" font-size="11" fill="${colors.secondary}">`,
        `    ${this.truncateLabel(d.label, 12)}`,
        `  </text>`,
      ].join('\n');
    }).join('\n');

    // Y-axis labels
    const yLabels = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal * i) / 4);
      const y = padding.top + chartHeight - (i / 4) * chartHeight;
      yLabels.push(
        `  <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end"`,
        `        font-family="system-ui, sans-serif" font-size="11" fill="${colors.secondary}">`,
        `    ${val}`,
        `  </text>`
      );
    }

    const svg = [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
      `  <rect width="100%" height="100%" fill="${bgColor}"/>`,
      `  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}"`,
      `        stroke="${colors.grid}" stroke-width="1"/>`,
      `  <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}"`,
      `        stroke="${colors.grid}" stroke-width="1"/>`,
      ...yLabels,
      bars,
      `</svg>`,
    ].join('\n');

    return svg;
  }

  /**
   * Generate a donut chart SVG
   *
   * @param data - Data segments with labels and values
   * @param config - Chart configuration
   * @returns SVG string
   */
  static generateDonutChart(
    data: Array<{ label: string; value: number; color?: string }>,
    config: Partial<ChartConfig> = {}
  ): string {
    const {
      width = 300,
      height = 300,
      backgroundColor,
      textColor,
    } = config;

    const colors = backgroundColor?.startsWith('#1') ? DARK_COLORS : COLORS;
    const bgColor = backgroundColor ?? colors.background;
    const txtColor = textColor ?? colors.text;

    if (data.length === 0) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" fill="${txtColor}">No data</text>
      </svg>`;
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 20;
    const innerRadius = outerRadius * 0.6;

    let currentAngle = -Math.PI / 2;
    const segments = data.map((d, i) => {
      const sliceAngle = (d.value / total) * 2 * Math.PI;
      const endAngle = currentAngle + sliceAngle;

      const x1 = cx + outerRadius * Math.cos(currentAngle);
      const y1 = cy + outerRadius * Math.sin(currentAngle);
      const x2 = cx + outerRadius * Math.cos(endAngle);
      const y2 = cy + outerRadius * Math.sin(endAngle);

      const x3 = cx + innerRadius * Math.cos(endAngle);
      const y3 = cy + innerRadius * Math.sin(endAngle);
      const x4 = cx + innerRadius * Math.cos(currentAngle);
      const y4 = cy + innerRadius * Math.sin(currentAngle);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      const segmentColor = d.color ?? this.getDefaultColor(i);

      const path = `  <path d="M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z" fill="${segmentColor}" stroke="${bgColor}" stroke-width="2"/>`;

      // Legend entry
      const legendY = 20 + i * 20;
      const legend = [
        `  <rect x="10" y="${legendY}" width="12" height="12" fill="${segmentColor}" rx="2"/>`,
        `  <text x="28" y="${legendY + 10}" font-family="system-ui, sans-serif" font-size="11" fill="${txtColor}">`,
        `    ${d.label} (${Math.round(d.value / total * 100)}%)`,
        `  </text>`,
      ].join('\n');

      currentAngle = endAngle;

      return path + '\n' + legend;
    }).join('\n');

    // Center text with total
    const centerText = total > 0
      ? `  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="${txtColor}">
        ${total}
      </text>`
      : '';

    const svg = [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
      `  <rect width="100%" height="100%" fill="${bgColor}"/>`,
      segments,
      centerText,
      `</svg>`,
    ].join('\n');

    return svg;
  }

  /**
   * Get color based on bar value
   */
  private static getBarColor(value: number): string {
    if (value >= 90) return COLORS.excellent;
    if (value >= 70) return COLORS.good;
    if (value >= 50) return COLORS.fair;
    if (value >= 30) return COLORS.poor;
    return COLORS.critical;
  }

  /**
   * Get default color for chart segments
   */
  private static getDefaultColor(index: number): string {
    const defaultColors = [
      COLORS.primary,
      COLORS.secondary,
      COLORS.excellent,
      COLORS.good,
      COLORS.fair,
      COLORS.poor,
    ];
    return defaultColors[index % defaultColors.length];
  }

  /**
   * Truncate label for display
   */
  private static truncateLabel(label: string, maxLength: number): string {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  }
}
