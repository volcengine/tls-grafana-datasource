package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	sdk "github.com/volcengine/volc-sdk-golang/service/tls"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ backend.CallResourceHandler   = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

const TlsGrafanaPluginVersion = "2.5.0"

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

func (d *Datasource) CallResource(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	switch strings.Trim(req.Path, "/") {
	case "topics":
		return d.listTopicsResource(req, sender)
	default:
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusNotFound,
			Body:   []byte("resource not found"),
		})
	}
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
	config, cli, err := LoadCli(ctx, nil, nil)
	if err != nil {
		return backend.HealthStatusError, err
	}
	if config.AccountMode {
		if (config.Region == "") != (config.Endpoint == "") {
			return backend.HealthStatusError, errors.New("region and endpoint must both be provided or both be empty")
		}

		resp, err := ListProjects(cli)
		if err != nil {
			log.DefaultLogger.Error("CheckHealth error", "req_id", resp.CommonResponse.RequestID, "err", err)
			return backend.HealthStatusError, err
		}
		log.DefaultLogger.Info("CheckHealth list projects suc", "req_id", resp.CommonResponse.RequestID)
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
	config, err := LoadSettings(ctx)
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
	if err = validateRegionTopicSelection(config, queryInfo); err != nil {
		log.DefaultLogger.Error("Validate region topic selection", "refId", refId, "regions", queryInfo.Regions, "region_topics", queryInfo.RegionTopics, "error", err)
		response.Error = err
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}
	targets := resolveSearchTargets(config, queryInfo)
	requestRegion := resolveRequestRegion(config, queryInfo, targets)
	_, cli, err := LoadCli(ctx, &requestRegion, &queryInfo.GrafanaVersion)
	if err != nil {
		log.DefaultLogger.Error("LoadCli", "refId", refId, "region", requestRegion, "error", err)
		response.Error = err
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}
	resp, err := SearchLogsByRegionTopics(cli, targets, queryInfo.Query, from, to, 1000)
	if err != nil {
		log.DefaultLogger.Error("SearchLogs", "query", queryInfo.Query, "targets", formatRegionTopics(targets), "error", err)
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

	xcol := strings.TrimSpace(queryInfo.Xcol)
	ycols := strings.Split(strings.TrimSpace(queryInfo.Ycol), ",")
	//2.构造结果
	if len(logs) == 0 {
		log.DefaultLogger.Warn("SearchLogs resp nil")
		frame := buildFrameWhenLogsEmpty(resp, xcol)

		frames := data.Frames{}
		frames = append(frames, frame)
		response.Frames = frames
		ch <- Result{
			refId:        refId,
			dataResponse: response,
		}
		return
	}

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
	dimKeys := make(map[string]bool, 0) // 线条名
	multiDimen := xLens > 1
	// 获取线条名加入dimKeys
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
	// 按时间排序
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
	fieldMap := make(map[string]map[time.Time]float64)
	if multiDimen {
		for k, _ := range dimKeys {
			if k != timeCol {
				fieldMap[k] = map[time.Time]float64{}
			}
		}
	} else {
		for _, v := range ycols {
			if v != timeCol {
				fieldMap[v] = map[time.Time]float64{}
			}
		}
	}

	var err error
	times := make([]time.Time, 0)
	timeDict := make(map[int64]bool, 0)
	for _, tlsLog := range logs {
		t := float64(0)
		if t, err = parseNumberFloat(tlsLog[xcols[0]]); err != nil {
			log.DefaultLogger.Info("BuildTimeSeries skip key", "key", tlsLog[xcols[0]])
			continue
		}
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
						fieldMap[key][time.UnixMilli(int64(t))] = res
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
			msec := int64(res)
			if xcol != "" && k == timeCol {
				if multiDimen && timeDict[msec] {
					continue
				}
				times = append(times, time.UnixMilli(msec))
				timeDict[msec] = true
			} else if !multiDimen {
				if _, ok := fieldMap[k]; ok {
					fieldMap[k][time.UnixMilli(int64(t))] = res
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
		timeValueMap := fieldMap[f]
		var values []float64
		for _, t := range times {
			if v, ok := timeValueMap[t]; ok {
				values = append(values, v)
			} else {
				values = append(values, float64(0))
			}
		}
		frame.Fields = append(frame.Fields, data.NewField(f, nil, values))
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
	req := &sdk.SearchLogsRequest{
		TopicID:   topic,
		Query:     query,
		StartTime: start,
		EndTime:   end,
		Limit:     limit,
	}
	resp, err := cli.SearchLogsV2(req)
	return resp, err
}

func SearchLogsByRegionTopics(cli sdk.Client, targets []RegionTopic, query string, start, end int64, limit int) (*sdk.SearchLogsResponse, error) {
	return searchLogsByRegionTopicsWithClient(cli, targets, query, start, end, limit)
}

func validateRegionTopicSelection(config *LogSource, queryInfo *QueryInfo) error {
	if config == nil || queryInfo == nil || !config.AccountMode {
		return nil
	}
	regions := normalizeRegions(queryInfo.Regions)
	if len(regions) <= 1 {
		return nil
	}
	regionTopics := normalizeRegionTopics(queryInfo.RegionTopics)
	selected := make(map[string]bool, len(regionTopics))
	for _, item := range regionTopics {
		selected[item.Region] = true
	}
	missing := make([]string, 0)
	for _, region := range regions {
		if !selected[region] {
			missing = append(missing, region)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	return errors.New("please select at least one topic for each selected region: " + strings.Join(missing, ","))
}

func resolveSearchTargets(config *LogSource, queryInfo *QueryInfo) []RegionTopic {
	if !config.AccountMode {
		return normalizeRegionTopics([]RegionTopic{{Region: config.GetRegion(), TopicId: config.Topic}})
	}
	if len(queryInfo.RegionTopics) > 0 {
		return normalizeRegionTopics(queryInfo.RegionTopics)
	}

	region := strings.TrimSpace(queryInfo.Region)
	if region == "" {
		region = config.GetRegion()
	}
	targets := make([]RegionTopic, 0)
	for _, topic := range resolveTopicIds(config, queryInfo) {
		targets = append(targets, RegionTopic{Region: region, TopicId: topic})
	}
	return normalizeRegionTopics(targets)
}

func resolveTopicIds(config *LogSource, queryInfo *QueryInfo) []string {
	if !config.AccountMode {
		return normalizeTopicIds([]string{config.Topic})
	}
	topics := normalizeTopicIds(queryInfo.TopicIds)
	if len(topics) > 0 {
		return topics
	}
	return normalizeTopicIds([]string{queryInfo.TopicId})
}

func normalizeTopicIds(topics []string) []string {
	normalized := make([]string, 0, len(topics))
	seen := make(map[string]bool, len(topics))
	for _, topic := range topics {
		for _, part := range strings.Split(topic, ",") {
			part = strings.TrimSpace(part)
			if part == "" || seen[part] {
				continue
			}
			normalized = append(normalized, part)
			seen[part] = true
		}
	}
	return normalized
}

func normalizeRegions(regions []string) []string {
	normalized := make([]string, 0, len(regions))
	seen := make(map[string]bool, len(regions))
	for _, region := range regions {
		region = strings.TrimSpace(region)
		if region == "" || seen[region] {
			continue
		}
		normalized = append(normalized, region)
		seen[region] = true
	}
	return normalized
}

func normalizeRegionTopics(targets []RegionTopic) []RegionTopic {
	normalized := make([]RegionTopic, 0, len(targets))
	seen := make(map[string]bool, len(targets))
	for _, target := range targets {
		region := strings.TrimSpace(target.Region)
		for _, topic := range normalizeTopicIds([]string{target.TopicId}) {
			if region == "" || topic == "" {
				continue
			}
			key := region + "\x1f" + topic
			if seen[key] {
				continue
			}
			normalized = append(normalized, RegionTopic{
				Region:     region,
				TopicId:    topic,
				TopicLabel: target.TopicLabel,
			})
			seen[key] = true
		}
	}
	return normalized
}

func formatRegionTopics(targets []RegionTopic) string {
	formatted := make([]string, 0, len(targets))
	for _, target := range targets {
		formatted = append(formatted, target.Region+"/"+target.TopicId)
	}
	return strings.Join(formatted, ",")
}

type searchRegionTopic struct {
	Region string `json:"Region"`
	Topic  string `json:"Topic"`
}

type multiRegionSearchRequest struct {
	TopicID      string              `json:"TopicId"`
	StartTime    int64               `json:"StartTime"`
	EndTime      int64               `json:"EndTime"`
	Query        string              `json:"Query"`
	MustComplete bool                `json:"MustComplete"`
	Limit        int                 `json:"Limit,omitempty"`
	RegionTopics []searchRegionTopic `json:"RegionTopics"`
}

func searchLogsByRegionTopicsWithClient(cli sdk.Client, targets []RegionTopic, query string, start, end int64, limit int) (*sdk.SearchLogsResponse, error) {
	targets = normalizeRegionTopics(targets)
	if len(targets) == 0 {
		return nil, errors.New("empty region topic targets")
	}
	if len(targets) == 1 {
		return SearchLogs(cli, targets[0].TopicId, query, start, end, limit)
	}

	lsClient, ok := cli.(*sdk.LsClient)
	if !ok {
		return nil, errors.New("tls client does not support raw request")
	}
	reqBody := multiRegionSearchRequest{
		TopicID:      targets[0].TopicId,
		StartTime:    start,
		EndTime:      end,
		Query:        query,
		MustComplete: false,
		Limit:        limit,
		RegionTopics: make([]searchRegionTopic, 0, len(targets)),
	}
	for _, target := range targets {
		reqBody.RegionTopics = append(reqBody.RegionTopics, searchRegionTopic{
			Region: target.Region,
			Topic:  target.TopicId,
		})
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}
	headers := map[string]string{
		"Content-Type":             "application/json",
		sdk.HeaderAPIVersion:       sdk.APIVersion3,
		"X-Tls-IsMultiTopicSearch": "true",
	}

	rawResponse, err := lsClient.Request(http.MethodPost, "/SearchLogs", nil, headers, body)
	if err != nil {
		log.DefaultLogger.Error("Search multi region topic raw resp", "headers", headers, "req", string(body), "err", err)
		return nil, err
	}
	defer rawResponse.Body.Close()
	respBody, err := io.ReadAll(rawResponse.Body)
	if err != nil {
		return nil, err
	}

	response := &sdk.SearchLogsResponse{}
	response.FillRequestId(rawResponse)
	if err = unmarshalSearchLogsResponse(respBody, response); err != nil {
		return nil, err
	}

	return response, nil
}

func unmarshalSearchLogsResponse(respBody []byte, response *sdk.SearchLogsResponse) error {
	decoder := json.NewDecoder(strings.NewReader(string(respBody)))
	decoder.UseNumber()
	return decoder.Decode(response)
}

func resolveRequestRegion(config *LogSource, queryInfo *QueryInfo, targets []RegionTopic) string {
	if region := strings.TrimSpace(queryInfo.Region); region != "" {
		return region
	}
	if region := resolveRequestRegionFromTargets(targets); region != "" {
		return region
	}
	return config.GetRegion()
}

func resolveRequestRegionFromTargets(targets []RegionTopic) string {
	if len(targets) == 0 {
		return ""
	}
	return strings.TrimSpace(targets[0].Region)
}

func ListProjects(cli sdk.Client) (*sdk.DescribeProjectsResponse, error) {
	resp, err := cli.DescribeProjects(&sdk.DescribeProjectsRequest{})
	log.DefaultLogger.Info("list sdk resp ", "resp", resp, "err", err)
	return resp, err
}

type listTopicsResourceRequest struct {
	Region      string
	TopicID     string
	TopicName   string
	ProjectName string
}

func (d *Datasource) listTopicsResource(req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	params, err := parseListTopicsResourceRequest(req.URL)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusBadRequest,
			Body:   []byte(err.Error()),
		})
	}
	config, cli, err := LoadCli(&req.PluginContext, &params.Region, nil)
	if err != nil {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(err.Error()),
		})
	}
	if strings.TrimSpace(config.AccessKeySecret) == "" {
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusBadRequest,
			Body:   []byte("accessKeySecret is not configured"),
		})
	}
	resp, err := ListTopics(cli, params.TopicID, params.TopicName, params.ProjectName)
	if err != nil {
		log.DefaultLogger.Error("ListTopics resource error", "region", params.Region, "project_name", params.ProjectName, "topic_id", params.TopicID, "topic_name", params.TopicName, "error", err)
		return sender.Send(&backend.CallResourceResponse{
			Status: http.StatusInternalServerError,
			Body:   []byte(err.Error()),
		})
	}
	body, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	return sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: map[string][]string{"content-type": {"application/json"}},
		Body:    body,
	})
}

