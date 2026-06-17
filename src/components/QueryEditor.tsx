import React, {ChangeEvent, useRef} from 'react';
import {AsyncSelect, Card, Icon, InlineField, InlineFormLabel, Input, Select, SeriesTable, Tooltip} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {TlsDataSource} from '../tlsDataSource';
import {RegionTopic, TlsDataSourceOptions, TlsQuery} from '../types';
import {RegionOptions, version, xColInfoSeries, xSelectOptions, yColInfoSeries} from "./const";
import {getBackendSrv} from "@grafana/runtime";
// @ts-ignore
import {TLSService} from "../tls"

type Props = QueryEditorProps<TlsDataSource, TlsQuery, TlsDataSourceOptions>;
export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function QueryEditor({query, onChange, onRunQuery, ...conf}: Props) {
    const dsConf = conf.datasource.data_option
    const panelId = conf.data?.request?.panelId
    const dashboardId = conf.data?.request?.dashboardUID
    const saveSelection = (value: any) => {
        if (dsConf && dsConf.accountMode) {
            localStorage.setItem(`${dashboardId}_${panelId}TLSTopicRegionSelection`, JSON.stringify(value))
        }
    }
    const loadSelection = () => {
        try {
            // @ts-ignore
            return JSON.parse(localStorage.getItem(`${dashboardId}_${panelId}TLSTopicRegionSelection`));
        } catch (e) {
            return {}
        }
    }
    const onXChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({
            ...query,
            xcol: event.target.value,
        });
        // @ts-ignore
        saveSelection({
            ...query,
            xcol: event.target.value,
        });
        onRunQuery();
    };

    const onYChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({
            ...query,
            ycol: event.target.value,
        });
        // @ts-ignore
        saveSelection({
            ...query,
            ycol: event.target.value,
        });
        // executes the query
        onRunQuery();
    };
    const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({
            ...query,
            tls_query: event.target.value,
        });
        // @ts-ignore
        saveSelection({
            ...query,
            tls_query: event.target.value,
        });
        // @ts-ignore
        onRunQuery();

    };
    const {ycol, xcol, tls_query} = query;
    // const {ycol, xcol, tls_query, region = "cn-beijing"} = query;
    // const topicSelectOptionsRef = useRef<SelectableValue<string>>([]);
    const [initialSelection] = React.useState(loadSelection);
    const initialRegionTopics = buildStoredRegionTopics(initialSelection, query);
    const [selectedRegionTopics, setSelectedRegionTopics] = React.useState<RegionTopic[]>(initialRegionTopics);
    const [value, setValue] = React.useState<any>(() => buildTopicSelectValues(initialRegionTopics));
    const [regionOptions, setRegionOptions] = React.useState<any>(() => buildRegionValues(initialSelection, query));
    const topicSelectOptionsRef = useRef<Array<SelectableValue<string>>>([]);
    const [customOptions, setCustomOptions] = React.useState<Array<SelectableValue<string>>>([]);
    // @ts-ignore
    return dsConf && dsConf.accountMode ? (
        <>
            <div className="gf-form-inline">
                <InlineField label="region" labelWidth={12}>
                    <div className="region-selector">
                        <Select
                            width={20}
                            menuShouldPortal
                            isMulti
                            options={
                                dsConf.region && dsConf.region.trim() !== ''
                                    ? [
                                        // 只用 dsConf.region 创建一个选项
                                        { value: dsConf.region, label: dsConf.region },
                                        ...customOptions
                                    ]
                                    : [...RegionOptions, ...customOptions] // 保持原来的
                            }
                            value={regionOptions}
                            allowCustomValue
                            onCreateOption={(v) => {
                                const customValue: SelectableValue<string> = {value: v, label: v};
                                setCustomOptions([...customOptions, customValue]);
                                setRegionOptions([...regionOptions, customValue]);
                            }}
                            defaultValue={regionOptions}
                            onChange={async (v) => {
                                const selectedRegions = Array.isArray(v) ? v : (v ? [v] : []);
                                const regions = selectedRegions.map((item) => item.value || "").filter(Boolean);
                                const selectedRegionSet = new Set(regions);
                                const regionTopics = selectedRegionTopics.filter((item) => selectedRegionSet.has(item.region));
                                const nextQuery = {
                                    ...query,
                                    region: regions[0] || "",
                                    regions,
                                    topic_id: regionTopics[0]?.topic_id || "",
                                    topic_label: regionTopics[0]?.topic_label || "",
                                    topic_ids: regionTopics.map((item) => item.topic_id),
                                    topic_labels: regionTopics.map((item) => item.topic_label || item.topic_id),
                                    region_topics: regionTopics,
                                };
                                setRegionOptions(selectedRegions);
                                if (regionTopics.length !== selectedRegionTopics.length) {
                                    setSelectedRegionTopics(regionTopics);
                                    setValue(buildTopicSelectValues(regionTopics));
                                }
                                onChange(nextQuery);
                                saveSelection(nextQuery);
                            }
                            }
                        />
                    </div>
                </InlineField>
                <InlineField label="topic" labelWidth={12}>
                    <div className="topic-label">
                    </div>
                </InlineField>
                <AsyncSelect
                    width={50}
                    key={getSelectedRegions(regionOptions).join(",")}
                    isMulti
                    loadOptions={
                        (filterStr: string) => {
                            return new Promise<Array<SelectableValue<string>>>(async (resolve) => {
                                let key_id: string | undefined;
                                let key_name: string | undefined;
                                if (filterStr && filterStr.length > 0) {
                                    if (uuidRegex.test(filterStr)) {
                                        key_id = filterStr;
                                    } else {
                                        key_name = filterStr;
                                    }
                                }
                                const selectedRegions = getSelectedRegions(regionOptions);
                                const options = (await Promise.all(selectedRegions.map(async (region) => {
                                    let tlsConfig = {
                                        accessKey: dsConf?.accessKeyId,
                                        secret: dsConf?.accessKeySecret,
                                        url: getHostByRegion(region, dsConf?.region, dsConf?.endpoint),
                                        region,
                                    }
                                    const tlsService = new TLSService(tlsConfig, getBackendSrv());
                                    return tlsService.listTopics(key_id, key_name).then((result: any) =>
                                        result.data.Topics.map((item: { TopicId: any; TopicName: any; }) => (
                                            {
                                                value: makeRegionTopicKey(region, item.TopicId),
                                                label: `${region} / ${item.TopicName} (${item.TopicId})`,
                                                region,
                                                topic_id: item.TopicId,
                                                topic_label: `${item.TopicName} (${item.TopicId})`,
                                            })),
                                    );
                                }))).flat();
                                topicSelectOptionsRef.current = options;
                                resolve(options)
                            });
                        }}
                    defaultOptions
                    defaultValue={value.length > 0 ? value : buildTopicSelectValues(initialRegionTopics)}
                    value={value}
                    onChange={(e: any) => {
                        const selectedTopics = Array.isArray(e) ? e : (e ? [e] : []);
                        const regionTopics = buildRegionTopicsFromValues(selectedTopics);
                        const regions = getSelectedRegions(regionOptions);
                        const nextQuery = {
                            ...query,
                            region: regions[0] || "",
                            regions,
                            topic_id: regionTopics[0]?.topic_id || "",
                            topic_label: regionTopics[0]?.topic_label || "",
                            topic_ids: regionTopics.map((item) => item.topic_id),
                            topic_labels: regionTopics.map((item) => item.topic_label || item.topic_id),
                            region_topics: regionTopics,
                        };
                        setSelectedRegionTopics(regionTopics);
                        setValue(buildTopicSelectValues(regionTopics));
                        onChange(nextQuery);
                        saveSelection(nextQuery);
                        if (regionTopics.length > 0) {
                            onRunQuery();
                        }
                    }
                    }/>
            </div>
            <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
                <InlineFormLabel width={6} className="query-keyword">
                    Query
                </InlineFormLabel>
                <div style={{width: '100%'}}>
                    <Input onChange={onQueryChange} value={tls_query || ''}/>
                </div>
            </div>
            <div className="gf-form-inline">
                <InlineField label="ycol" labelWidth={12}>
                    <Input
                        onChange={onYChange}
                        value={ycol || ''}
                        width={40}
                        prefix={<Icon name="text-fields"/>}
                        suffix={
                            <Tooltip content={<SelectTips type="ycol"/>} interactive theme="info-alt">
                                <Icon name="question-circle"/>
                            </Tooltip>
                        }/>
                </InlineField>
                <InlineField label="xcol" labelWidth={12}>
                    <div style={{display: 'flex'}}>
                        <Select
                            width={20}
                            menuShouldPortal
                            options={xSelectOptions}
                            value={onSelectChange(xcol ?? 'time')}
                            onChange={(v) => {
                                if (v.value !== 'custom') {
                                    onChange({...query, xcol: v.value});
                                    onRunQuery();
                                } else {
                                    onChange({...query, xcol: 'time'});
                                }
                            }}
                            prefix={<Icon name="palette"/>}
                        />
                        <Input onChange={onXChange}
                               value={xcol || ''}
                               width={40}
                               prefix={<Icon name="x"/>}
                               suffix={
                                   <Tooltip content={<SelectTips type="xcol"/>} interactive theme="info-alt">
                                       <Icon name="question-circle"/>
                                   </Tooltip>
                               }
                        />

                    </div>

                </InlineField>
            </div>
        </>
    ) : (
        <>
            <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
                <InlineFormLabel width={6} className="query-keyword">
                    Query
                </InlineFormLabel>
                <div style={{width: '100%'}}>
                    <Input onChange={onQueryChange} value={tls_query || ''}/>
                </div>
            </div>
            <div className="gf-form-inline">
                <InlineField label="ycol" labelWidth={12}>
                    <Input
                        onChange={onYChange}
                        value={ycol || ''}
                        width={40}
                        prefix={<Icon name="text-fields"/>}
                        suffix={
                            <Tooltip content={<SelectTips type="ycol"/>} interactive theme="info-alt">
                                <Icon name="question-circle"/>
                            </Tooltip>
                        }/>
                </InlineField>
                <InlineField label="xcol" labelWidth={12}>
                    <div style={{display: 'flex'}}>
                        <Select
                            width={20}
                            menuShouldPortal
                            options={xSelectOptions}
                            value={onSelectChange(xcol ?? 'time')}
                            onChange={(v) => {
                                if (v.value !== 'custom') {
                                    onChange({...query, xcol: v.value});
                                    onRunQuery();
                                } else {
                                    onChange({...query, xcol: 'time'});
                                }
                            }}
                            prefix={<Icon name="palette"/>}
                        />
                        <Input onChange={onXChange}
                               value={xcol || ''}
                               width={40}
                               prefix={<Icon name="x"/>}
                               suffix={
                                   <Tooltip content={<SelectTips type="xcol"/>} interactive theme="info-alt">
                                       <Icon name="question-circle"/>
                                   </Tooltip>
                               }
                        />

                    </div>

                </InlineField>
            </div>
        </>
    );
}


