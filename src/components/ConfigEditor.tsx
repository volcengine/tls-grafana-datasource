import React, {ChangeEvent} from 'react';
import {InlineField, Input, SecretInput} from '@grafana/ui';
import {DataSourcePluginOptionsEditorProps} from '@grafana/data';
import {TlsDataSourceOptions, TlsSecureJsonData} from '../types';

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

    // Secure field (only sent to the backend)
    const onSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
        onOptionsChange({
            ...options,
            secureJsonData: {
                accessKeySecret: event.target.value,
            },
        });
    };

    const onResetSecret = () => {
        onOptionsChange({
            ...options,
            secureJsonFields: {
                ...options.secureJsonFields,
                accessKeySecret: false,
            },
            secureJsonData: {
                ...options.secureJsonData,
                accessKeySecret: '',
            },
        });
    };

    const {jsonData, secureJsonFields} = options;
    const secureJsonData = (options.secureJsonData || {}) as TlsSecureJsonData;

    return (
        <div className="gf-form-group">
            <InlineField label="Endpoint" labelWidth={16}>
                <Input
                    onChange={onEndpointChange}
                    value={jsonData.endpoint || ''}
                    placeholder="https://tls-cn-beijing.volces.com"
                    width={65}
                />
            </InlineField>
            <InlineField label="Region" labelWidth={16}>
                <Input
                    onChange={onRegionChange}
                    value={jsonData.region || ''}
                    placeholder="cn-beijing"
                    width={65}
                />
            </InlineField>
            <InlineField label="Topic" labelWidth={16}>
                <Input
                    onChange={onTopicChange}
                    value={jsonData.topic || ''}
                    placeholder=""
                    width={65}
                />
            </InlineField>
            <InlineField label="AccessKeyId" labelWidth={16}>
                <Input
                    onChange={onAccessKeyChange}
                    value={jsonData.accessKeyId || ''}
                    placeholder=""
                    width={65}
                />
            </InlineField>
            <InlineField label="AccessKeySecret" labelWidth={16}>
                <SecretInput
                    isConfigured={(secureJsonFields && secureJsonFields.accessKeySecret) as boolean}
                    value={secureJsonData.accessKeySecret || ''}
                    placeholder=""
                    width={65}
                    onReset={onResetSecret}
                    onChange={onSecretChange}
                />
            </InlineField>
        </div>
    );
}
