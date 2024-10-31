package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	sdk "github.com/volcengine/volc-sdk-golang/service/tls"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, _ backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return &Datasource{}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct{}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()
	queries := req.Queries
	ch := make(chan Result, len(queries))
	var err error
	defer func() {
		close(ch)
		if r := recover(); r != nil {
			switch r.(type) {
			case string:
				err = errors.New(r.(string))
			case error:
				err = r.(error)
			}
			log.DefaultLogger.Error("QueryData recover", "error", err)
		}
	}()

	log.DefaultLogger.Info("len(queries)", "len", len(queries))
	wg := sync.WaitGroup{}
	for _, query := range queries {
		wg.Add(1)
		log.DefaultLogger.Info("range_queries", "RefID", query.RefID,
			"JSON", query.JSON, "QueryType", query.QueryType)
		go d.QueryLogs(ch, query, &req.PluginContext)
	}
	go func(chan Result) {
		for res := range ch {
			log.DefaultLogger.Info("receive resp from ch")
			response.Responses[res.refId] = res.dataResponse
			wg.Done()
		}
	}(ch)
	wg.Wait()

	return response, nil
}

type queryModel struct{}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	log.DefaultLogger.Info("CheckHealth called", "request", req)
	var status = backend.HealthStatusOk
	var message = "Data source is working"
	_, err := d.checkApi(&req.PluginContext)
	if err != nil {
		status = backend.HealthStatusError
		message = err.Error()
	}
	log.DefaultLogger.Info("CheckHealth success resp")
	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

func (d *Datasource) checkApi(ctx *backend.PluginContext) (backend.HealthStatus, error) {
	end := time.Now().UnixMilli()
	start := end - 60000
	config, cli, err := LoadCli(ctx, nil)
	if err != nil {
		return backend.HealthStatusError, err
	}
	if config.AccountMode {
		resp, err := ListProjects(cli)
		if err != nil {
			log.DefaultLogger.Error("CheckHealth error", "req_id", resp.CommonResponse.RequestID, "err", err)
			return backend.HealthStatusError, err
		}
		log.DefaultLogger.Info("CheckHealth list porjects suc", "req_id", resp.CommonResponse.RequestID)
		return backend.HealthStatusOk, nil
	}
	resp, err := SearchLogs(cli, config.Topic, "*", start, end, 1)
	if err != nil {
		log.DefaultLogger.Error("CheckHealth error", "req_id", resp.CommonResponse.RequestID, "err", err)
		return backend.HealthStatusError, err
	}
	return backend.HealthStatusOk, nil
}

func (d *Datasource) QueryLogs(ch chan Result, query backend.DataQuery, ctx *backend.PluginContext) {
	response := backend.DataResponse{}
	refId := query.RefID
	queryInfo := &QueryInfo{}
	log.DefaultLogger.Info("QueryData req", "queries", query)
	defer func() {
		queryInfo = nil
		if r := recover(); r != nil {
			log.DefaultLogger.Info("QueryData recover", "er", r)
			switch r.(type) {
			case string:
				response.Error = errors.New(r.(string))
			case error:
				response.Error = r.(error)
			}
			log.DefaultLogger.Error("QueryLogs recover", "refId", refId, "error", response.Error)
			ch <- Result{
				refId:        refId,
				dataResponse: response,
			}
		}
	}()

	err := json.Unmarshal(query.JSON, &queryInfo)
	if err != nil {
		log.DefaultLogger.Error("Unmarshal queryInfo", "refId", refId, "error", err)
		response.Error = err
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}
	config, cli, err := LoadCli(ctx, &queryInfo.Region)
	if err != nil {
		log.DefaultLogger.Error("Unmarshal queryInfo", "refId", refId, "error", err)
		response.Error = err
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}
	//1.检索日志
	from := query.TimeRange.From.UnixMilli()
	to := query.TimeRange.To.UnixMilli()
	topicId := config.Topic
	if len(queryInfo.TopicId) > 0 {
		topicId = queryInfo.TopicId
	}
	resp, err := SearchLogs(cli, topicId, queryInfo.Query, from, to, 1000)
	if err != nil {
		log.DefaultLogger.Error("SearchLogs", "query : ", queryInfo.Query, "error ", err)
		response.Error = err
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}
	logs := resp.Logs
	if resp.Analysis {
		logs = resp.AnalysisResult.Data
	}
	//2.构造结果
	if len(logs) == 0 {
		log.DefaultLogger.Warn("SearchLogs resp nil")
		response.Frames = data.Frames{}
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}

	xcol := strings.TrimSpace(queryInfo.Xcol)
	ycols := strings.Split(strings.TrimSpace(queryInfo.Ycol), ",")
	res := d.buildDataFrame(xcol, ycols, logs)
	response.Frames = res
	ch <- Result{
		refId:        refId,
		dataResponse: response,
	}
}