export function SelectTips(props: { type: string }) {
    const isOld =
        version === '' ||
        version.startsWith('8.0') ||
        version.startsWith('8.1') ||
        version.startsWith('8.2') ||
        version.startsWith('8.3') ||
        version.startsWith('7');
    const series = props.type === 'xcol' ? xColInfoSeries : yColInfoSeries;
    return isOld ? (
        <table>
            {series.map((v, i) => {
                return (
                    <tr key={v.color}>
                        <td style={{width: '45px'}}>{`${i + 1}.`}</td>
                        <td>{v.label}</td>
                        <td>{v.value}</td>
                    </tr>
                );
            })}
        </table>
    ) : (
        <Card>
            <Card.Heading>{`${props.type} 简介 Introduction`}</Card.Heading>
            <Card.Description>
                <SeriesTable series={series}/>
            </Card.Description>
        </Card>
    );
}

const onSelectChange = (realXCol: string) => {
    if (xSelectOptions.find((e) => e.value === realXCol)) {
        return realXCol;
    }
    return 'custom';
};

const buildStoredRegionTopics = (data: any, query: TlsQuery): RegionTopic[] => {
    const regionTopics: RegionTopic[] = Array.isArray(data?.region_topics) && data.region_topics.length > 0
        ? data.region_topics
        : Array.isArray(query.region_topics) && query.region_topics.length > 0
            ? query.region_topics
            : [];
    if (regionTopics.length > 0) {
        return regionTopics;
    }
    const ids = Array.isArray(data?.topic_ids) && data.topic_ids.length > 0
        ? data.topic_ids
        : Array.isArray(query.topic_ids) && query.topic_ids.length > 0
            ? query.topic_ids
            : data?.topic_id
                ? [data.topic_id]
                : query.topic_id
                    ? [query.topic_id]
                    : [];
    const labels = Array.isArray(data?.topic_labels) && data.topic_labels.length > 0
        ? data.topic_labels
        : Array.isArray(query.topic_labels) && query.topic_labels.length > 0
            ? query.topic_labels
            : data?.topic_label
                ? [data.topic_label]
                : query.topic_label
                    ? [query.topic_label]
                    : [];
    const region = data?.region || query.region || "cn-beijing";

    return ids.map((id: string, index: number) => ({
        region,
        topic_id: id,
        topic_label: labels[index] || id,
    }));
};

