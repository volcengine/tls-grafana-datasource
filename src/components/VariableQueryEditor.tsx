import React, {ChangeEvent, useRef, useState} from 'react';
import {VariableQuery} from '../types';
import {TlsDataSource} from '../tlsDataSource';
import {AsyncSelect, InlineField, InlineFormLabel, Input, Select} from "@grafana/ui";
import {RegionOptions} from "./const";
import {SelectableValue} from "@grafana/data";
import {getTemplateSrv} from "@grafana/runtime";
import {uuidRegex} from "./QueryEditor";


interface VariableQueryProps {
    query: VariableQuery;
    onChange: (query: VariableQuery) => void;
    datasource: TlsDataSource;
}

export const VariableQueryEditor = ({query, onChange, datasource}: VariableQueryProps) => {
    const [state, setState] = useState(query);
    const dsConf = datasource.data_option
    const queryType = query.query_type || 'logs';

    const saveQuery = () => {
        onChange(state);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
        setState({
            ...state,
            [event.currentTarget.name]: event.currentTarget.value,
        });

    const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        // @ts-ignore
        // onChange({...query, tls_query: event.target.value, region: regionOption, topic_id: value?.value || "", topic_label:value?.label || ""});
        onChange({...query, tls_query: event.target.value});
    };

    const {tls_query, region} = query;
    const [value, setValue] = React.useState<any>(() => {
        if (!query.topic_id) {
            return undefined;
        }
        return query.topic_id.startsWith('$')
            ? buildVariableOption(query.topic_id)
            : {value: query.topic_id, label: query.topic_label || query.topic_id};
    });
    const [regionOption, setRegion] = React.useState<string>("cn-beijing");
    const topicSelectOptionsRef = useRef<Array<SelectableValue<string>>>([]);
    const [customOptions, setCustomOptions] = React.useState<Array<SelectableValue<string>>>([]);
    const variableOptions = React.useMemo(() => getDashboardVariableOptions(), []);
    const regionVariableOptions = variableOptions.map((item) => ({
        ...item,
        description: 'Use selected dashboard variable value as region',
    }));
    const topicVariableOptions = variableOptions.map((item) => ({
        ...item,
        description: 'Use selected dashboard variable value as topic',
    }));
    const queryTypeOptions = [
        {label: 'Logs', value: 'logs'},
        {label: 'Region', value: 'region'},
        {label: 'Topic', value: 'topics'},
    ];
    const selectedQueryType = queryTypeOptions.find((item) => item.value === queryType) || queryTypeOptions[0];

    return dsConf && dsConf.accountMode ? (
        <>
            <div className="gf-form-inline">
                <InlineField label="query type" labelWidth={12}>
                    <Select
                        width={20}
                        options={queryTypeOptions}
                        value={selectedQueryType}
                        onChange={(v) => onChange({...query, query_type: v.value as 'logs' | 'topics' | 'region'})}
                    />
                </InlineField>
            </div>
            {queryType !== 'region' && (
            <div className="gf-form-inline">
                {queryType === 'topics' ? (
                    <>
                        <InlineField label="region variable" labelWidth={14}>
                            <Select
                                width={24}
                                menuShouldPortal
                                options={variableOptions}
                                value={query.region_variable ? {value: query.region_variable, label: query.region_variable} : undefined}
                                onChange={(v) => onChange({...query, region_variable: v.value || "", region: v.value || ""})}
                            />
                        </InlineField>
                        <InlineField label="projectName" labelWidth={12}>
                            <Input
                                width={30}
                                placeholder="project name or $project"
                                value={query.project_name || ''}
                                onChange={(event) => onChange({...query, project_name: event.currentTarget.value})}
                            />
                        </InlineField>
                        <InlineField label="topicName" labelWidth={12}>
                            <Input
                                width={30}
                                placeholder="topic name or $topicName"
                                value={query.topic_name || ''}
                                onChange={(event) => onChange({...query, topic_name: event.currentTarget.value})}
                            />
                        </InlineField>
                    </>
                ) : (
                    <InlineField label="region" labelWidth={12}>
                        <div className="region-selector">
                            <Select
                                width={20}
                                menuShouldPortal
                                // options={[...RegionOptions, ...customOptions]}
                                options={
                                    dsConf.region && dsConf.region.trim() !== ''
                                        ? [
                                            // 只用 dsConf.region 创建一个选项
                                            { value: dsConf.region, label: dsConf.region },
                                            ...customOptions,
                                            ...regionVariableOptions,
                                        ]
                                        : [...RegionOptions, ...customOptions, ...regionVariableOptions] // 保持原来的
                                }
                                value={query.region ? {value: query.region, label: query.region} : undefined}
                                allowCustomValue
                                onCreateOption={(v) => {
                                    const customValue: SelectableValue<string> = {value: v, label: v};
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
                )}
            </div>
            )}
            {queryType === 'logs' && (
                <>
                    <div className="gf-form-inline">
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
                                        let key_id: string | undefined;
                                        let key_name: string | undefined;
                                        if (filterStr && filterStr.length > 0) {
                                            if (uuidRegex.test(filterStr)) {
                                                key_id = filterStr;
                                            } else {
                                                key_name = filterStr;
                                            }
                                        }
                                        const selectedRegion = resolveFirstTemplateValue(query.region) || (query.region && !query.region.startsWith('$') ? query.region : '') || regionOption;
                                        const topicOptions = await datasource.listTopics(selectedRegion, key_id, key_name).then((result: any) =>
                                            result.Topics.map((item: { TopicId: any; TopicName: any; }) => (
                                                {
                                                    value: item.TopicId,
                                                    label: `${item.TopicName} (${item.TopicId})`,
                                                })),
                                        );
                                        const options = [...topicOptions, ...topicVariableOptions];
                                        topicSelectOptionsRef.current = options;
                                        resolve(options)
                                    });
                                }}
                            defaultOptions
                            defaultValue={query.topic_id ? {value: query.topic_id, label: query.topic_label || query.topic_id} : value}
                            value={topicSelectOptionsRef?.current?.find((item: any) => item.value === value?.value) || {
                                value: value?.value,
                                label: value?.label,
                            }}
                            onChange={(e: any) => {
                                setValue(e);
                                onChange({...query, topic_id: e.value || "", topic_label: e.label || e.value || ""});
                                // saveSelection({...query, region: regionOption, topic_id: e.value || "", topic_label: e?.label});
                            }
                            }/>
                    </div>
                    <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
                        <InlineFormLabel width={6} className="query-keyword">
                            Query
                        </InlineFormLabel>
                        <div style={{width: '100%'}}>
                            <Input placeholder={`* | select distinct __container_ip__`}
                                   onChange={onQueryChange} value={tls_query || ''}/>
                        </div>
                    </div>
                </>
            )}
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

const getDashboardVariableOptions = (): Array<SelectableValue<string>> => {
    const variables = (getTemplateSrv() as any).getVariables?.() || [];
    return variables
        .map((variable: any) => variable?.name)
        .filter(Boolean)
        .map((name: string) => buildVariableOption(`$${name}`));
};

const buildVariableOption = (value: string): SelectableValue<string> & { isVariable: boolean } => ({
    value,
    label: value,
    isVariable: true,
});

const resolveFirstTemplateValue = (value: string | undefined): string => {
    const raw = value?.trim();
    if (!raw || !raw.startsWith('$')) {
        return '';
    }
    const replaced = getTemplateSrv().replace(raw, undefined, 'csv');
    if (!replaced || replaced === raw) {
        return '';
    }
    return String(replaced)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .find((item) => item && item !== '$__all' && item !== 'All' && item !== '.*') || '';
};
