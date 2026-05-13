sap.ui.define([], function () {
    "use strict";

    const BASE_URL = "/sap/opu/odata4/sap/zsb_audit_log_gsp14/srvd/sap/zsd_audit_log_gsp14/0001";
    const ACTION_GET_KPI = "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getKpi";
    const ACTION_GET_CHART = "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getChartData";
    const ACTION_GET_TOP_USERS = "/AuditLog/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getTopUsers";

    return {
        getChartData: function(sToken, sUserId) {
            return fetch(BASE_URL + ACTION_GET_CHART, {
                method: "POST",
                headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" },
                body: JSON.stringify({ "user_id": sUserId || "" })
            }).then(res => res.json());
        },

        getDashboardData: function () {
            var that = this;
            return fetch(BASE_URL + "/", {
                method: "HEAD",
                headers: { "X-CSRF-Token": "Fetch" }
            })
            .then(function(oResponse) {
                var sToken, pKpi, pChart, pTopUsers;

                if (!oResponse.ok) {
                    throw new Error("Cannot fetch CSRF Token");
                }
                
                sToken = oResponse.headers.get("X-CSRF-Token");
                pKpi = fetch(BASE_URL + ACTION_GET_KPI, {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(res => res.json());

                pChart = that.getChartData(sToken, "");
                
                pTopUsers = fetch(BASE_URL + ACTION_GET_TOP_USERS, {
                    method: "POST",
                    headers: { "X-CSRF-Token": sToken, "Content-Type": "application/json" }
                }).then(res => res.json());

                return Promise.all([pKpi, pChart, pTopUsers, sToken]);
            })
            .then(function(aResults) {
                var oKpiResult = aResults[0] || {},
                    oChartResult = aResults[1] || {},
                    oTopUsersResult = aResults[2] || {},
                    sCsrfToken = aResults[3];

                return {
                    kpi: {
                        totalTables: oKpiResult.total_tables || 0,
                        totalRecords: oKpiResult.total_data || 0,
                        changedToday: oKpiResult.today_changes || 0
                    },
                    lineData: oChartResult.CHART_DATA || [],
                    topUsers: oTopUsersResult.USER_LIST || [],
                    csrfToken: sCsrfToken 
                };
            });
        }
    };
});