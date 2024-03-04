export const xColInfoSeries = [
    {
        color: '#ff006e',
        label: '空 empty',
        value: '表格或日志 table or log',
    },
    {
        color: '#80ed99',
        label: '【时间列 Time colomn】',
        value: '时序数据 Timeseries',
    },
    {
        color: '#0077b6',
        label: 'stat',
        value: '单值图格式 gauge/stat graph',
    },
    {
        color: '#0096c7',
        label: 'pie',
        value: '饼图格式 pie graph',
    },
    {
        color: '#00b4d8',
        label: 'bar',
        value: '柱状图格式 bar graph',
    },
    {
        color: '#48cae4',
        label: 'trace',
        value: 'Trace格式 Trace graph',
    },
    {
        color: '#90e0ef',
        label: 'map',
        value: '地图格式 map graph',
    },
];

export const yColInfoSeries = [
    {
        color: '#ffca3a',
        label: '【无需填写】 此情况适用于Log、Trace以及表格全列展示的情况',
        value: '[No need to fill in] This situation applies to Log, Trace and the full column of the table',
    },
    {
        color: '#8ac926',
        label: '【col1,col2,col3】 最常用的一种形式，在图表中展示若干数值列',
        value: '[col1,col2,col3] The most common form, displaying several numeric columns in the chart',
    },
    {
        color: '#1982c4',
        label: '【col1#:#col2】 适用于bar和SLS时序库展示，col1为聚合列，col2为其他列',
        value: '[col1#:#col2] Applicable to bar and SLS metricStore, col1 is the aggregation column, col2 is other columns',
    },
];

export const xSelectOptions = [
    {
        label: 'TimeSeries / Custom',
        value: 'custom',
        description: '时序数据 Timeseries 自定义【时间列 Time colomn】，或自定义x轴输入',
    },
    { label: 'Table / Log', value: '', description: '表格或日志 table or log' },
    { label: 'Stat / Gauge', value: 'stat', description: '单值图格式 gauge/stat graph' },
    { label: 'Pie', value: 'pie', description: '饼图格式 pie graph' },
    { label: 'Bar', value: 'bar', description: '柱状图格式 bar graph' },
    { label: 'Trace', value: 'trace', description: 'Trace格式 Trace graph' },
    { label: 'Map', value: 'map', description: '地图格式 map graph' },
]

export const version = (window as any)?.grafanaBootData?.settings?.buildInfo?.version ?? '';
