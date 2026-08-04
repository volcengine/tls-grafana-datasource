package plugin

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	sdk "github.com/volcengine/volc-sdk-golang/service/tls"
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

func TestBuildLogKV(t *testing.T) {
	ds := Datasource{}
	frames := ds.BuildLogKV([]map[string]interface{}{
		{
			"__time__":             "1785834232375",
			"__package_offset__":   "9612750297538600",
			"__source__":           "tls_resource_op_collector",
			"__tag____client_ip__": "33.136.123.108",
			"b":                    "second",
			"a":                    json.Number("1"),
			"real__field":          "keep",
			"nested":               map[string]string{"x": "y"},
			"enabled":              true,
		},
	})

	if len(frames) != 1 {
		t.Fatalf("expected one frame, got %d", len(frames))
	}
	frame := frames[0]
	if frame.Meta == nil || frame.Meta.Type != data.FrameTypeLogLines || frame.Meta.PreferredVisualization != data.VisTypeLogs {
		t.Fatalf("unexpected frame meta: %#v", frame.Meta)
	}
	if len(frame.Fields) != 2 {
		t.Fatalf("expected timestamp and body fields, got %d", len(frame.Fields))
	}
	if frame.Fields[0].Name != "timestamp" || frame.Fields[1].Name != "body" {
		t.Fatalf("unexpected fields: %s, %s", frame.Fields[0].Name, frame.Fields[1].Name)
	}
	if got := frame.Fields[0].At(0); got != time.UnixMilli(1785834232375) {
		t.Fatalf("unexpected time: %#v", got)
	}

	body, ok := frame.Fields[1].At(0).(string)
	if !ok {
		t.Fatalf("expected body string, got %#v", frame.Fields[1].At(0))
	}
	for _, want := range []string{
		"__time__: 2026-08-04 17:03:52.375",
		"a: 1",
		"b: second",
		"enabled: true",
		"nested: {\"x\":\"y\"}",
		"real__field: keep",
		"__source__: tls_resource_op_collector",
		"__tag____client_ip__: 33.136.123.108",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("expected body to contain %q, got %q", want, body)
		}
	}
	if !strings.HasPrefix(body, "__time__: 2026-08-04 17:03:52.375\n") {
		t.Fatalf("body should start with human readable __time__, got %q", body)
	}
	if strings.Contains(body, "__package_offset__") {
		t.Fatalf("body should not include __package_offset__: %q", body)
	}
	if strings.Index(body, "__source__:") < strings.Index(body, "a:") {
		t.Fatalf("system fields should be listed after regular fields: %q", body)
	}
}

func TestBuildFrameWhenLogKVEmpty(t *testing.T) {
	frame := buildFrameWhenLogsEmpty(&sdk.SearchLogsResponse{}, logXcol)
	if frame.Meta == nil || frame.Meta.Type != data.FrameTypeLogLines || frame.Meta.PreferredVisualization != data.VisTypeLogs {
		t.Fatalf("unexpected frame meta: %#v", frame.Meta)
	}
	if len(frame.Fields) != 2 || frame.Fields[0].Name != "timestamp" || frame.Fields[1].Name != "body" {
		t.Fatalf("unexpected fields: %#v", frame.Fields)
	}
	if frame.Fields[0].Len() != 0 || frame.Fields[1].Len() != 0 {
		t.Fatalf("expected empty log fields")
	}
}

func TestParseListTopicsResourceRequest(t *testing.T) {
	req, err := parseListTopicsResourceRequest("/topics?region=cn-beijing&project_name=proj-a&topic_name=topic-a&exact_match=true")
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
	if !req.ExactMatch {
		t.Fatal("expected exact match")
	}
}

func TestParseListTopicsResourceRequestRequiresRegion(t *testing.T) {
	_, err := parseListTopicsResourceRequest("/topics?project_name=proj-a")
	if err == nil {
		t.Fatal("expected region required error")
	}
}

func TestFilterTopicsExactMatch(t *testing.T) {
	resp := &sdk.DescribeTopicsResponse{
		Topics: []*sdk.Topic{
			{TopicName: "topic-a", TopicID: "topic-1"},
			{TopicName: "topic-a-copy", TopicID: "topic-2"},
			{TopicName: "topic-a", TopicID: "topic-3"},
		},
		Total: 3,
	}

	filterTopicsExactMatch(resp, "topic-a")

	if resp.Total != 2 || len(resp.Topics) != 2 {
		t.Fatalf("expected 2 exact topics, got total=%d len=%d", resp.Total, len(resp.Topics))
	}
	for _, topic := range resp.Topics {
		if topic.TopicName != "topic-a" {
			t.Fatalf("unexpected topic name: %s", topic.TopicName)
		}
	}
}

func TestListTopicsExactMatchRequiresTopic(t *testing.T) {
	resp, err := ListTopics(nil, "", "", "", true)
	if err != nil {
		t.Fatal(err)
	}
	if resp == nil || len(resp.Topics) != 0 {
		t.Fatalf("expected empty response when exact topic is missing, got %#v", resp)
	}
	body, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	topics, ok := decoded["Topics"].([]interface{})
	if !ok || len(topics) != 0 {
		t.Fatalf("expected topics to be encoded as empty array, got %s", string(body))
	}
}
