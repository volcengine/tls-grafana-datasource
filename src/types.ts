import {DataSourceJsonData} from '@grafana/data';
import {DataQuery} from '@grafana/schema';

export interface MyQuery extends DataQuery {
    queryText?: string;
    constant: number;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
    constant: 6.5,
};

/**
 * These are options configured for each DataSource instance
 */
export interface TlsDataSourceOptions extends DataSourceJsonData {
    endpoint?: string;
    region?: string;
    topic?: string;
    accessKeyId?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface TlsSecureJsonData {
    accessKeySecret?: string;
}