func parseListTopicsResourceRequest(rawURL string) (listTopicsResourceRequest, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return listTopicsResourceRequest{}, err
	}
	query := parsed.Query()
	req := listTopicsResourceRequest{
		Region:      strings.TrimSpace(query.Get("region")),
		TopicID:     strings.TrimSpace(query.Get("topic_id")),
		TopicName:   strings.TrimSpace(query.Get("topic_name")),
		ProjectName: strings.TrimSpace(query.Get("project_name")),
	}
	if req.Region == "" {
		return req, errors.New("region is required")
	}
	return req, nil
}

func ListTopics(cli sdk.Client, topicID, topicName, projectName string) (*sdk.DescribeTopicsResponse, error) {
	projectID := ""
	if projectName != "" {
		projectResp, err := cli.DescribeProjects(&sdk.DescribeProjectsRequest{
			ProjectName: projectName,
			PageSize:    100,
			PageNumber:  1,
			IsFullName:  true,
		})
		if err != nil {
			return nil, err
		}
		for _, project := range projectResp.Projects {
			if project.ProjectName == projectName {
				projectID = project.ProjectID
				break
			}
		}
		if projectID == "" && len(projectResp.Projects) > 0 {
			projectID = projectResp.Projects[0].ProjectID
		}
		if projectID == "" {
			return nil, errors.New("project not found: " + projectName)
		}
	}
	resp, err := cli.DescribeTopics(&sdk.DescribeTopicsRequest{
		PageSize:   100,
		PageNumber: 1,
		TopicID:    topicID,
		TopicName:  topicName,
		ProjectID:  projectID,
	})
	//log.DefaultLogger.Info("list topics sdk resp", "topic_id", topicID, "topic_name", topicName, "resp", resp, "err", err)
	return resp, err
}

