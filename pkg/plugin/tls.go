package plugin

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type LogSource struct {
	Endpoint    string
	Topic       string
	Region      string
	AccessKeyId string
	AccountMode bool
	// AccessKeySecret is kept in jsonData only for compatibility with old datasource configs.
	// New configs store it in secureJsonData and LoadSettings overwrites this field with
	// DecryptedSecureJSONData["accessKeySecret"].
	AccessKeySecret string
}

type Result struct {
	refId        string
	dataResponse backend.DataResponse
}

type QueryInfo struct {
	Query          string        `json:"tls_query"`
	Xcol           string        `json:"xcol"`
	Ycol           string        `json:"ycol"`
	Region         string        `json:"region"`
	Regions        []string      `json:"regions"`
	TopicId        string        `json:"topic_id"`
	TopicIds       []string      `json:"topic_ids"`
	RegionTopics   []RegionTopic `json:"region_topics"`
	GrafanaVersion string        `json:"grafana_version"`
}

type RegionTopic struct {
	Region     string `json:"region"`
	TopicId    string `json:"topic_id"`
	TopicLabel string `json:"topic_label"`
}

func LoadSettings(ctx *backend.PluginContext) (*LogSource, error) {
	model := &LogSource{}

	settings := ctx.DataSourceInstanceSettings
	err := json.Unmarshal(settings.JSONData, &model)
	if err != nil {
		return nil, fmt.Errorf("error unmarshal settings: %s", err.Error())
	}
	if val, ok := settings.DecryptedSecureJSONData["accessKeySecret"]; ok {
		model.AccessKeySecret = val
	}
	log.DefaultLogger.Info("load config settings", "accountMode", model.AccountMode, "region", model.Region, "endpoint", model.Endpoint, "accessKeyId", model.AccessKeyId)
	return model, nil
}

func (ls *LogSource) GetRegion() string {
	if len(ls.Region) == 0 {
		return "cn-beijing"
	}
	return ls.Region
}
func (ls *LogSource) GetEndPoint() string {
	if len(ls.Endpoint) == 0 {
		return GetEndpointByRegion(ls.GetRegion())
	}
	return ls.Endpoint
}

func GetEndpointByRegion(region string) string {
	return fmt.Sprintf("https://tls-%s.volces.com", region)
}
