import { DataSourceInstanceSettings, CoreApp } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { TlsQuery, TlsDataSourceOptions, DEFAULT_QUERY } from './types';

export class TlsDataSource extends DataSourceWithBackend<TlsQuery, TlsDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<TlsDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<TlsQuery> {
    return DEFAULT_QUERY;
  }
}
