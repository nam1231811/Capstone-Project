sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/ResizeHandler",
    "zapp/api/DashboardApi",
    "zapp/api/LoadData",
    "zapp/utils/ValueHelp",
    "zapp/utils/DataFormatter"
], function (Controller, JSONModel, ResizeHandler, DashboardApi, LoadData, ValueHelp, DataFormatter) {
    "use strict";

    const PATH_AUDIT_LOG = "/AuditLog";

    return Controller.extend("zapp.controller.Dashboard", {
        
        onInit: function () {
            var oData = {
                    kpi: { totalTables: 0, changedToday: 0, totalRecords: 0 },
                    lineData: [],
                    topUsers: [],
                    pieData: [
                        { status: "Valid Data in Table", count: 1 },
                        { status: "Missing Data in Table", count: 1 }
                    ],
                    recentLogs: [],
                    qualityPercentage: 0,    
                    qualityColor: "Neutral",
                    
                    popoverType: "", 
                    popoverTitle: "",
                    popoverAvg: 0,
                    popoverChanges: {},
                    popoverTables: [],
                    isPopoverTableBusy: false
                },
                oModel = new JSONModel(oData),
                oRouter = this.getOwnerComponent().getRouter(),
                oRoute = oRouter.getRoute("RouteDashboard"); 

            this._aResizeHandlers = []; 
            this.getView().setModel(oModel, "dash");

            if (oRoute) {
                oRoute.attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadDashboardData();
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            
            if (!oAuthModel.getProperty("/isAdmin")) {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true); 
                return;
            }
            this._loadDashboardData(); 
        },

        _loadDashboardData: function() {
            var oDashModel = this.getView().getModel("dash"),
                oCardLine = this.byId("cardLineChart"),
                oCardBar  = this.byId("cardBarChart"),
                oCardLogs = this.byId("cardRecentLogs"),
                oAuditModel = this.getOwnerComponent().getModel("auditOData") || this.getOwnerComponent().getModel(),
                pDashboardApi, pAuditLogs;

            if (oCardLine) oCardLine.setBusy(true);
            if (oCardBar)  oCardBar.setBusy(true);
            if (oCardLogs) oCardLogs.setBusy(true);

            pDashboardApi = DashboardApi.getDashboardData().catch(function() { return {}; });
            
            pAuditLogs = oAuditModel.bindList(PATH_AUDIT_LOG).requestContexts(0, 5000).then(function(aContexts) {
                return aContexts.map(c => c.getObject());
            }).catch(function(err) { 
                console.error("AuditLog Error: ", err); 
                return []; 
            });

            Promise.all([pDashboardApi, pAuditLogs]).then(function(aResults) {
                var oApiData = aResults[0] || {},
                    aAllLogs = aResults[1] || [],
                    oNow = new Date(),
                    iChangesToday = 0,
                    aUniqueTables = [],
                    aRecentLogs = [],
                    aRealTimeChart = [],
                    i, d, sChartDate;

                aAllLogs.forEach(function(oLog) {
                    var sAction = oLog.Action === 'C' ? "CREATE" : (oLog.Action === 'D' ? "DELETE" : "UPDATE"),
                        sRawTime = oLog.ChangedAt || "",
                        sFormattedTime = DataFormatter.formatDateTime(sRawTime),
                        sCleanTime = String(sRawTime).replace(/\D/g, ""), 
                        oDate = new Date();

                    if (sCleanTime.length >= 14) {
                        oDate = new Date(
                            parseInt(sCleanTime.substring(0, 4), 10), 
                            parseInt(sCleanTime.substring(4, 6), 10) - 1, 
                            parseInt(sCleanTime.substring(6, 8), 10),
                            parseInt(sCleanTime.substring(8, 10), 10), 
                            parseInt(sCleanTime.substring(10, 12), 10), 
                            parseInt(sCleanTime.substring(12, 14), 10)
                        );
                    } else if (sRawTime) {
                        oDate = new Date(sRawTime);
                    }

                    if (oDate.getFullYear() === oNow.getFullYear() && oDate.getMonth() === oNow.getMonth() && oDate.getDate() === oNow.getDate()) {
                        iChangesToday++;
                    }

                    if (oLog.TableName && !aUniqueTables.includes(oLog.TableName)) {
                        aUniqueTables.push(oLog.TableName);
                    }

                    aRecentLogs.push({
                        tableName: oLog.TableName,
                        user: oLog.ChangedBy,
                        time: sFormattedTime,
                        action: sAction,
                        dateObj: oDate,
                        rowId: oLog.RecordKey
                    });
                });

                aRecentLogs.sort((a, b) => b.dateObj - a.dateObj);
                oDashModel.setProperty("/recentLogs", aRecentLogs.slice(0, 20));

                for (i = 6; i >= 0; i--) {
                    d = new Date();
                    d.setDate(d.getDate() - i);
                    sChartDate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');

                    var iCreate = 0, iUpdate = 0, iDelete = 0;

                    aAllLogs.forEach(function(log) {
                        var logDate = new Date(),
                            sClean = String(log.ChangedAt || "").replace(/\D/g, "");
                        
                        if(sClean.length >= 14) {
                            logDate = new Date(
                                parseInt(sClean.substring(0, 4), 10), 
                                parseInt(sClean.substring(4, 6), 10) - 1, 
                                parseInt(sClean.substring(6, 8), 10)
                            );
                        } else if (log.ChangedAt) {
                            logDate = new Date(log.ChangedAt);
                        }

                        if (logDate.getFullYear() === d.getFullYear() && logDate.getMonth() === d.getMonth() && logDate.getDate() === d.getDate()) {
                            if (log.Action === "C") iCreate++;
                            else if (log.Action === "U") iUpdate++;
                            else if (log.Action === "D") iDelete++;
                        }
                    });

                    aRealTimeChart.push({ date: sChartDate, create: iCreate, update: iUpdate, delete: iDelete });
                }
                oDashModel.setProperty("/lineData", aRealTimeChart);
                oDashModel.setProperty("/kpi/totalTables", aUniqueTables.length > 0 ? aUniqueTables.length : (oApiData.totalTables || 0));
                oDashModel.setProperty("/kpi/changedToday", iChangesToday);
                oDashModel.setProperty("/kpi/totalRecords", oApiData.totalRecords || 0);
                oDashModel.setProperty("/topUsers", oApiData.topUsers || []);

            }.bind(this)).finally(function() {
                if (oCardLine) oCardLine.setBusy(false);
                if (oCardBar)  oCardBar.setBusy(false);
                if (oCardLogs) oCardLogs.setBusy(false);
            });
        },

        onAfterRendering: function () {
            var sHandlerId;
            this._togglePieDataLabel(false);
            sHandlerId = ResizeHandler.register(this.getView(), this._onResize.bind(this));
            this._aResizeHandlers.push(sHandlerId);
        },

        _onResize: function() {
            var aChartIds = ["idLineChart", "idBarChart", "idPieChart"];
            aChartIds.forEach(function(sId) {
                var oChart = this.byId(sId);
                if (oChart) oChart.invalidate();
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

        onPressKPI: function(oEvent) {
            var oTile = oEvent.getSource(),
                sHeader = oTile.data("kpiTitle") || (oTile.getHeader ? oTile.getHeader() : ""),
                oModel = this.getView().getModel("dash"),
                oPopover = this.byId("kpiPopover"),
                oMainODataModel = this.getOwnerComponent().getModel(),
                aLogsTable, aUniqueTableNames = [],
                aPromises, aLineData, oTodayChart, iTables, iRecords;

            if (sHeader.indexOf("Changes Today") !== -1) {
                oModel.setProperty("/popoverType", "CHANGES");
                oModel.setProperty("/popoverTitle", "Number of Changes Today");

                aLineData = oModel.getProperty("/lineData") || [];
                oTodayChart = aLineData.length > 0 ? aLineData[aLineData.length - 1] : {create: 0, update: 0, delete: 0};
                oModel.setProperty("/popoverChanges", oTodayChart);

                oPopover.openBy(oTile);
            } 
            else if (sHeader.indexOf("Custom Tables") !== -1) {
                oModel.setProperty("/popoverType", "TABLES");
                oModel.setProperty("/popoverTitle", "Recently Active Tables");
                oModel.setProperty("/popoverTables", []);
                oModel.setProperty("/isPopoverTableBusy", false);
                
                aLogsTable = oModel.getProperty("/recentLogs") || [];
                aLogsTable.forEach(function(log) {
                    if (log.tableName && aUniqueTableNames.indexOf(log.tableName) === -1 && aUniqueTableNames.length < 3) {
                        aUniqueTableNames.push(log.tableName);
                    }
                });

                oPopover.openBy(oTile);

                if (aUniqueTableNames.length > 0) {
                    oModel.setProperty("/isPopoverTableBusy", true);
                    aPromises = aUniqueTableNames.map(function(sTableName) {
                        return LoadData.loadTableData(oMainODataModel, sTableName, "", "E")
                            .then(function(oPayload) {
                                var oMeta = (oPayload.metadata && oPayload.metadata.length > 0) ? oPayload.metadata[0] : {};
                                return {
                                    name: sTableName,
                                    desc: oMeta.tableDescription || oMeta.table_description || "No Description",
                                    cols: oPayload.metadata ? oPayload.metadata.length : 0 
                                };
                            }).catch(function() {
                                return { name: sTableName, desc: "Error loading details", cols: 0 };
                            });
                    });

                    Promise.all(aPromises).then(function(aResults) {
                        oModel.setProperty("/popoverTables", aResults);
                        oModel.setProperty("/isPopoverTableBusy", false);
                    });
                }
            } 
            else {
                oModel.setProperty("/popoverType", "RECORDS");
                oModel.setProperty("/popoverTitle", "Data Insight");
                
                iTables = oModel.getProperty("/kpi/totalTables") || 0;
                iRecords = oModel.getProperty("/kpi/totalRecords") || 0;
                oModel.setProperty("/popoverAvg", iTables > 0 ? Math.round(iRecords / iTables) : 0);

                oPopover.openBy(oTile);
            }
        },

        onCloseKPIPopover: function() {
            this.byId("kpiPopover").close();
        },

        onValueHelpRequest: function (oEvent) {
            ValueHelp.openTableValueHelp(this, {
                inputId: "searchTableInput",
                callback: (sName) => this.onSearchTableQuality(sName)
            });
        },

        onSearchTableQuality: function(vQuery) {
            var sQuery = (typeof vQuery === "string") ? vQuery : this.byId("searchTableInput").getValue(),
                oModel = this.getView().getModel("dash"),
                oODataModel = this.getView().getModel(), 
                oCard = this.byId("dataManagementCard");

            if (!sQuery) {
                this.onResetPieChart();
                return;
            }

            if (oCard) oCard.setBusy(true);

            LoadData.loadTableData(oODataModel, sQuery.toUpperCase(), "", "E")
                .then(function(oPayload) {
                    var aDataRows = oPayload.dataRows,
                        aAllColumns = [], parsedRows = [],
                        iValidCount = 0, iEmptyCount = 0,
                        iTotal, iPercentage, sColor;

                    if (!aDataRows || aDataRows.length === 0) {
                        this.onResetPieChart(); 
                        sap.m.MessageToast.show("No data found for this table.");
                        return;
                    }

                    aDataRows.forEach(function(row) {
                        var parsedData;
                        if (row.data && typeof row.data === "string") {
                            try {
                                parsedData = JSON.parse(row.data);
                                parsedRows.push(parsedData);
                                Object.keys(parsedData).forEach(function(key) {
                                    if (aAllColumns.indexOf(key) === -1) aAllColumns.push(key);
                                });
                            } catch (e) { 
                                console.error("Error parsing JSON:", e); 
                            }
                        }
                    });

                    if (aAllColumns.length === 0) {
                        this.onResetPieChart(); 
                        return;
                    }

                    parsedRows.forEach(function(parsedRow) {
                        aAllColumns.forEach(function(colName) {
                            var val = parsedRow[colName],
                                isEmpty = false, sTrim;

                            if (val === undefined || val === null) { 
                                isEmpty = true; 
                            } else if (typeof val === "string") {
                                sTrim = val.trim();
                                if (sTrim === "" || sTrim === "0000-00-0" || sTrim === "0000-00-00" || sTrim === "-") isEmpty = true;
                            }
                            
                            if (isEmpty) iEmptyCount++; 
                            else iValidCount++;
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

                        iTotal = iValidCount + iEmptyCount;
                        iPercentage = iTotal > 0 ? Math.round((iValidCount / iTotal) * 100) : 0;
                        sColor = "Neutral";
                        
                        if (iPercentage >= 90) sColor = "Good";
                        else if (iPercentage >= 70) sColor = "Critical";
                        else sColor = "Error";
                        
                        oModel.setProperty("/qualityPercentage", iPercentage);
                        oModel.setProperty("/qualityColor", sColor);
                    }
                }.bind(this))
                .catch(function(oError) {
                    console.error("Error:", oError);
                    this.onResetPieChart(); 
                    sap.m.MessageToast.show("Error loading table data.");
                }.bind(this))
                .finally(function() {
                    if (oCard) oCard.setBusy(false);
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
            oModel.setProperty("/qualityPercentage", 0);
            oModel.setProperty("/qualityColor", "Neutral");
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