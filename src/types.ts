import {DataSourceJsonData} from '@grafana/data';
import {DataQuery} from '@grafana/schema';

export interface TlsQuery extends DataQuery {
    ycol?: string;
    xcol?: string;
    tls_query?: string;
}

export const DEFAULT_QUERY: Partial<TlsQuery> = {
    tls_query: "*",
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
