import {CoreApp, DataQueryRequest, DataSourceInstanceSettings} from '@grafana/data';
import {DataSourceWithBackend, getBackendSrv, getTemplateSrv} from '@grafana/runtime';

import {DEFAULT_QUERY, TlsDataSourceOptions, TlsQuery, VariableQuery} from './types';
import {version} from "./components/const";

// @ts-ignore
import {TLSService} from "../tls"
import _ from "lodash";

export class TlsDataSource extends DataSourceWithBackend<TlsQuery, TlsDataSourceOptions> {
    data_option?: TlsDataSourceOptions;

    constructor(instanceSettings: DataSourceInstanceSettings<TlsDataSourceOptions>) {
        super(instanceSettings);
        this.data_option = instanceSettings.jsonData
    }

    getDefaultQuery(_: CoreApp): Partial<TlsQuery> {
        return DEFAULT_QUERY;
    }

    query(options: DataQueryRequest<TlsQuery>) {
        options.targets.forEach((q: TlsQuery) => {
            q.tls_query = replaceQueryParameters(q, options);
            q.grafana_version = version
        });
        return super.query(options);
    }

    async metricFindQuery(query: VariableQuery, options?: any) {
        const Region = query?.region ? getTemplateSrv().replace(query.region) : '';
        const TopicID = query?.topic_id ? getTemplateSrv().replace(query.topic_id) : '';
        const Query = replaceQueryParameters(query.tls_query, options)
        if (!options.range) {
            return [];
        }
        if (Query) {
            const data = {
                from: options.range.from.valueOf().toString(),
                to: options.range.to.valueOf().toString(),
                queries: [
                    {
                        // datasource: this.name,
                        datasource: {type: this.type, uid: this.uid},
                        datasourceId: this.id,
                        region: Region,
                        topic_id: TopicID,
                        tls_query: Query,
                    },
                ],
            };
            return getBackendSrv()
                .post('/api/ds/query', data)
                .then((response) => {
                    if(response.results.A.frames.length>0) {
                        return response.results.A.frames[0].data.values;
                    }else {
                        return [];
                    }
                })
                .then(mapToTextValue);
        }
        return [];
    }
}

export function mapToTextValue(result: any) {
    if (Array.isArray(result) && result.length === 2) {
        return _.map(result[0], (d, i) => {
            return { text: d, value: result[1][i] };
        });
    }
    return _.map(result[0], (d, i) => {
        if (d && d.text && d.value) {
            return { text: d.text, value: d.value };
        } else if (_.isObject(d)) {
            return { text: d, value: i };
        }
        return { text: d, value: d };
    });
}

export function replaceQueryParameters(q: TlsQuery|string, options: DataQueryRequest<TlsQuery>) {
    if (q === undefined) {
        return "*";
    }
    if (typeof q !== "string" && q.hide) {
        return;
    }
    let varQuery;
    if (typeof q === "string") {
        varQuery = q
    }else {
        varQuery = q.tls_query
    }
    let query = getTemplateSrv().replace(
        varQuery,
        options.scopedVars,
        function (
            value: { forEach: (arg0: (v: string) => void) => void; join: (arg0: string) => void },
            variable: { multi: any; includeAll: any; name: string; label: any; description: string }
        ) {
            if (typeof value === 'object' && (variable.multi || variable.includeAll)) {
                const a: string[] = [];
                value.forEach(function (v: string) {
                    if (variable.name === variable.label || (variable.description && variable.description.indexOf('field_search') >= 0)) {
                        a.push(variable.name + ':'+v);
                    } else {
                        a.push(v);
                    }
                });
                return a.join(' OR ');
            }
            if (_.isArray(value)) {
                return value.join(' OR ');
            }
            return value;
        }
    );

    const re = /\$([0-9]+)([dmhs])/g;
    const reArray = query.match(re);
    _(reArray).forEach(function (col) {
        const old = col;
        col = col.replace('$', '');
        let sec = 1;
        if (col.indexOf('s') !== -1) {
            sec = 1;
        } else if (col.indexOf('m') !== -1) {
            sec = 60;
        } else if (col.indexOf('h') !== -1) {
            sec = 3600;
        } else if (col.indexOf('d') !== -1) {
            sec = 3600 * 24;
        }
        col = col.replace(/[smhd]/g, '');
        let v = parseInt(col, 10);
        v = v * sec;
        console.log(old, v, col, sec, query);
        query = query.replace(old, String(v));
    });
    if (query.indexOf('#time_end') !== -1) {
        query = query.replace('#time_end', String(options.range.to.unix() / 1000));
    }
    if (query.indexOf('#time_begin') !== -1) {
        query = query.replace('#time_begin', String(options.range.from.unix() / 1000));
    }
    return query;
}
