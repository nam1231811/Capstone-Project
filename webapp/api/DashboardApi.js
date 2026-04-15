sap.ui.define([], function () {
    "use strict";

    var sBaseUrl = "/sap/opu/odata4/sap/zsb_audit_log_gsp14/srvd/sap/zsd_audit_log_gsp14/0001";

    return {
        getDashboardData: function () {
            return fetch(sBaseUrl + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            })
            .then(function(oResponse) {
                if (!oResponse.ok) {
                    console.error("Error fetching CSRF token, status:", oResponse.status);
                    throw new Error("Cannot fetch CSRF Token");
                }
                var sToken = oResponse.headers.get("X-CSRF-Token");
                var pKpi = fetch(sBaseUrl + "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getKpi", {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(function(res) { 
                    if (!res.ok) {
                        console.error("Error calling kpi API, status:", res.status);
                        throw new Error("Error loading KPI/Logs data");
                    }
                    return res.json(); 
                });

                var pChart = fetch(sBaseUrl + "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getChartData", {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(function(res) { 
                    if (!res.ok) {
                        console.error("Error calling chart data API, status:", res.status);
                        throw new Error("Error loading line chart data");
                    }
                    return res.json(); 
                });

                return Promise.all([pKpi, pChart]);
            })
            .then(function(aResults) {
                var oKpiResult = aResults[0];
                var oChartResult = aResults[1];
                var aTopUsers = [];
                if (oKpiResult.top_users) {
                    try { 
                        var aParsedUsers = JSON.parse(oKpiResult.top_users);
                        aTopUsers = aParsedUsers.map(function(i) {
                            return { user: i.USER, actions: i.ACTIONS };
                        }); 
                    } catch(e) {
                        console.error("Error parsing top users json:", e); 
                    }
                } else {
                    console.warn("Error: 'top_users' field not found in response");
                }

                var aRecentLogs = [];
                if (oKpiResult.recent_logs) {
                    try {
                        var aParsedLogs = JSON.parse(oKpiResult.recent_logs);
                        aRecentLogs = aParsedLogs.map(function(item) {
                            var sAction = item.action || "";
                            if (sAction === "C") sAction = "CREATE";
                            else if (sAction === "U") sAction = "UPDATE";
                            else if (sAction === "D") sAction = "DELETE";

                            var sTime = item.changedAt || "";
                            if (sTime && sTime.length >= 14) {
                                sTime = sTime.substring(0,4) + "-" + sTime.substring(4,6) + "-" + sTime.substring(6,8) + " " + sTime.substring(8,10) + ":" + sTime.substring(10,12) + ":" + sTime.substring(12,14);
                            }
                            return {
                                tableName: item.tableName || "",
                                action: sAction,
                                user: item.changedBy || "",
                                time: sTime,
                                status: "Success",
                                rowId: item.recordKey || ""
                            };
                        });
                    } catch(e) {
                        console.error("Error parsing recent logs json:", e);
                    }
                } else {
                    console.warn("Error: 'recent_logs' field not found in response");
                }

                var aLineData = [];
                if (oChartResult.json_string) {
                    try {
                        var aParsedChart = JSON.parse(oChartResult.json_string);
                        aLineData = aParsedChart.map(function(i) {
                            return { date: i.date, create: i.create || 0, update: i.update || 0, delete: i.delete || 0 };
                        });
                    } catch(e) {
                        console.error("Error parsing chart data json string:", e); 
                    }
                } else {
                    console.warn("Error: 'json_string' field not found in response.");
                }

                return {
                    totalTables: oKpiResult.total_tables,
                    changedToday: oKpiResult.today_changes,
                    totalRecords: oKpiResult.total_data,
                    topUsers: aTopUsers,
                    recentLogs: aRecentLogs,
                    lineData: aLineData
                };
            });
        }
    };
});