const buildTopicSelectValues = (regionTopics: RegionTopic[]): Array<SelectableValue<string>> => {
    return regionTopics.map((item) => ({
        value: makeRegionTopicKey(item.region, item.topic_id),
        label: `${item.region} / ${item.topic_label || item.topic_id}`,
        region: item.region,
        topic_id: item.topic_id,
        topic_label: item.topic_label || item.topic_id,
    }));
};

const buildRegionValues = (data: any, query: TlsQuery): Array<SelectableValue<string>> => {
    const regions = Array.isArray(data?.regions) && data.regions.length > 0
        ? data.regions
        : Array.isArray(query.regions) && query.regions.length > 0
            ? query.regions
            : Array.isArray(data?.region_topics) && data.region_topics.length > 0
                ? Array.from(new Set(data.region_topics.map((item: RegionTopic) => item.region)))
                : Array.isArray(query.region_topics) && query.region_topics.length > 0
                    ? Array.from(new Set(query.region_topics.map((item) => item.region)))
                    : [data?.region || query.region || "cn-beijing"];
    return regions.map((region: string) => ({value: region, label: region}));
};

const getSelectedRegions = (regions: any): string[] => {
    const selectedRegions = Array.isArray(regions) ? regions : (regions ? [regions] : []);
    return selectedRegions.map((item) => item.value || "").filter(Boolean);
};

const makeRegionTopicKey = (region: string, topicId: string) => `${region}:${topicId}`;

const buildRegionTopicsFromValues = (selectedTopics: any[]): RegionTopic[] => {
    return selectedTopics.map((item) => ({
        region: item.region,
        topic_id: item.topic_id || item.value,
        topic_label: item.topic_label || item.label || item.topic_id || item.value,
    })).filter((item) => item.region && item.topic_id);
};

export function getHostByRegion(region: string | undefined, configRegion: string | undefined, endpoint: string | undefined) {
    if (region && region.length > 0) {
        if (region !== configRegion) {
            return "https://tls-" + region + ".volces.com"
        }
    }

    return endpoint
}
