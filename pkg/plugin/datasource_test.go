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
			"a":    "60",
			"b":    "27",
			"c":    "33",
			"time": "1733826000000",
		}, {
			"a":    "68",
			"b":    "32",
			"c":    "36",
			"time": "1733826300000",
		},
	}
	d := ds.BuildTimeSeries(logs, "time", []string{"a", "b", "c"})
	t.Log(d)
}

func TestParseListTopicsResourceRequest(t *testing.T) {
	req, err := parseListTopicsResourceRequest("/topics?region=cn-beijing&project_name=proj-a&topic_name=topic-a")
	if err != nil {
		t.Fatal(err)
	}
	if req.Region != "cn-beijing" {
		t.Fatalf("unexpected region: %s", req.Region)
	}
	if req.ProjectName != "proj-a" {
		t.Fatalf("unexpected project name: %s", req.ProjectName)
	}
	if req.TopicName != "topic-a" {
		t.Fatalf("unexpected topic name: %s", req.TopicName)
	}
}

func TestParseListTopicsResourceRequestRequiresRegion(t *testing.T) {
	_, err := parseListTopicsResourceRequest("/topics?project_name=proj-a")
	if err == nil {
		t.Fatal("expected region required error")
	}
}
