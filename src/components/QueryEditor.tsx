import React, {ChangeEvent} from 'react';
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
    const onXChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({...query, xcol: event.target.value, region: regionOption, topic_id: value?.value || ""});
    };

    const onYChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({...query, ycol: event.target.value, region: regionOption, topic_id: value?.value || ""});
        // executes the query
        onRunQuery();
    };
    const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({...query, tls_query: event.target.value, region: regionOption, topic_id: value?.value || ""});
        console.log(" region option ", regionOption, value)
        onRunQuery();
    };
    const {ycol, xcol, tls_query, region = "cn-beijing"} = query;
    // const topicSelectOptionsRef = useRef<SelectableValue<string>>([]);
    const [value, setValue] = React.useState();
    const [regionOption, setRegion] = React.useState<string>("cn-beijing");
    // @ts-ignore
    return dsConf && dsConf.accountMode ? (
        <>
            <div className="gf-form-inline">
                <InlineField label="region" labelWidth={12}>
                    <div className="region-selector">
                        <Select
                            width={20}
                            menuShouldPortal
                            options={RegionOptions}
                            value={regionOption}
                            onChange={async (v) => {
                                onChange({...query, region: v.value});
                                setRegion(v.value || "cn-beijing")
                                // @ts-ignore
                                setValue({label: "", value: ""});
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
                                    url: getHostByRegion(region),
                                    region: region,
                                }
                                const tlsService = new TLSService(tlsConfig, getBackendSrv());
                                const options = await tlsService.listTopics(key_id, key_name).then((result: any) =>
                                    result.data.Topics.map((item: { TopicId: any; TopicName: any; }) => (
                                        {
                                            value: item.TopicId,
                                            label: `${item.TopicName} (${item.TopicId})`,
                                        })),
                                );
                                resolve(options)
                            });
                        }}
                    defaultOptions
                    value={value}
                    onChange={(e: any) => {
                        console.log("topic change value ", e)
                        setValue(e);
                        onChange({...query, region: regionOption, topic_id: e.value || ""});
                        console.log(" region option ", regionOption, value, e.value);
                        onRunQuery();
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


function getHostByRegion(region: string | undefined) {
    if (region && region.length > 0) {
        return "https://tls-" + region + ".volces.com"
    }
    return region
}

