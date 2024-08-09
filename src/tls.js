import * as CryptoJS from 'crypto-js/crypto-js';

const util = {
    crypto: {
        hmac: function hmac(key, string) {
            return CryptoJS.HmacSHA256(string, key);
        },

        sha256: function sha256(data) {
            return CryptoJS.SHA256(data);
        },
    },
};

/**
 * @api private
 */
const expiresHeader = 'presigned-expires';

const unsignableHeaders = [
    'authorization',
    'content-type',
    'content-length',
    'user-agent',
    expiresHeader,
    'expect',
    'x-amzn-trace-id',
];

export class TLSService {
    constructor(tlsConfig, backendSrv) {
        this.tlsConfig = tlsConfig;
        this.backendSrv = backendSrv;
    }

    testDataSource() {
        return this.listTopics("", "sla")
    }

    listTopics(topic_id, topic_name) {
        const body = {}
        const headers = {
            'ServiceName': 'TLS',
            'AccessKey': this.tlsConfig.accessKey,
            'SecretKey': this.tlsConfig.secret,
            'Accept': '*/*',
            'Region': this.tlsConfig.region,
        };
        const {
            AccessKey,
            SecretKey,
            ServiceName,
            Region,
            isVolcEngine = 'true',
            'X-Security-Token': sessionToken,
        } = headers;

        // 经过处理的header 不再透传
        const handleKeys = [
            'AccessKey',
            'SecretKey',
            'ServiceName',
            'Region',
            'isVolcEngine',
            'X-Security-Token',
        ];
        handleKeys.forEach((key) => {
            delete headers[key];
        });

        // 构造签名对象
        let params = {"PageSize": 100, "PageNumber": 1}
        if (topic_id && topic_id.length > 0) {
            params["TopicId"] = topic_id
        }
        if (topic_name && topic_name.length > 0) {
            params["TopicName"] = topic_name
        }
        const signObj = {
            region: Region,
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'x-tls-apiversion': '0.3.0',
            }, // 默认不签名用户传递的headers 防止tlb改header导致的签名错误 本代码用于开发自测 这部分安全性可以忽略
            params: params,
            url: this.tlsConfig.url,
            method: 'GET',
            pathname: '/DescribeTopics',
            body: body,
        };
        // 执行签名
        const signer = new AWSSignersV4(signObj, ServiceName, {
            isVolcengine: true,
        });
        signer.addAuthorization({
            accessKeyId: AccessKey,
            secretAccessKey: SecretKey,
            sessionToken,
        });

        // 将签名后的headers注入到请求的headers中
        Object.keys(signer.request.headers).forEach((key) => {
            signObj.headers[key] = signer.request.headers[key]
        });
        let url = `${signObj.url}${signObj.pathname}`;
        if (params) {
            url = url + "?" + queryParamsToString(params);
        }
        return this.backendSrv.datasourceRequest({
            headers: signObj.headers,
            url: url,
            method: 'GET',
        })
    }
}

