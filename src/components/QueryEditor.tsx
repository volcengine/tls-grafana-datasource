import React, {ChangeEvent} from 'react';
import {Card, Icon, InlineField, Input, SeriesTable, Tooltip} from '@grafana/ui';
import {QueryEditorProps} from '@grafana/data';
import {DataSource} from '../datasource';
import {TlsDataSourceOptions, TlsQuery} from '../types';
import {version, xColInfoSeries, yColInfoSeries} from "./const";

type Props = QueryEditorProps<DataSource, TlsQuery, TlsDataSourceOptions>;

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
                <InlineField label="query">
                    <Input onChange={onQueryChange} value={tls_query || ''}/>
                </InlineField>
            </div>
            <div className="gf-form-inline" style={{lineHeight: '32px', verticalAlign: 'center'}}>
                <InlineField label="ycol" labelWidth={16}>
                    <Input onChange={onYChange} value={ycol || ''} width={8}
                           suffix={
                               <Tooltip content={<SelectTips type="ycol"/>} interactive theme="info-alt">
                                   <Icon name="question-circle"/>
                               </Tooltip>
                           }/>
                </InlineField>
                <InlineField label="xcol">
                    <Input onChange={onXChange} value={xcol || ''}/>

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
