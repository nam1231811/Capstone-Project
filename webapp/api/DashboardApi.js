sap.ui.define([], function () {
    "use strict";

    const BASE_URL = "/sap/opu/odata4/sap/zsb_audit_log_gsp14/srvd/sap/zsd_audit_log_gsp14/0001";
    const ACTION_GET_KPI = "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getKpi";
    const ACTION_GET_CHART = "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getChartData";

    return {
        getDashboardData: function () {
            return fetch(BASE_URL + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            })
            .then(function(oResponse) {
                var sToken, pKpi, pChart;

                if (!oResponse.ok) {
                    console.error("Error fetching CSRF token, status:", oResponse.status);
                    throw new Error("Cannot fetch CSRF Token");
                }
                
                sToken = oResponse.headers.get("X-CSRF-Token");

                pKpi = fetch(BASE_URL + ACTION_GET_KPI, {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(res => res.json());

                pChart = fetch(BASE_URL + ACTION_GET_CHART, {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(res => res.json());

                return Promise.all([pKpi, pChart]);
            })
            .then(function(aResults) {
                var oKpiResult = aResults[0],
                    aTopUsers = [],
                    aParsedUsers;

                if (oKpiResult.top_users) {
                    try { 
                        aParsedUsers = JSON.parse(oKpiResult.top_users);
                        aTopUsers = aParsedUsers.map(i => ({ user: i.USER, actions: i.ACTIONS })); 
                    } catch(e) {
                        console.error("Error parsing top users json:", e); 
                    }
                } else {
                    console.warn("Error: 'top_users' field not found in response");
                }

                return {
                    totalTables: oKpiResult.total_tables,
                    totalRecords: oKpiResult.total_data,
                    changedToday: oKpiResult.today_changes,
                    topUsers: aTopUsers,
                    recentLogs: [], 
                    lineData: []    
                };
            });
        }
    };
});