func (d *Datasource) buildDataFrame(xcol string, ycols []string, logs []map[string]interface{}) data.Frames {
	if xcol == "bar" {
		log.DefaultLogger.Info("bar")
		return d.BuildBar(logs, ycols)
	} else if xcol == "pie" {
		log.DefaultLogger.Info("pie")
		return d.BuildPie(logs, ycols)
	} else if len(xcol) > 0 && xcol != "table" {
		log.DefaultLogger.Info("time-series")
		return d.BuildTimeSeries(logs, xcol, ycols)
	}
	log.DefaultLogger.Info("table")
	return d.BuildTable(logs, xcol, ycols)
}

func (d *Datasource) BuildBar(logs []map[string]interface{}, ycols []string) data.Frames {
	frames := data.Frames{}
	if len(ycols) < 2 {
		return frames
	}
	frame := data.NewFrame("response")
	numMap := make(map[string][]float64)
	for _, ycol := range ycols[1:] {
		numMap[ycol] = make([]float64, 0)
	}
	strKey := ycols[0]
	var strArr []string
	for _, alog := range logs {
		for k, v := range alog {
			if k == strKey {
				strArr = append(strArr, v.(string))
			} else if numMap[k] != nil {
				res, err := parseNumberFloat(v)
				if err != nil {
					log.DefaultLogger.Info("BuildBar skip value set ", "key", k)
					continue
				}
				numMap[k] = append(numMap[k], res)
			}
		}
	}
	frame.Fields = append(frame.Fields, data.NewField(strKey, nil, strArr))
	for _, ycol := range ycols[1:] {
		frame.Fields = append(frame.Fields, data.NewField(ycol, nil, numMap[ycol]))
	}
	frames = append(frames, frame)
	return frames
}

func (d *Datasource) BuildPie(logs []map[string]interface{}, ycols []string) data.Frames {
	frames := data.Frames{}
	if len(ycols) != 2 {
		return frames
	}
	fieldMap := make(map[string][]float64)
	var labelArr []string
	for _, alog := range logs {
		if alog[ycols[0]] == nil {
			labelArr = append(labelArr, "null")
		} else {
			labelArr = append(labelArr, alog[ycols[0]].(string))
		}
	}
	for _, label := range labelArr {
		exist := false
		for _, alog := range logs {
			value := alog[ycols[0]]
			floatV, err := parseNumberFloat(alog[ycols[1]])
			if err != nil {
				log.DefaultLogger.Info("BuildPie", "ParseFloat", err, "value", alog[ycols[1]])
			}
			if value == nil && label == "null" || (value != nil && value.(string) == label) {
				fieldMap[label] = append(fieldMap[label], floatV)
				exist = true
			}
		}
		if !exist {
			fieldMap[label] = append(fieldMap[label], 0)
		}
	}
	frame := data.NewFrame("response")
	for _, v := range labelArr {
		frame.Fields = append(frame.Fields, data.NewField(v, nil, fieldMap[v]))
	}
	frames = append(frames, frame)
	return frames
}

func SortLogs(logs []map[string]interface{}, col string) {
	sort.Slice(logs, func(i, j int) bool {
		iValue, err := parseNumberFloat(logs[i][col])
		if err != nil {
			return false
		}
		jValue, err := parseNumberFloat(logs[j][col])
		if err != nil {
			return false
		}
		return iValue < jValue
	})
}

