import React, {ChangeEvent, useEffect} from 'react';
import {InlineField, InlineSwitch, Input, SecretInput} from '@grafana/ui';
import {DataSourcePluginOptionsEditorProps} from '@grafana/data';
import {TlsDataSourceOptions, TlsSecureJsonData} from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TlsDataSourceOptions, TlsSecureJsonData> {
}

export function ConfigEditor(props: Props) {
    const {onOptionsChange, options} = props;
    const migrateLegacySecret = (nextOptions = options) => {
        const legacySecret = nextOptions.jsonData.accessKeySecret;
        if (!legacySecret) {
            return nextOptions;
        }
        const jsonData = {
            ...nextOptions.jsonData,
        };
        delete jsonData.accessKeySecret;
        return {
            ...nextOptions,
            jsonData,
            secureJsonData: {
                ...nextOptions.secureJsonData,
                accessKeySecret: nextOptions.secureJsonData?.accessKeySecret || legacySecret,
            },
            secureJsonFields: {
                ...nextOptions.secureJsonFields,
                accessKeySecret: false,
            },
        };
    };
    useEffect(() => {
        if (options.jsonData.accessKeySecret) {
            onOptionsChange(migrateLegacySecret());
        }
        // Run only when the editor receives an old datasource with secret in jsonData.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onEndpointChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            endpoint: event.target.value,
        };
        onOptionsChange(migrateLegacySecret({...options, jsonData}));
    };

    const onRegionChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            region: event.target.value,
        };
        onOptionsChange(migrateLegacySecret({...options, jsonData}));
    };
    const onSelectedChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            accountMode: event.currentTarget.checked,
        };
        onOptionsChange(migrateLegacySecret({...options, jsonData}));
    };
    const onTopicChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            topic: event.target.value,
        };
        onOptionsChange(migrateLegacySecret({...options, jsonData}));
    };

    const onAccessKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
            accessKeyId: event.target.value,
        };
        onOptionsChange(migrateLegacySecret({...options, jsonData}));
    };
    const onSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
        const jsonData = {
            ...options.jsonData,
        };
        delete jsonData.accessKeySecret;
        onOptionsChange({
            ...options,
            jsonData,
            secureJsonData: {
                ...options.secureJsonData,
                accessKeySecret: event.target.value,
            },
            secureJsonFields: {
                ...options.secureJsonFields,
                accessKeySecret: false,
            },
        });
    };
    const onSecretReset = () => {
        const jsonData = {
            ...options.jsonData,
        };
        delete jsonData.accessKeySecret;
        onOptionsChange({
            ...options,
            jsonData,
            secureJsonData: {
                ...options.secureJsonData,
                accessKeySecret: '',
            },
            secureJsonFields: {
                ...options.secureJsonFields,
                accessKeySecret: false,
            },
        });
    };

    const {jsonData, secureJsonData, secureJsonFields} = options;
    const legacyAccessKeySecret = jsonData.accessKeySecret || '';

    return (
        <div className="gf-form-group">
            <InlineField label="AccountMode" labelWidth={17}>
                <InlineSwitch
                    label="AccountMode"
                    value={jsonData.accountMode || false}
                    onChange={onSelectedChange}
                />
            </InlineField>
            <InlineField label="AccessKeyId *" labelWidth={17}>
                <Input
                    onChange={onAccessKeyChange}
                    value={jsonData.accessKeyId || ''}
                    placeholder=""
                    width={65}
                />
            </InlineField>
            <InlineField label="AccessKeySecret *" labelWidth={17}>
                <SecretInput
                    onChange={onSecretChange}
                    value={secureJsonData?.accessKeySecret || legacyAccessKeySecret}
                    isConfigured={Boolean(secureJsonFields?.accessKeySecret) && !legacyAccessKeySecret}
                    onReset={onSecretReset}
                    placeholder={secureJsonFields?.accessKeySecret ? 'configured' : ''}
                    width={65}
                />
            </InlineField>
            <InlineField label="Endpoint" labelWidth={17}>
                <Input
                    onChange={onEndpointChange}
                    value={jsonData.endpoint || ''}
                    placeholder="非Account模式或Account模式需要自定义接入点时需要填写"
                    width={65}
                />
            </InlineField>
            <InlineField label="Region" labelWidth={17}>
                <Input
                    onChange={onRegionChange}
                    value={jsonData.region || ''}
                    placeholder="非Account模式或Account模式需要自定义接入点时需要填写"
                    width={65}
                />
            </InlineField>
            {
                !jsonData.accountMode && <InlineField label="Topic *" labelWidth={17}>
                    <Input
                        onChange={onTopicChange}
                        value={jsonData.topic || ''}
                        placeholder=""
                        width={65}
                    />
                </InlineField>
            }

        </div>
    );
}
