import _ from "lodash";
import {TLSService} from "./tls"

export class GenericDatasource {

    constructor(instanceSettings, $q, backendSrv, templateSrv) {
        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.topic = instanceSettings.jsonData.topic;
        this.accessKey = instanceSettings.jsonData.accessKey;
        this.secret = instanceSettings.jsonData.secret;
        this.region = instanceSettings.jsonData.region;
        this.tlsConfig = {
            accessKey: this.accessKey,
            secret: this.secret,
            topic: this.topic,
            url: this.url,
            region: this.region,
        }
        this.tlsService = new TLSService(this.tlsConfig, this.backendSrv);
    }

    query(options) {
        if (options.targets.length <= 0) {
            return Promise.resolve({data: []});
        }
        const start = options.range.from._d.getTime();
        const end = options.range.to._d.getTime();
        const query = this.buildSearchParameters(options);
        let promise = Promise.resolve();
        const queries = []
        _(query.targets).forEach(target => {
            const refId = target.refId;
            const body = {
                'TopicId': this.tlsConfig.topic,
                'Query': target.query,
                'StartTime': start,
                'EndTime': end,
                'Limit': 1000,
                'Sort': 'desc'
            }
            // 检索结果
            const req = this.tlsService.searchLogs(body).then(function (result) {
                // 分析和检索数据分开处理
                if (result.data.Analysis) {
                    return result.data.AnalysisResult.Data;
                } else {
                    return result.data.Logs;
                }
            }, function (err) {
                if (err.data) {
                    return Promise.reject(new Error(JSON.stringify(err.data)))
                } else {
                    return Promise.reject(new Error("unknown error"))
                }
            }).then(function (logs) {
                // x轴名称是table就表示返回表格数据，表格只有表头y轴
                const yValues = {}
                const ycolumn = target.ycolumn.split(",")
                if (target.xcolumn === "table") {
                    const meta = []
                    _.forEach(ycolumn, item => {
                        meta.push({text: item})
                    })
                    const rows = []
                    _.forEach(logs, log => {
                        const row = [];
                        _.forEach(ycolumn, col => {
                            row.push(log[col]);
                        })
                        rows.push(row);
                    })
                    yValues[refId] = {
                        type: "table",
                        columns: meta,
                        rows: rows,
                    };
                } else {
                    // x轴不是table就是曲线图
                    const xcolumn = target.xcolumn;
                    _.forEach(logs, log => {
                        const xvalue = log[xcolumn];
                        _.forOwn(log, function (value, key) {
                            if (ycolumn.includes(key)) {
                                if (yValues[key] === undefined) {
                                    yValues[key] = {
                                        refId: refId,
                                        target: key,
                                        datapoints: [
                                            [log[key], xvalue]
                                        ]
                                    }
                                } else {
                                    yValues[key].datapoints.push([log[key], xvalue])
                                }
                            }
                        })
                    })
                    // 按照时间戳升序排序
                    _.forOwn(yValues, function (value, key) {
                        value.datapoints.sort((a, b) => {
                            if (a[1] < b[1]) {
                                return -1;
                            }
                            if (a[1] > b[1]) {
                                return 1;
                            }
                            return 0;
                        });
                    })
                }
                return yValues;
            });
            queries.push(req);
        });
        return Promise.all(queries).then(requests => {
            const dataResult = []
            _.forEach(requests, logs => {
                _.forOwn(logs, function (points, key) {
                    dataResult.push(points)
                })
            });
            return {
                data: dataResult
            }
        });
    }

    testDatasource() {
        return this.tlsService.testDataSource().then(function (result) {
            return {status: "success", message: "tls Connection OK", title: "Success"};
        }, function (err) {
            if (err.data) {
                return {status: "error", message: JSON.stringify(err.data), title: "Error"};
            } else {
                return {status: "error", message: "bad datasource params error", title: "Error"};
            }
        });
    }

    annotationQuery(options) {
        var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
        var annotationQuery = {
            range: options.range,
            annotation: {
                name: options.annotation.name,
                datasource: options.annotation.datasource,
                enable: options.annotation.enable,
                iconColor: options.annotation.iconColor,
                query: query
            },
            rangeRaw: options.rangeRaw
        };

        return this.doRequest({
            url: this.url + '/annotations',
            method: 'POST',
            data: annotationQuery
        }).then(result => {
            return result.data;
        });
    }

    metricFindQuery(query) {
        // 从topic中动态获取下拉菜单值
        const q = this.templateSrv.replace(query, {}, 'glob');
        const start = this.templateSrv.timeRange.from.unix() * 1000;
        const end = this.templateSrv.timeRange.to.unix() * 1000;
        const body = {
            'TopicId': this.tlsConfig.topic,
            'Query': q,
            'StartTime': start,
            'EndTime': end,
            'Limit': 1000,
            'Sort': 'desc'
        }
        return this.tlsService.searchLogs(body).then(this.mapToTextValue);
    }

    mapToTextValue(result) {
        let fieldName = result.data.AnalysisResult.Schema[0];
        return _.map(result.data.AnalysisResult.Data, (d) => {
            return {text: d[fieldName], value: d[fieldName]};
        });
    }

    doRequest(options) {
        options.withCredentials = this.withCredentials;
        options.headers = this.headers;
        return this.backendSrv.datasourceRequest(options);
    }

    buildSearchParameters(options) {
        options.targets = _.filter(options.targets, target => {
            return target.target !== 'select metric';
        });

        options.targets = _.map(options.targets, target => {
            return {
                target: this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                refId: target.refId,
                query: this.replaceQueryParameters(target, options),
                xcolumn: this.templateSrv.replace(target.xcolumn, options.scopedVars, 'regex'),
                ycolumn: this.templateSrv.replace(target.ycolumn, options.scopedVars, 'regex'),
                mode: target.mode
            };
        });

        return options;
    }

    replaceQueryParameters(target, options) {
        if (typeof (target.query) == "undefined") {
            target.query = "";
        }
        let query = this.templateSrv.replace(target.query, options.scopedVars, function (value, variable) {
            if (typeof value == "object" && (variable.multi || variable.includeAll)) {
                const a = [];
                value.forEach(function (v) {
                    if (variable.name == variable.label)
                        a.push(variable.name + ':"' + v + '"');
                    else
                        a.push('"' + v + '"');
                });
                return a.join(" OR ");
            }
            if (_.isArray(value)) {
                return value.join(' OR ');
            }
            return value;
        });
        const re = /\$([0-9]+)([dmhs])/g;
        const reArray = query.match(re);
        _(reArray).forEach(function (col) {
            const old = col;
            col = col.replace("$", '');
            let sec = 1000;
            if (col.indexOf("s") != -1)
                sec = 1 * sec;
            else if (col.indexOf("m") != -1)
                sec = 60 * sec;
            else if (col.indexOf("h") != -1)
                sec = 3600 * sec;
            else if (col.indexOf("d") != -1)
                sec = 3600 * 24 * sec;
            col = col.replace(/[smhd]/g, '');
            let v = parseInt(col);
            v = v * sec;
            console.log(old, v, col, sec, query);
            query = query.replace(old, v);
        });
        return query;
    }
}