func (d *Datasource) BuildTimeSeries(logs []map[string]interface{}, xcol string, ycols []string) data.Frames {
	frames := data.Frames{}
	xcols := strings.Split(xcol, ",")
	xLens := len(xcols)
	if xLens == 0 {
		return frames
	}
	dimKeys := make(map[string]bool, 0)
	multiDimen := xLens > 1
	if multiDimen {
		for _, tlsLog := range logs {
			xValues := getXValues(tlsLog, xcols)
			for _, y := range ycols {
				dimKey := getLogDimKey(xValues, y)
				dimKeys[dimKey] = true
			}
			//字段裁剪，最多展示100个折线
			if len(ycols)*len(dimKeys) >= 100 {
				break
			}
		}
	}

	timeCol := xcols[0]
	SortLogs(logs, timeCol)
	log.DefaultLogger.Info("build time series", "logs", logs, "xcol", xcol, "ycols")
	frame := data.NewFrame("time_series")
	if len(ycols) == 1 && ycols[0] == "" {
		ycols = ycols[:0]
		for k, _ := range logs[0] {
			if k != xcol {
				ycols = append(ycols, k)
			}
		}
	}
	fieldMap := make(map[string][]float64)
	if multiDimen {
		for k, _ := range dimKeys {
			if k != timeCol {
				fieldMap[k] = make([]float64, 0)
			}
		}
	} else {
		for _, v := range ycols {
			if v != timeCol {
				fieldMap[v] = make([]float64, 0)
			}
		}
	}

	var err error
	times := make([]time.Time, 0)
	timeDict := make(map[int64]bool, 0)
	for _, tlsLog := range logs {
		// x轴包含维度，做多维转换。比如把x:[time,region]y:[cnt,sum]转换为x:[time],y:[sum*gz,sum*sh,cnt*gz,cnt*sh]
		if multiDimen {
			xValues := getXValues(tlsLog, xcols)
			for _, ycol := range ycols {
				key := getLogDimKey(xValues, ycol)
				if val, ok := tlsLog[ycol]; ok {
					res := float64(0)
					if res, err = parseNumberFloat(val); err != nil {
						log.DefaultLogger.Info("BuildTimeSeries skip key", "key", key, "val", val)
						continue
					}
					if _, ok := fieldMap[key]; ok {
						fieldMap[key] = append(fieldMap[key], res)
					}
				}
			}
		}
		for k, v := range tlsLog {
			res := float64(0)
			if res, err = parseNumberFloat(v); err != nil {
				log.DefaultLogger.Info("BuildTimeSeries skip key", "key", k)
				continue
			}
			if xcol != "" && k == timeCol {
				msec := int64(res)
				if multiDimen && timeDict[msec] {
					continue
				}
				times = append(times, time.UnixMilli(msec))
				timeDict[msec] = true
			} else if !multiDimen {
				if _, ok := fieldMap[k]; ok {
					fieldMap[k] = append(fieldMap[k], res)
				}
			}
		}
	}
	lenTime := len(times)
	sortFields := make([]string, 0)
	for k, _ := range fieldMap {
		sortFields = append(sortFields, k)
	}
	slices.Sort(sortFields)
	for _, f := range sortFields {
		v := fieldMap[f]
		if len(v) < lenTime {
			for i := len(v); i < lenTime; i++ {
				v = append(v, float64(0))
			}
		}
		frame.Fields = append(frame.Fields, data.NewField(f, nil, v))
	}
	if lenTime > 0 {
		frame.Fields = append(frame.Fields, data.NewField("time", nil, times))
	}
	frames = append(frames, frame)
	return frames
}

func getXValues(tlsLog map[string]interface{}, xcols []string) []string {
	xVals := make([]string, 0)
	for i := 1; i < len(xcols); i++ {
		if val, ok := tlsLog[xcols[i]]; !ok {
			return nil
		} else {
			s, err := parseString(val)
			if err != nil {
				log.DefaultLogger.Error("Parse string", "error", err)
				return nil
			}
			xVals = append(xVals, s)
		}
	}
	return xVals
}

