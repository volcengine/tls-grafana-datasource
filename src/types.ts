import {DataSourceJsonData} from '@grafana/data';
import {DataQuery} from '@grafana/schema';

export interface TlsQuery extends DataQuery {
    ycol?: string;
    xcol?: string;
    tls_query?: string;
    region?: string;
    topic_id?: string;
    topic_label?: string;
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
    accessKeySecret?: string;
    accountMode?: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface TlsSecureJsonData {
    accessKeySecret?: string;
}

/** 变量数据类型。字符场景为云监控配置，对象场景由内部字段决定 */
export interface VariableQuery {
    tls_query: string;
    region?: string;
    topic_id?: string;
    topic_label?: string;
}
