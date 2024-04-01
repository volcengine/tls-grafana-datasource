import { DataSourcePlugin } from '@grafana/data';
import { TlsDataSource } from './tlsDataSource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { TlsQuery, TlsDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<TlsDataSource, TlsQuery, TlsDataSourceOptions>(TlsDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