func getLogDimKey(xcols []string, ycol string) string {
	xcols = append(xcols, ycol)
	return strings.Join(xcols, "*")
}
func (d *Datasource) BuildTable(logs []map[string]interface{}, xcol string, ycols []string) data.Frames {
	frames := data.Frames{}
	frame := data.NewFrame(strings.Join(ycols, ","))
	fieldMap := make(map[string][]string)
	var keyArr []string

	if len(ycols) == 1 && ycols[0] == "" && len(logs) > 0 {
		ycols = ycols[:0]
		keySet := make(map[string]bool, 0)
		for _, log := range logs {
			for k, _ := range log {
				if !keySet[k] {
					ycols = append(ycols, k)
					keySet[k] = true
				}
			}
		}
		sort.Strings(ycols)
	}
	for _, ycol := range ycols {
		fieldMap[ycol] = make([]string, 0)
		keyArr = append(keyArr, ycol)
	}
	var err error
	for _, alog := range logs {
		for _, field := range ycols {
			res := ""
			if v, ok := alog[field]; ok {
				if res, err = parseString(v); err != nil {
					log.DefaultLogger.Info("BuildTable skip key", "key", field)
					continue
				}
			}
			fieldMap[field] = append(fieldMap[field], res)
		}

	}
	for _, v := range keyArr {
		frame.Fields = append(frame.Fields, data.NewField(v, nil, fieldMap[v]))
	}
	frames = append(frames, frame)
	return frames
}

func SearchLogs(cli sdk.Client, topic, query string, start, end int64, limit int) (*sdk.SearchLogsResponse, error) {
	resp, err := cli.SearchLogsV2(&sdk.SearchLogsRequest{
		TopicID:   topic,
		Query:     query,
		StartTime: start,
		EndTime:   end,
		Limit:     limit,
	})
	log.DefaultLogger.Info("Search sdk resp ", "resp", resp, "err", err)
	return resp, err
}

func ListProjects(cli sdk.Client) (*sdk.DescribeProjectsResponse, error) {
	resp, err := cli.DescribeProjects(&sdk.DescribeProjectsRequest{})
	log.DefaultLogger.Info("list sdk resp ", "resp", resp, "err", err)
	return resp, err
}
func LoadCli(ctx *backend.PluginContext, regionStr *string) (*LogSource, sdk.Client, error) {
	config, err := LoadSettings(ctx)
	region := config.Region
	if regionStr != nil && len(*regionStr) > 0 {
		region = *regionStr
	} else if config.AccountMode {
		region = "cn-beijing"
	}
	endpoint := GetEndpointByRegion(region)
	if err != nil {
		log.DefaultLogger.Error("load config settings ", "err", err)
		return nil, nil, err
	}
	cli := sdk.NewClient(endpoint, config.AccessKeyId, config.AccessKeySecret, "", region)
	log.DefaultLogger.Info("tls sdk init ", "endpoint", endpoint, "region", region, "ak", config.AccessKeyId, "sk", config.AccessKeySecret)
	ua := "TLSGrafanaPluginVersion/" + ctx.PluginVersion
	if ctx.UserAgent != nil {
		ua += " " + ctx.UserAgent.String()
	}
	cli.SetCustomUserAgent(ua)
	return config, cli, nil
}

func parseString(value interface{}) (string, error) {
	if value == nil {
		return "", nil
	}
	if vStr, ok := value.(string); ok {
		return vStr, nil
	} else if num, ok := value.(json.Number); ok {
		return num.String(), nil
	}
	log.DefaultLogger.Info("Parse string skip unknown type", "value", value)
	return "", errors.New("unknown type")
}

func parseNumberFloat(value interface{}) (float64, error) {
	if value == nil {
		return 0, nil
	}
	if vFloat, ok := value.(float64); ok {
		return vFloat, nil
	} else if num, ok := value.(json.Number); ok {
		return num.Float64()
	} else if str, ok := value.(string); ok {
		return strconv.ParseFloat(str, 64)
	} else if num, ok := value.(int); ok {
		return float64(num), nil
	} else if num, ok := value.(int64); ok {
		return float64(num), nil
	}
	log.DefaultLogger.Error("Parse number skip unknown type", "value", value)
	return 0, errors.New("unknown type")
}
