import React, {ChangeEvent, useRef, useState} from 'react';
import {VariableQuery} from '../types';
import {TlsDataSource} from '../tlsDataSource';
import {AsyncSelect, InlineField, InlineFormLabel, Input, Select} from "@grafana/ui";
import {RegionOptions} from "./const";
import {SelectableValue} from "@grafana/data";
import {getBackendSrv} from "@grafana/runtime";
import {getHostByRegion, uuidRegex} from "./QueryEditor";
// @ts-ignore
import {TLSService} from "../tls";


interface VariableQueryProps {
    query: VariableQuery;
    onChange: (query: VariableQuery) => void;
    datasource: TlsDataSource;
}

export const VariableQueryEditor = ({query, onChange, datasource }: VariableQueryProps) => {
    const [state, setState] = useState(query);
    const dsConf = datasource.data_option

    const saveQuery = () => {
        onChange(state);
    };

    const handleChange = (event: React.FormEvent<HTMLInputElement>) =>
        setState({
            ...state,
            [event.currentTarget.name]: event.currentTarget.value,
        });

    const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        onChange({...query, tls_query: event.target.value, region: regionOption, topic_id: value?.value || "", topic_label:value?.label || ""});
    };

    const {tls_query, region} = query;
    const [value, setValue] = React.useState<any>();
    const [regionOption, setRegion] = React.useState<string>("cn-beijing");
    const topicSelectOptionsRef = useRef<SelectableValue<string>>([]);
    const [customOptions, setCustomOptions] = React.useState<Array<SelectableValue<string>>>([]);

    return dsConf && dsConf.accountMode ? (
    <>
            <div className="gf-form-inline">
                <InlineField label="region" labelWidth={12}>
                    <div className="region-selector">
                        <Select
                            width={20}
                            menuShouldPortal
                            options={[...RegionOptions, ...customOptions]}
                            value={query.region}
                            allowCustomValue
                            onCreateOption={(v) => {
                                const customValue: SelectableValue<string> = { value: v, label: v };
                                setCustomOptions([...customOptions, customValue]);
                                setRegion(v);
                            }}
                            onChange={async (v) => {
                                onChange({...query, region: v.value});
                                if (v.value !== regionOption) {
                                    // @ts-ignore
                                    setValue({label: "", value: ""});
                                }
                                setRegion(v.value || "cn-beijing")
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
                    key={region}
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
                                topicSelectOptionsRef.current = options;
                                resolve(options)
                            });
                        }}
                    defaultOptions
                    defaultValue={{value: query.topic_id, label: query.topic_label} || value}
                    value={topicSelectOptionsRef?.current?.find((item: any) => item.value === value?.value) || {
                        value: value?.value,
                        label: value?.label,
                    }}
                    onChange={(e: any) => {
                        setValue(e);
                        onChange({...query, topic_id: e.value || "", topic_label: e.label || ""});
                        // saveSelection({...query, region: regionOption, topic_id: e.value || "", topic_label: e?.label});
                    }
                    }/>
            </div>
            <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
                <InlineFormLabel width={6} className="query-keyword">
                    Query
                </InlineFormLabel>
                <div style={{width: '100%'}}>
                    <Input  placeholder={`* | select distinct __container_ip__`}
                            onChange={onQueryChange} value={tls_query || ''}/>
                </div>
            </div>
        </>
        ) : (
        <>
            <div className="gf-form">
                <span className="gf-form-label width-10">Query</span>
                <Input
                    placeholder={`* | select distinct __container_ip__`}
                    name="tls_query"
                    className="gf-form-input"
                    onBlur={saveQuery}
                    onChange={handleChange}
                    value={state.tls_query}
                />
            </div>
        </>
    );
};
