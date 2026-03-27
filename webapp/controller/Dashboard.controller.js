sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",           
    "sap/ui/model/FilterOperator",
    "sap/ui/core/ResizeHandler",
    "zapp/models/GetData"
], function (Controller, JSONModel, Filter, FilterOperator, ResizeHandler, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.Dashboard", {
        onInit: function () {
            this._aResizeHandlers = []; 

            var oData = {
                kpi: { totalTables: 0, changedToday: 0, totalRecords: 0 },
                lineData: [],
                topUsers: [],
                pieData: [
                    { status: "Valid Data in Table", count: 1 },
                    { status: "Missing Data in Table", count: 1 }
                ],
                recentLogs: []
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "dash");

            this._loadDashboardData();
        },

        _loadDashboardData: function() {
            var oDashModel = this.getView().getModel("dash");
            var sServiceUrl = "/sap/opu/odata4/sap/zsb_audit_log_gsp14/srvd/sap/zsd_audit_log_gsp14/0001/";

            var oCardLine = this.byId("cardLineChart");
            var oCardBar  = this.byId("cardBarChart");
            var oCardLogs = this.byId("cardRecentLogs");

            if (oCardLine) oCardLine.setBusy(true);
            if (oCardBar)  oCardBar.setBusy(true);
            if (oCardLogs) oCardLogs.setBusy(true);

            $.ajax({
                url: sServiceUrl,
                method: "GET",
                headers: {
                    "X-CSRF-Token": "Fetch"
                },
                success: function (data, textStatus, jqXHR) {
                    var sToken = jqXHR.getResponseHeader("X-CSRF-Token");
                    console.log("CSRF Token:", sToken);

                    $.ajax({
                        url: sServiceUrl + "Log/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getKpi",
                        method: "POST",
                        headers: {
                            "X-CSRF-Token": sToken,
                            "Content-Type": "application/json"
                        },
                        success: function (oResult) {
                            console.log("getKpi Result:", oResult);

                            var aTopUsers = [];
                            if (oResult.top_users) {
                                try {
                                    var aParsedUsers = JSON.parse(oResult.top_users);
                                    console.log("Parsed Top Users:", aParsedUsers);
                                    aTopUsers = aParsedUsers.map(function(item) {
                                        return { user: item.USER, actions: item.ACTIONS };
                                    });
                                } catch (e) { 
                                    console.error("Error parsing top users json:", e); 
                                }
                            } else {
                                console.warn("Error: 'top_users' field not found in response");
                            }

                            var aRecentLogs = [];
                            if (oResult.recent_logs) {
                                try {
                                    var aParsedLogs = JSON.parse(oResult.recent_logs);
                                    console.log("Parsed Recent Logs:", aParsedLogs);
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
                                } catch (e) { 
                                    console.error("Error parsing recent logs json:", e); 
                                }
                            } else {
                                console.warn("Error: 'recent_logs' field not found in response");
                            }
                            
                            oDashModel.setProperty("/kpi/totalTables", oResult.total_tables);
                            oDashModel.setProperty("/kpi/changedToday", oResult.today_changes);
                            oDashModel.setProperty("/kpi/totalRecords", oResult.total_data);
                            oDashModel.setProperty("/topUsers", aTopUsers);
                            oDashModel.setProperty("/recentLogs", aRecentLogs);

                            if (oCardBar)  oCardBar.setBusy(false);
                            if (oCardLogs) oCardLogs.setBusy(false);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            console.error("Error calling kpi API");
                            console.error("Status:", textStatus);
                            console.error("Error:", errorThrown);
                            console.error("Details from backend:", jqXHR.responseText);

                            if (oCardBar)  oCardBar.setBusy(false);
                            if (oCardLogs) oCardLogs.setBusy(false);
                            sap.m.MessageToast.show("Error loading KPI/Logs data");
                        }
                    });

                    $.ajax({
                        url: sServiceUrl + "Log/com.sap.gateway.srvd.zsd_audit_log_gsp14.v0001.getChartData",
                        method: "POST",
                        headers: {
                            "X-CSRF-Token": sToken,
                            "Content-Type": "application/json"
                        },
                        success: function (oResult) {
                            console.log("getChartData Result:", oResult);

                            var aLineData = [];
                            if (oResult.json_string) {
                                try {
                                    var aParsedChart = JSON.parse(oResult.json_string);
                                    console.log("Parsed Chart Data:", aParsedChart);
                                    aLineData = aParsedChart.map(function(item) {
                                        return {
                                            date: item.date,
                                            create: item.create || 0,
                                            update: item.update || 0,
                                            delete: item.delete || 0
                                        };
                                    });
                                } catch (e) { 
                                    console.error("Error parsing chart data json string:", e); 
                                }
                            } else {
                                console.warn("Error: 'json_string' field not found in response.");
                            }
                            oDashModel.setProperty("/lineData", aLineData);

                            if (oCardLine) oCardLine.setBusy(false);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            console.error("Error calling chart data API");
                            console.error("Status:", textStatus);
                            console.error("Error:", errorThrown);
                            console.error("Details from backend:", jqXHR.responseText);

                            if (oCardLine) oCardLine.setBusy(false);
                            sap.m.MessageToast.show("Error loading line chart data");
                        }
                    });

                }.bind(this),
                error: function (jqXHR, textStatus, errorThrown) {
                    console.error("Error fetching CSRF token");
                    console.error("Status:", textStatus);
                    console.error("Error:", errorThrown);
                    console.error("Details from backend:", jqXHR.responseText);

                    if (oCardLine) oCardLine.setBusy(false);
                    if (oCardBar)  oCardBar.setBusy(false);
                    if (oCardLogs) oCardLogs.setBusy(false);
                    sap.m.MessageToast.show("Cannot connect to backend to fetch token");
                }
            });
        },

        onAfterRendering: function () {
            this._togglePieDataLabel(false);
            var sHandlerId = ResizeHandler.register(this.getView(), this._onResize.bind(this));
            this._aResizeHandlers.push(sHandlerId);
        },

        _onResize: function(oEvent) {
            var aChartIds = ["idLineChart", "idBarChart", "idPieChart"];
            aChartIds.forEach(function(sId) {
                var oChart = this.byId(sId);
                if (oChart) {
                    oChart.invalidate();
                }
            }.bind(this));
        },

        _togglePieDataLabel: function(bShow) {
            var oVizFrame = this.byId("idPieChart");
            if (oVizFrame) {
                oVizFrame.setVizProperties({
                    plotArea: { dataLabel: { visible: bShow, type: 'value' } }
                });
            }
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true); 
        },

        onPressKPI: function() {
            sap.m.MessageToast.show("Press KPI card - future enhancement");
        },

        onValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            var oBundle = oView.getModel("i18n") ? oView.getModel("i18n").getResourceBundle() : null;

            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: oBundle ? oBundle.getText("listTableTitle") : "List of Tables", 
                    busyIndicatorDelay: 0, 
                    noDataText: oBundle ? oBundle.getText("noDataText") : "No data found", 
                    contentWidth: "50%",
                    growing: true,                           
                    growingThreshold: 20,                    

                    search: function (oEvt) {
                        var sValue = oEvt.getParameter("value");
                        var oFilter = new Filter({
                            filters: [
                                new Filter("TableName", FilterOperator.Contains, sValue),
                                new Filter("Description", FilterOperator.Contains, sValue)
                            ],
                            and: false
                        });
                        oEvt.getSource().getBinding("items").filter([oFilter]);
                    },
                    
                    confirm: function (oEvt) {
                        var oSelectedItem = oEvt.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sName = oSelectedItem.getCells()[0].getTitle(); 
                            this.byId("searchTableInput").setValue(sName);
                            this.onSearchTableQuality(sName); 
                        }
                    }.bind(this),
                    
                    columns: [
                        new sap.m.Column({ header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableName") : "Table Name", design: "Bold" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableDesc") : "Table Description", design: "Bold" }), minScreenWidth: "Tablet", demandPopin: true })
                    ]
                });

                oView.addDependent(this._pValueHelpDialog);
                this._pValueHelpDialog.bindAggregation("items", {
                    path: "/TableLookup", 
                    template: new sap.m.ColumnListItem({
                        type: "Active", 
                        cells: [
                            new sap.m.ObjectIdentifier({ title: "{TableName}" }),
                            new sap.m.Text({ text: "{Description}", wrapping: true })
                        ]
                    })
                });
            }

            var oBinding = this._pValueHelpDialog.getBinding("items");
            if (oBinding) { oBinding.filter([]); }
            if (this._pValueHelpDialog._oSearchField) { this._pValueHelpDialog._oSearchField.setValue(""); }

            this._pValueHelpDialog.open();
        },

        onSearchTableQuality: function(vQuery) {
            var sQuery = (typeof vQuery === "string") ? vQuery : this.byId("searchTableInput").getValue();
            var oModel = this.getView().getModel("dash");
            var oODataModel = this.getView().getModel(); 
            var oCard = this.byId("dataManagementCard");

            if (!sQuery) {
                this.onResetPieChart();
                return;
            }

            if (oCard) { oCard.setBusy(true); }

            GetData.loadMeta(oODataModel, sQuery.toUpperCase(), "", "E")
                .then(function(oPayload) {
                    var aDataRows = oPayload.dataRows;
                    if (!aDataRows || aDataRows.length === 0) {
                        this.onResetPieChart(); 
                        sap.m.MessageToast.show("No data found for this table.");
                        return;
                    }

                    var aAllColumns = [];
                    var parsedRows = [];

                    aDataRows.forEach(function(row) {
                        if (row.data && typeof row.data === "string") {
                            try {
                                var parsedData = JSON.parse(row.data);
                                parsedRows.push(parsedData);
                                Object.keys(parsedData).forEach(function(key) {
                                    if (aAllColumns.indexOf(key) === -1) { aAllColumns.push(key); }
                                });
                            } catch (e) { console.error("Error parsing JSON:", e); }
                        }
                    });

                    if (aAllColumns.length === 0) {
                        this.onResetPieChart(); 
                        return;
                    }

                    var iValidCount = 0, iEmptyCount = 0;

                    parsedRows.forEach(function(parsedRow) {
                        aAllColumns.forEach(function(colName) {
                            var val = parsedRow[colName];
                            var isEmpty = false;

                            if (val === undefined || val === null) { isEmpty = true; } 
                            else if (typeof val === "string") {
                                var sTrim = val.trim();
                                if (sTrim === "" || sTrim === "0000-00-0" || sTrim === "0000-00-00" || sTrim === "-") { isEmpty = true; }
                            }
                            if (isEmpty) { iEmptyCount++; } else { iValidCount++; }
                        });
                    });

                    if (iValidCount === 0 && iEmptyCount === 0) {
                        this.onResetPieChart();
                    } else {
                        oModel.setProperty("/pieData", [
                            { status: "Valid Data", count: iValidCount },
                            { status: "Missing Data", count: iEmptyCount }
                        ]);
                        this._togglePieDataLabel(true);
                    }
                }.bind(this))
                .catch(function(oError) {
                    console.error("Error:", oError);
                    this.onResetPieChart(); 
                    sap.m.MessageToast.show("Error loading table data.");
                }.bind(this))
                .finally(function() {
                    if (oCard) { oCard.setBusy(false); }
                });
        },

        onRecentLogPress: function (oEvent) {
            var oLogData = oEvent.getSource().getBindingContext("dash").getObject();

            if (!oLogData.rowId) {
                sap.m.MessageToast.show("This log entry does not have a row ID, cannot view details!");
                return;
            }

            this.getOwnerComponent().getRouter().navTo("DetailData", {
                layout: sap.f.LayoutType.TwoColumnsMidExpanded, 
                tableName: oLogData.tableName,
                rowId: oLogData.rowId
            });
        },

        onResetPieChart: function() {
            var oModel = this.getView().getModel("dash");
            this.byId("searchTableInput").setValue("");
            oModel.setProperty("/pieData", [
                { status: "Valid Data in Table", count: 1 },
                { status: "Missing Data in Table", count: 1 }
            ]);
            this._togglePieDataLabel(false);
        },

        onExit: function () {
            if (this._aResizeHandlers && this._aResizeHandlers.length > 0) {
                this._aResizeHandlers.forEach(function(sHandlerId) {
                    ResizeHandler.deregister(sHandlerId);
                });
                this._aResizeHandlers = [];
            }
        }
    });
});