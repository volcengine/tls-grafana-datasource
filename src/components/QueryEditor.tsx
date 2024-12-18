import React, {ChangeEvent, useEffect, useRef} from 'react';
import {AsyncSelect, Card, Icon, InlineField, InlineFormLabel, Input, Select, SeriesTable, Tooltip} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {TlsDataSource} from '../tlsDataSource';
import {TlsDataSourceOptions, TlsQuery} from '../types';
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
    const [value, setValue] = React.useState<any>();
    const [regionOption, setRegion] = React.useState<string>("cn-beijing");
    const topicSelectOptionsRef = useRef<SelectableValue<string>>([]);
    const [customOptions, setCustomOptions] = React.useState<Array<SelectableValue<string>>>([]);
    useEffect(() => {
        const data = loadSelection();
        if (data?.region) {
            setRegion(data.region)
        }
        if (data?.topic_id) {
            setValue({value: data.topic_id, label: data.topic_label})
        }
        // @ts-ignore
    }, []);
    // @ts-ignore
    return dsConf && dsConf.accountMode ? (
        <>
            <div className="gf-form-inline">
                <InlineField label="region" labelWidth={12}>
                    <div className="region-selector">
                        <Select
                            width={20}
                            menuShouldPortal
                            options={[...RegionOptions, ...customOptions]}
                            value={query.region || regionOption}
                            allowCustomValue
                            onCreateOption={(v) => {
                                const customValue: SelectableValue<string> = { value: v, label: v };
                                setCustomOptions([...customOptions, customValue]);
                                setRegion(v);
                            }}
                            defaultValue={query.region || loadSelection()?.region || "cn-beijing"}
                            onChange={async (v) => {
                                onChange({...query, region: v.value});
                                if (v.value !== regionOption) {
                                    // @ts-ignore
                                    setValue({label: "", value: ""});
                                }
                                setRegion(v.value || "cn-beijing")

                                // @ts-ignore
                                saveSelection({...query, region: v.value});
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
                    key={regionOption}
                    loadOptions={
                        (filterStr: string) => {
                            return new Promise<Array<SelectableValue<string>>>(async (resolve) => {
                                let key_id, key_name;
                                if (filterStr && filterStr.length > 0) {
                                    if (uuidRegex.test(filterStr)) {
                                        key_id = filterStr;
                                    } else {
                                        key_name = filterStr;
                                    }
                                }
                                let tlsConfig = {
                                    accessKey: dsConf?.accessKeyId,
                                    secret: dsConf?.accessKeySecret,
                                    url: getHostByRegion(regionOption),
                                    region: regionOption,
                                }
                                const tlsService = new TLSService(tlsConfig, getBackendSrv());
                                const options = await tlsService.listTopics(key_id, key_name).then((result: any) =>
                                    result.data.Topics.map((item: { TopicId: any; TopicName: any; }) => (
                                        {
                                            value: item.TopicId,
                                            label: `${item.TopicName} (${item.TopicId})`,
                                        })),
                                );
                                topicSelectOptionsRef.current = options;
                                resolve(options)
                            });
                        }}
                    defaultOptions
                    defaultValue={value || {value: query.topic_id, label: query.topic_label || query.topic_id }}
                    value={topicSelectOptionsRef?.current?.find((item: any) => item.value === value?.value) || {
                        value: value?.value,
                        label: value?.label,
                    }}
                    onChange={(e: any) => {
                        setValue(e);
                        onChange({...query, region: regionOption, topic_id: e.value || "",topic_label: e.label || ""});
                        saveSelection({...query, region: regionOption, topic_id: e.value || "", topic_label: e?.label});
                        if (e.value) {
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


export function getHostByRegion(region: string | undefined) {
    if (region && region.length > 0) {
        return "https://tls-" + region + ".volces.com"
    }
    return region
}

