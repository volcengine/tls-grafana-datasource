import React, {ChangeEvent} from 'react';
import {InlineField, InlineSwitch, Input} from '@grafana/ui';
import {DataSourcePluginOptionsEditorProps} from '@grafana/data';
import {TlsDataSourceOptions} from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TlsDataSourceOptions> {
}

export function ConfigEditor(props: Props) {
    const {onOptionsChange, options} = props;
    const onEndpointChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            endpoint: event.target.value,
        };
        onOptionsChange({...options, jsonData});
    };

    const onRegionChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            region: event.target.value,
        };
        onOptionsChange({...options, jsonData});
    };
    const onSelectedChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            accountMode: event.currentTarget.checked,
        };
        onOptionsChange({...options, jsonData});
    };
    const onTopicChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            topic: event.target.value,
        };
        onOptionsChange({...options, jsonData});
    };

    const onAccessKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            accessKeyId: event.target.value,
        };
        onOptionsChange({...options, jsonData});
    };
    const onSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            accessKeySecret: event.target.value,
        };
        onOptionsChange({...options, jsonData});
    };

    const {jsonData} = options;

    return (
        <div className="gf-form-group">
            <InlineField label="AccountMode" labelWidth={16}>
                <InlineSwitch
                    label="AccountMode"
                    value={jsonData.accountMode || false}
                    onChange={onSelectedChange}
                />
            </InlineField>
            {
                !jsonData.accountMode && <InlineField label="Endpoint" labelWidth={16}>
                    <Input
                        onChange={onEndpointChange}
                        value={jsonData.endpoint || ''}
                        placeholder="https://tls-cn-beijing.volces.com"
                        width={65}
                    />
                </InlineField>
            }
            {
                !jsonData.accountMode && <InlineField label="Region" labelWidth={16}>
                    <Input
                        onChange={onRegionChange}
                        value={jsonData.region || ''}
                        placeholder="cn-beijing"
                        width={65}
                    />
                </InlineField>
            }
            {
                !jsonData.accountMode && <InlineField label="Topic" labelWidth={16}>
                    <Input
                        onChange={onTopicChange}
                        value={jsonData.topic || ''}
                        placeholder=""
                        width={65}
                    />
                </InlineField>
            }

            <InlineField label="AccessKeyId" labelWidth={16}>
                <Input
                    onChange={onAccessKeyChange}
                    value={jsonData.accessKeyId || ''}
                    placeholder=""
                    width={65}
                />
            </InlineField>
            <InlineField label="AccessKeySecret" labelWidth={16}>
                <Input
                    onChange={onSecretChange}
                    value={jsonData.accessKeySecret || ''}
                    placeholder=""
                    width={65}
                />
            </InlineField>
        </div>
    );
}
