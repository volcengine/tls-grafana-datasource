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
			"Time":    "1729169460000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169460000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169460000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169460000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169460000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169460000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169460000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169460000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169520000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169520000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169520000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169520000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169520000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169520000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169520000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169520000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169580000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169580000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169580000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169580000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169580000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169580000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169580000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169580000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169640000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169640000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169640000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169640000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169640000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169640000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169640000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169640000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169700000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169700000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169700000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169700000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169700000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169700000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169700000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169700000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169760000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169760000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169760000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169760000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169760000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169760000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169760000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169760000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169820000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169820000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169820000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169820000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169820000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169820000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169820000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169820000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169880000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169880000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169880000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169880000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169880000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729169880000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169880000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169880000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169940000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
		{
			"Time":    "1729169940000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729169940000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729169940000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729169940000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729169940000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729169940000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729169940000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729170000000",
			"percent": "98.5",
			"ttt":     "[10001,role]",
		},
		{
			"Time":    "1729170000000",
			"percent": "100.0",
			"ttt":     "[10001,offline]",
		},
		{
			"Time":    "1729170000000",
			"percent": "99.9",
			"ttt":     "[10002,misc]",
		},
		{
			"Time":    "1729170000000",
			"percent": "99.9",
			"ttt":     "[10001,misc]",
		},
		{
			"Time":    "1729170000000",
			"percent": "99.2",
			"ttt":     "[10002,mail]",
		},
		{
			"Time":    "1729170000000",
			"percent": "99.1",
			"ttt":     "[10001,mail]",
		},
		{
			"Time":    "1729170000000",
			"percent": "98.5",
			"ttt":     "[10002,role]",
		},
		{
			"Time":    "1729170000000",
			"percent": "100.0",
			"ttt":     "[10002,offline]",
		},
	}
	d := ds.BuildTimeSeries(logs, "Time,ttt", []string{"percent"})
	t.Log(d)
}
