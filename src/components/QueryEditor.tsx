import React, {ChangeEvent} from 'react';
import {Card, Icon, InlineField, InlineFormLabel, Input, Select, SeriesTable, Tooltip} from '@grafana/ui';
import {QueryEditorProps} from '@grafana/data';
import {TlsDataSource} from '../tlsDataSource';
import {TlsDataSourceOptions, TlsQuery} from '../types';
import {version, xColInfoSeries, xSelectOptions, yColInfoSeries} from "./const";

type Props = QueryEditorProps<TlsDataSource, TlsQuery, TlsDataSourceOptions>;

export function QueryEditor({query, onChange, onRunQuery}: Props) {
    const onXChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, xcol: event.target.value});
    };

    const onYChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, ycol: event.target.value});
        // executes the query
        onRunQuery();
    };
    const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, tls_query: event.target.value});
    };
    const {ycol, xcol, tls_query} = query;

    return (
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
