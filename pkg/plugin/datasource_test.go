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
			"cmdname": "Cmd_Battle_Result_CS",
			"size":    "7.4443359375",
			"t":       "1732000140000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "5.1025390625",
			"t":       "1732001700000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "3.2937155330882355",
			"t":       "1732001760000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.8382161458333335",
			"t":       "1732001640000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.8382161458333335",
			"t":       "1732000560000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.8382161458333335",
			"t":       "1732001580000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.8330078125",
			"t":       "1732001280000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.7296424278846154",
			"t":       "1732000800000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.7202473958333333",
			"t":       "1732000980000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.4567057291666665",
			"t":       "1732001520000",
		}, {
			"cmdname": "Cmd_Role_SetClientInfo_CS",
			"size":    "2.37890625",
			"t":       "1732000500000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "2.2841796875",
			"t":       "1732001100000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.9619140625",
			"t":       "1732000380000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.94189453125",
			"t":       "1732001340000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.7109375",
			"t":       "1732001220000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.7060546875",
			"t":       "1732000440000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.66845703125",
			"t":       "1732001820000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.66845703125",
			"t":       "1732001700000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.6669921875",
			"t":       "1732001460000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.6530412946428572",
			"t":       "1732000200000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.648681640625",
			"t":       "1732000080000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.6419270833333333",
			"t":       "1732000260000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.628662109375",
			"t":       "1732001760000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.623046875",
			"t":       "1732001280000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001280000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732000200000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732000140000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001340000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001700000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001400000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732000260000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001760000",
		}, {
			"cmdname": "Cmd_Friend_DouYinFriendList_CS",
			"size":    "1.609375",
			"t":       "1732001820000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.6084872159090908",
			"t":       "1732001400000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.6021205357142858",
			"t":       "1732000140000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.570068359375",
			"t":       "1732000320000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.5322265625",
			"t":       "1732001160000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.513671875",
			"t":       "1732000980000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.513671875",
			"t":       "1732000020000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.513671875",
			"t":       "1732000800000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.5021158854166667",
			"t":       "1732001580000",
		}, {
			"cmdname": "Cmd_Friend_GetRoleCache_CS",
			"size":    "1.4619140625",
			"t":       "1732001520000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.4255859375",
			"t":       "1732001640000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.38427734375",
			"t":       "1732001520000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.31298828125",
			"t":       "1732000740000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.2926897321428572",
			"t":       "1732000560000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.255859375",
			"t":       "1732001040000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.24853515625",
			"t":       "1732000620000",
		}, {
			"cmdname": "Cmd_Friend_GetRoleCache_CS",
			"size":    "1.13671875",
			"t":       "1732001460000",
		}, {
			"cmdname": "Cmd_Friend_GetRoleCache_CS",
			"size":    "1.13671875",
			"t":       "1732000440000",
		}, {
			"cmdname": "Cmd_Friend_GetRoleCache_CS",
			"size":    "1.1298828125",
			"t":       "1732001700000",
		}, {
			"cmdname": "Cmd_Friend_NormalFriendList_CS",
			"size":    "1.1123046875",
			"t":       "1732000500000",
		}, {
			"cmdname": "Cmd_Friend_GetRoleCache_CS",
			"size":    "1.021484375",
			"t":       "1732001400000",
		},
	}
	d := ds.BuildTimeSeries(logs, "t,cmdname", []string{"size"})
	t.Log(d)
}
