package plugin

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type LogSource struct {
	Endpoint        string
	Topic           string
	Region          string
	AccessKeyId     string
	AccountMode     bool
	AccessKeySecret string
}

type Result struct {
	refId        string
	dataResponse backend.DataResponse
}

type QueryInfo struct {
	Query          string `json:"tls_query"`
	Xcol           string `json:"xcol"`
	Ycol           string `json:"ycol"`
	Region         string `json:"region"`
	TopicId        string `json:"topic_id"`
	GrafanaVersion string `json:"grafana_version"`
}

func LoadSettings(ctx *backend.PluginContext) (*LogSource, error) {
	model := &LogSource{}

	settings := ctx.DataSourceInstanceSettings
	err := json.Unmarshal(settings.JSONData, &model)
	if err != nil {
		return nil, fmt.Errorf("error unmarshal settings: %s", err.Error())
	}
	if val, ok := settings.DecryptedSecureJSONData["accessKeySecret"]; ok {
		log.DefaultLogger.Info("load config adapt low version", "secret_sk", val)
		model.AccessKeySecret = val
	}
	log.DefaultLogger.Info("load config settings account mode ", "settings", settings, "model", model)
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
