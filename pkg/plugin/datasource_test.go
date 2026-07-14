package plugin

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
