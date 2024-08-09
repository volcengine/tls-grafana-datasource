import {CoreApp, DataSourceInstanceSettings} from '@grafana/data';
import {DataSourceWithBackend} from '@grafana/runtime';

import {DEFAULT_QUERY, TlsDataSourceOptions, TlsQuery} from './types';

export class TlsDataSource extends DataSourceWithBackend<TlsQuery, TlsDataSourceOptions> {
    data_option?: TlsDataSourceOptions;

    constructor(instanceSettings: DataSourceInstanceSettings<TlsDataSourceOptions>) {
        super(instanceSettings);
        this.data_option = instanceSettings.jsonData
    }

    getDefaultQuery(_: CoreApp): Partial<TlsQuery> {
        return DEFAULT_QUERY;
    }
}
