package plugin

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestQueryData(t *testing.T) {
	ds := Datasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{RefID: "A"},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}
}

func TestMultiDimen(t *testing.T) {
	ds := Datasource{}
	logs := []map[string]interface{}{
		{
			"time":   1722944208000,
			"region": "sh",
			"sum":    1,
			"cnt":    2,
		},
		{
			"time":   1722944208000,
			"region": "gz",
			"sum":    3,
			"cnt":    4,
		},
		{
			"time":   1722944209000,
			"region": "sh",
			"sum":    5,
			"cnt":    6,
		},
	}
	ds.BuildTimeSeries(logs, "time,region", []string{"cnt", "sum"})
}
