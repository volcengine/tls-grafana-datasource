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
                <Input
                    onChange={onSecretChange}
                    value={jsonData.accessKeySecret || ''}
                    placeholder=""
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
