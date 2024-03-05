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
	config, cli, err := LoadCli(req.PluginContext)
	if err != nil {
		return nil, err
	}
	response := backend.NewQueryDataResponse()
	queries := req.Queries
	ch := make(chan Result, len(queries))

	defer func() {
		close(ch)
		cli = nil
		config = nil
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
		go d.QueryLogs(ch, query, cli, config)
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
	end := time.Now().UnixMilli()
	start := end - 60000
	config, cli, err := LoadCli(req.PluginContext)
	if err != nil {
		return nil, err
	}
	resp, err := SearchLogs(cli, config.Topic, "*", start, end, 1)
	if err != nil {
		status = backend.HealthStatusError
		message = err.Error()
		log.DefaultLogger.Error("CheckHealth error", "req_id", resp.CommonResponse.RequestID, "err", err)
	}
	log.DefaultLogger.Info("CheckHealth success resp", "resp", *resp)
	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

func (d *Datasource) QueryLogs(ch chan Result, query backend.DataQuery, cli sdk.Client, config *LogSource) {
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
	//1.检索日志
	from := query.TimeRange.From.UnixMilli()
	to := query.TimeRange.To.UnixMilli()
	resp, err := SearchLogs(cli, config.Topic, queryInfo.Query, from, to, 1000)
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
	SortLogs(logs, xcol)
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
	for _, v := range ycols {
		if v != xcol {
			fieldMap[v] = make([]float64, 0)
		}
	}
	var err error
	times := make([]time.Time, 0)
	for _, alog := range logs {
		for k, v := range alog {
			res := float64(0)
			if res, err = parseNumberFloat(v); err != nil {
				log.DefaultLogger.Info("BuildTimeSeries skip key", "key", k)
				continue
			}
			if xcol != "" && k == xcol {
				times = append(times, time.UnixMilli(int64(res)))
			} else if _, ok := fieldMap[k]; ok {
				fieldMap[k] = append(fieldMap[k], res)
			}
		}
	}
	for k, v := range fieldMap {
		frame.Fields = append(frame.Fields, data.NewField(k, nil, v))
	}
	if len(times) > 0 {
		frame.Fields = append(frame.Fields, data.NewField("time", nil, times))
	}
	frames = append(frames, frame)
	return frames
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

func LoadCli(ctx backend.PluginContext) (*LogSource, sdk.Client, error) {
	config, err := LoadSettings(ctx)

	if err != nil {
		log.DefaultLogger.Error("load config settings ", "err", err)
		return nil, nil, err
	}
	cli := sdk.NewClient(config.Endpoint, config.AccessKeyId, config.AccessKeySecret, "", config.Region)
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
	}
	log.DefaultLogger.Error("Parse number skip unknown type", "value", value)
	return 0, errors.New("unknown type")
}
