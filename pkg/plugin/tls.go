package plugin

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type LogSource struct {
	Endpoint        string
	Topic           string
	Region          string
	AccessKeyId     string
	AccessKeySecret string
}

func LoadSettings(ctx backend.PluginContext) (*LogSource, error) {
	model := &LogSource{}

	settings := ctx.DataSourceInstanceSettings
	err := json.Unmarshal(settings.JSONData, &model)
	if err != nil {
		return nil, fmt.Errorf("error unmarshal settings: %s", err.Error())
	}
	model.AccessKeySecret = settings.DecryptedSecureJSONData["accessKeySecret"]

	return model, nil
}
