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
];

export const yColInfoSeries = [
    {
        color: '#ffca3a',
        label: '【无需填写】 Log、表格全列展示',
        value: '[No need to fill in] Log、table show all columns',
    },
    {
        color: '#8ac926',
        label: '【col1,col2,col3】 展示指定的数值列',
        value: '[col1,col2,col3] Displaying specified columns',
    },
];

export const xSelectOptions = [
    {
        label: 'TimeSeries / Custom',
        value: 'custom',
        description: '时序数据 Timeseries 自定义【时间列 Time colomn】，或自定义x轴输入',
    },
    {label: 'Table / Log', value: 'table', description: '表格或日志 table or log'},
    {label: 'Stat / Gauge', value: 'stat', description: '单值图格式 gauge/stat graph'},
    {label: 'Pie', value: 'pie', description: '饼图格式 pie graph'},
    {label: 'Bar', value: 'bar', description: '柱状图格式 bar graph'},
]

export const RegionOptions = [
    {label: '北京', value: 'cn-beijing', description: ''},
    {label: '广州', value: 'cn-guangzhou', description: ''},
    {label: '上海', value: 'cn-shanghai', description: ''},
    {label: '柔佛', value: 'ap-southeast-1', description: ''},
]
export const version = (window as any)?.grafanaBootData?.settings?.buildInfo?.version ?? '';