func LoadCli(ctx *backend.PluginContext, regionStr *string, grafanaVersion *string) (*LogSource, sdk.Client, error) {
	config, err := LoadSettings(ctx)
	if err != nil {
		log.DefaultLogger.Error("load config settings ", "err", err)
		return nil, nil, err
	}

	region := config.Region
	endpoint := config.Endpoint
	// account模式也需要填写region和endpoint（可以显示设定某个region使用内网地址）
	if config.AccountMode {
		if regionStr != nil && len(*regionStr) > 0 {
			// 如果查询region不是当前配置的region, 那么走默认的拼接域名，如果查询region 和当前region相同，走配置的域名
			if *regionStr != config.Region {
				region = *regionStr
				endpoint = GetEndpointByRegion(region)
			}
		}

		// check health
		if regionStr == nil && region == "" {
			region = "cn-beijing"
			endpoint = GetEndpointByRegion(region)
		}
	}

	cli := sdk.NewClient(endpoint, config.AccessKeyId, config.AccessKeySecret, "", region)
	log.DefaultLogger.Info("tls sdk init ", "endpoint", endpoint, "region", region, "ak", config.AccessKeyId)
	ua := "TLSGrafanaPluginVersion/"
	if ctx.PluginVersion != "" {
		ua += ctx.PluginVersion
	} else {
		ua += TlsGrafanaPluginVersion
	}
	if grafanaVersion != nil {
		ua += " Grafana/" + *grafanaVersion
	} else if ctx.UserAgent != nil {
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

func buildFrameWhenLogsEmpty(resp *sdk.SearchLogsResponse, xcol string) *data.Frame {
	frame := data.NewFrame("response")
	xcols := strings.Split(xcol, ",")
	var x string
	if len(xcols) > 0 {
		x = xcols[0]
	}

	if resp.Analysis {
		indexMap := make(map[string]interface{})
		for key, val := range resp.AnalysisResult.Type {
			switch val {
			case "text":
				indexMap[key] = []string{}
			case "long":
				indexMap[key] = []int64{}
			case "double":
				indexMap[key] = []float64{}
			default:
				indexMap[key] = []string{}
			}
		}

		for _, schema := range resp.AnalysisResult.Schema {
			v, ok := indexMap[schema]
			if !ok {
				continue
			}

			if x != "" && x == schema {
				v = []time.Time{}
			}

			frame.Fields = append(frame.Fields, data.NewField(schema, nil, v))
		}
	}

	return frame
}