const uriEscape = (str) => {
    try {
        return encodeURIComponent(str)
            .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
            .replace(
                /[*]/g,
                (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
            );
    } catch (e) {
        return '';
    }
};

const queryParamsToString = (params, sort = true) =>
    (sort ? Object.keys(params).sort() : Object.keys(params))
        .map((key) => {
            const val = params[key];
            if (typeof val === 'undefined' || val === null) {
                return;
            }

            const escapedKey = uriEscape(key);
            if (!escapedKey) {
                return;
            }

            if (Array.isArray(val)) {
                return `${escapedKey}=${val
                    .map(uriEscape)
                    .sort()
                    .join(`&${escapedKey}=`)}`;
            }

            return `${escapedKey}=${uriEscape(val)}`;
        })
        .filter((v) => v)
        .join('&');

class AWSSignersV4 {
    constructor(request, serviceName, options) {
        this.request = request;
        this.request.headers = request.headers || {};
        this.serviceName = serviceName;
        options = options || {};
        this.signatureCache =
            typeof options.signatureCache === 'boolean'
                ? options.signatureCache
                : true;
        this.operation = options.operation;
        this.signatureVersion = options.signatureVersion;
        this.constant = options.isVolcengine
            ? {
                algorithm: 'HMAC-SHA256',
                v4Identifier: 'request',
                dateHeader: 'X-Date',
                tokenHeader: 'x-security-token',
                contentSha256Header: 'X-Content-Sha256',
                kDatePrefix: '',
            }
            : {
                algorithm: 'AWS4-HMAC-SHA256',
                v4Identifier: 'aws4_request',
                dateHeader: 'X-Amz-Date',
                tokenHeader: 'x-amz-security-token',
                contentSha256Header: 'X-Amz-Content-Sha256',
                kDatePrefix: 'AWS4',
            };
        this.bodySha256 = options.bodySha256;
    }

    addAuthorization(credentials, date) {
        const datetime = this.iso8601(date).replace(/[:\-]|\.\d{3}/g, '');
        this.addHeaders(credentials, datetime);
        this.request.headers['Authorization'] = this.authorization(
            credentials,
            datetime
        );
    }

    getAuthorization(credentials, date) {
        const datetime = this.iso8601(date).replace(/[:\-]|\.\d{3}/g, '');
        this.addHeaders(credentials, datetime);
        return this.authorization(
            credentials,
            datetime);
    }

    addHeaders(credentials, datetime) {
        this.request.headers[this.constant.dateHeader] = datetime;
        if (credentials.sessionToken) {
            this.request.headers[this.constant.tokenHeader] =
                credentials.sessionToken;
        }
        if (this.request.body) {
            let body = this.request.body;
            if (typeof body !== 'string') {
                if (body instanceof URLSearchParams) {
                    body = body.toString();
                } else {
                    body = JSON.stringify(body);
                }
            }
            this.request.headers[this.constant.contentSha256Header] =
                this.bodySha256 || util.crypto.sha256(body).toString();
        }
    }

    authorization(credentials, datetime) {
        const parts = [];
        const credString = this.credentialString(datetime);
        parts.push(
            `${this.constant.algorithm} Credential=${credentials.accessKeyId}/${credString}`
        );
        parts.push(`SignedHeaders=${this.signedHeaders()}`);
        const signature = this.signature(credentials, datetime);
        parts.push(`Signature=${signature}`);
        return parts.join(', ');
    }

    signature(credentials, datetime) {
        const signingKey = this.getSigningKey(
            credentials,
            datetime.substring(0, 8),
            this.request.region,
            this.serviceName,
            this.signatureCache
        );
        const signStr = this.stringToSign(datetime);
        return util.crypto.hmac(signingKey, signStr, 'hex');
    }

    stringToSign(datetime) {
        const parts = [];
        parts.push(this.constant.algorithm);
        parts.push(datetime);
        parts.push(this.credentialString(datetime));
        const canonicalString = this.canonicalString();
        parts.push(this.hexEncodedHash(canonicalString));

        return parts.join('\n');
    }

    canonicalString() {
        const parts = [],
            pathname = this.request.pathname || '/';

        parts.push(this.request.method.toUpperCase());
        parts.push(pathname);
        parts.push(queryParamsToString(this.request.params) || '');
        parts.push(`${this.canonicalHeaders()}\n`);
        parts.push(this.signedHeaders());
        parts.push(this.hexEncodedBodyHash());
        return parts.join('\n');
    }

    canonicalHeaders() {
        const headers = [];
        Object.keys(this.request.headers).forEach((key) => {
            headers.push([key, this.request.headers[key]]);
        });
        headers.sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1));
        const parts = [];
        headers.forEach((item) => {
            const key = item[0].toLowerCase();
            if (this.isSignableHeader(key)) {
                const value = item[1];
                if (
                    typeof value === 'undefined' ||
                    value === null ||
                    typeof value.toString !== 'function'
                ) {
                    throw new Error(`Header ${key} contains invalid value`);
                }
                parts.push(`${key}:${this.canonicalHeaderValues(value.toString())}`);
            }
        });
        return parts.join('\n');
    }

    canonicalHeaderValues(values) {
        return values.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    signedHeaders() {
        const keys = [];
        Object.keys(this.request.headers).forEach((key) => {
            key = key.toLowerCase();
            if (this.isSignableHeader(key)) {
                keys.push(key);
            }
        });
        return keys.sort().join(';');
    }

    credentialString(datetime) {
        return this.createScope(
            datetime.substring(0, 8),
            this.request.region,
            this.serviceName
        );
    }

    hexEncodedHash(string) {
        return util.crypto.sha256(string);
    }

    hexEncodedBodyHash() {
        if (this.request.headers[this.constant.contentSha256Header]) {
            return this.request.headers[this.constant.contentSha256Header];
        }

        if (this.request.body) {
            return this.hexEncodedHash(queryParamsToString(this.request.body));
        }
        return this.hexEncodedHash('');
    }

    isSignableHeader(key) {
        if (key.toLowerCase().indexOf('x-amz-') === 0) {
            return true;
        }
        return unsignableHeaders.indexOf(key) < 0;
    }

    iso8601(date) {
        if (date === undefined) {
            date = new Date();
        }
        return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }

    getSigningKey(credentials, date, region, service) {

        const kDate = util.crypto.hmac(
            `${this.constant.kDatePrefix}${credentials.secretAccessKey}`,
            date
        );
        // debugger;
        const kRegion = util.crypto.hmac(kDate, region);
        const kService = util.crypto.hmac(kRegion, service);

        const signingKey = util.crypto.hmac(kService, this.constant.v4Identifier);

        return signingKey;
    }

    createScope(date, region, serviceName) {
        return [
            date.substring(0, 8),
            region,
            serviceName,
            this.constant.v4Identifier,
        ].join('/');
    }
}

