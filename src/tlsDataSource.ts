import {CoreApp, DataQueryRequest, DataSourceInstanceSettings} from '@grafana/data';
import {DataSourceWithBackend, getBackendSrv, getTemplateSrv} from '@grafana/runtime';

import {DEFAULT_QUERY, TlsDataSourceOptions, TlsQuery, VariableQuery} from './types';
import {RegionOptions, version} from "./components/const";

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

    listTopics(region: string, topicID?: string, topicName?: string, projectName?: string, exactMatch?: boolean) {
        const params: Record<string, string> = {region};
        if (topicID) {
            params.topic_id = topicID;
        }
        if (topicName) {
            params.topic_name = topicName;
        }
        if (projectName) {
            params.project_name = projectName;
        }
        if (exactMatch) {
            params.exact_match = 'true';
        }
        return this.getResource('topics', params);
    }

    query(options: DataQueryRequest<TlsQuery>) {
        options.targets.forEach((q: TlsQuery) => {
            applyVariableOverrides(q, options);
            validateRegionTopicSelection(q, this.data_option);
            q.tls_query = replaceQueryParameters(q, options);
            q.grafana_version = version
        });
        return super.query(options);
    }

    async metricFindQuery(query: VariableQuery, options?: any) {
        if (query?.query_type === 'region') {
            return getRegionVariableValues(this.data_option);
        }
        if (query?.query_type === 'topics') {
            const region = resolveTemplateOrLiteralValue(query.region_variable || query.region, options) || this.data_option?.region || 'cn-beijing';
            const topicName = resolveTemplateOrLiteralValue(query.topic_name, options);
            const projectName = resolveTemplateOrLiteralValue(query.project_name, options);
            return this.listTopics(region, undefined, topicName, projectName, true).then((result: any) =>
                getTopicsFromResourceResult(result).map((item: { TopicId: string; TopicName: string; ProjectId?: string; }) => ({
                    text: `${item.TopicName} (${item.TopicId})`,
                    value: item.TopicId,
                }))
            );
        }
        const Region = query?.region ? getTemplateSrv().replace(query.region) : '';
        const Regions = query?.regions?.length ? query.regions.map((region) => getTemplateSrv().replace(region)) : [];
        const TopicID = query?.topic_id ? getTemplateSrv().replace(query.topic_id) : '';
        const TopicIDs = query?.topic_ids?.length ? query.topic_ids.map((topic) => getTemplateSrv().replace(topic)) : [];
        const RegionTopics = query?.region_topics?.length ? query.region_topics.map((regionTopic) => ({
            region: getTemplateSrv().replace(regionTopic.region),
            topic_id: getTemplateSrv().replace(regionTopic.topic_id),
            topic_label: regionTopic.topic_label,
        })) : [];
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
                        regions: Regions,
                        topic_id: TopicID,
                        topic_ids: TopicIDs,
                        region_topics: RegionTopics,
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

function getTopicsFromResourceResult(result: any) {
    return Array.isArray(result?.Topics) ? result.Topics : [];
}

function getRegionVariableValues(dsOptions?: TlsDataSourceOptions) {
    const regionOptions = [...RegionOptions];
    const configuredRegion = dsOptions?.region?.trim();

    if (configuredRegion && !regionOptions.some((item) => item.value === configuredRegion)) {
        regionOptions.unshift({
            label: configuredRegion,
            value: configuredRegion,
            description: 'Configured custom region',
        });
    }

    return regionOptions.map((item) => ({
        text: item.label,
        value: item.value,
    }));
}

function applyVariableOverrides(query: TlsQuery, options: DataQueryRequest<TlsQuery>) {
    const regionVariable = query.region_variable || getVariableRef(query.region);
    const topicVariable = query.topic_variable || getVariableRef(query.topic_id);
    const variableRegions = resolveTemplateValues(regionVariable, options);
    const variableTopics = resolveTemplateValues(topicVariable, options);

    if (variableRegions.length > 0) {
        query.region = variableRegions[0];
        query.regions = variableRegions;
    }

    if (variableTopics.length > 0) {
        const regionTopicsFromVariable = parseRegionTopicValues(variableTopics);
        if (regionTopicsFromVariable.length > 0) {
            query.region_topics = regionTopicsFromVariable;
            query.region = regionTopicsFromVariable[0].region;
            query.regions = Array.from(new Set(regionTopicsFromVariable.map((item) => item.region)));
            query.topic_id = regionTopicsFromVariable[0].topic_id;
            query.topic_ids = regionTopicsFromVariable.map((item) => item.topic_id);
            query.topic_labels = regionTopicsFromVariable.map((item) => item.topic_label || item.topic_id);
            return;
        }

        query.topic_id = variableTopics[0];
        query.topic_ids = variableTopics;
        query.topic_labels = variableTopics;

        const effectiveRegions = variableRegions.length > 0
            ? variableRegions
            : (query.regions?.length ? query.regions : (query.region ? [query.region] : []));

        if (effectiveRegions.length === 1) {
            query.region_topics = variableTopics.map((topic) => ({
                region: effectiveRegions[0],
                topic_id: topic,
                topic_label: topic,
            }));
        } else if (effectiveRegions.length === variableTopics.length) {
            query.region_topics = variableTopics.map((topic, index) => ({
                region: effectiveRegions[index],
                topic_id: topic,
                topic_label: topic,
            }));
        }
    } else if (variableRegions.length === 1 && query.region_topics?.length) {
        query.region_topics = query.region_topics.map((item) => ({
            ...item,
            region: variableRegions[0],
        }));
    }
}

function parseRegionTopicValues(values: string[]) {
    return values
        .map((value) => {
            const parts = value.split(/[:|]/);
            if (parts.length < 2) {
                return undefined;
            }
            const region = parts[0].trim();
            const topic = parts.slice(1).join(':').trim();
            if (!region || !topic) {
                return undefined;
            }
            return {
                region,
                topic_id: topic,
                topic_label: topic,
            };
        })
        .filter(Boolean) as Array<{ region: string; topic_id: string; topic_label: string }>;
}

function resolveFirstTemplateValue(value: string | undefined, options: any) {
    return resolveTemplateValues(value, options)[0] || '';
}

function resolveTemplateOrLiteralValue(value: string | undefined, options: any) {
    const raw = value?.trim();
    if (!raw) {
        return '';
    }
    if (!raw.startsWith('$')) {
        return raw;
    }
    return resolveFirstTemplateValue(raw, options);
}

function getVariableRef(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed?.startsWith('$') ? trimmed : '';
}

function resolveTemplateValues(value: string | undefined, options: any): string[] {
    const raw = value?.trim();
    if (!raw) {
        return [];
    }
    const replaced = getTemplateSrv().replace(raw, options?.scopedVars, 'csv');
    if (!replaced || (raw.startsWith('$') && replaced === raw)) {
        return [];
    }
    return String(replaced)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter((item) => item && item !== '$__all' && item !== 'All' && item !== '.*');
}

function validateRegionTopicSelection(query: TlsQuery, dsOptions?: TlsDataSourceOptions) {
    if (!dsOptions?.accountMode) {
        return;
    }
    const regions = Array.from(new Set((query?.regions || []).map((region) => region?.trim()).filter(Boolean)));
    if (regions.length <= 1) {
        return;
    }
    const regionSet = new Set(
        (query?.region_topics || [])
            .map((item) => item?.region?.trim())
            .filter(Boolean)
    );
    const missingRegions = regions.filter((region) => !regionSet.has(region));
    if (missingRegions.length > 0) {
        throw new Error(`Please select at least one topic for each selected region: ${missingRegions.join(',')}`);
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
