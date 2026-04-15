sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",           
    "sap/ui/model/FilterOperator",
    "sap/ui/core/ResizeHandler",
    "zapp/models/GetData",
    "zapp/api/DashboardApi",
    "zapp/utils/DataFormatter"
], function (Controller, JSONModel, Filter, FilterOperator, ResizeHandler, GetData, DashboardApi, DataFormatter) {
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
                recentLogs: [],
                qualityPercentage: 0,    
                qualityColor: "Neutral"     
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "dash");

            var oRouter = this.getOwnerComponent().getRouter();
            
            var oRoute = oRouter.getRoute("RouteDashboard"); 
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
            var oDashModel = this.getView().getModel("dash");
            var oView = this.getView();

            var oCardLine = this.byId("cardLineChart");
            var oCardBar  = this.byId("cardBarChart");
            var oCardLogs = this.byId("cardRecentLogs");

            if (oCardLine) oCardLine.setBusy(true);
            if (oCardBar)  oCardBar.setBusy(true);
            if (oCardLogs) oCardLogs.setBusy(true);

            var oAuditModel = this.getOwnerComponent().getModel("auditOData") || this.getOwnerComponent().getModel();
            
            var pDashboardApi = DashboardApi.getDashboardData().catch(function() { return {}; });
            
            var oListBinding = oAuditModel.bindList("/AuditLog");
            var pAuditLogs = oListBinding.requestContexts(0, 5000).then(function(aContexts) {
                return aContexts.map(function(c) { return c.getObject(); });
            }).catch(function(err) { 
                console.error("AuditLog Error: ", err); 
                return []; 
            });

            Promise.all([pDashboardApi, pAuditLogs]).then(function(aResults) {
                var oParsedData = aResults[0] || {};
                var aAllLogs = aResults[1] || [];

                var aRecentLogs = [];
                var iChangesToday = 0;
                var oNow = new Date();
                var aUniqueTables = [];

                aAllLogs.forEach(function(oLog) {
                    var sAction = "UPDATE";
                    if (oLog.Action === 'C') sAction = "CREATE";
                    if (oLog.Action === 'D') sAction = "DELETE";

                    var oDate = new Date(oLog.ChangedAt);
                    var sTime = DataFormatter.formatDateTime(oLog.ChangedAt);

                    if (oDate.getFullYear() === oNow.getFullYear() && 
                        oDate.getMonth() === oNow.getMonth() && 
                        oDate.getDate() === oNow.getDate()) {
                        iChangesToday++;
                    }

                    if (oLog.TableName && aUniqueTables.indexOf(oLog.TableName) === -1) {
                        aUniqueTables.push(oLog.TableName);
                    }

                    aRecentLogs.push({
                        tableName: oLog.TableName,
                        user: oLog.ChangedBy,
                        time: sTime,
                        action: sAction,
                        dateObj: oDate,
                        rowId: oLog.RecordKey
                    });
                });

                aRecentLogs.sort(function(a, b) { return b.dateObj - a.dateObj; });
                oDashModel.setProperty("/recentLogs", aRecentLogs.slice(0, 20));

                var aRealTimeChart = [];
                for (var i = 6; i >= 0; i--) {
                    var d = new Date();
                    d.setDate(d.getDate() - i);
                    var sChartDate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');

                    var iCreate = 0, iUpdate = 0, iDelete = 0;

                    aRecentLogs.forEach(function(log) {
                        if (log.dateObj.getFullYear() === d.getFullYear() &&
                            log.dateObj.getMonth() === d.getMonth() &&
                            log.dateObj.getDate() === d.getDate()) {
                            
                            if (log.action === "CREATE") iCreate++;
                            else if (log.action === "UPDATE") iUpdate++;
                            else if (log.action === "DELETE") iDelete++;
                        }
                    });

                    aRealTimeChart.push({
                        date: sChartDate,
                        create: iCreate,
                        update: iUpdate,
                        delete: iDelete
                    });
                }
                oDashModel.setProperty("/lineData", aRealTimeChart);

                oDashModel.setProperty("/kpi/totalTables", aUniqueTables.length > 0 ? aUniqueTables.length : (oParsedData.totalTables || 0));
                oDashModel.setProperty("/kpi/changedToday", iChangesToday);
                oDashModel.setProperty("/kpi/totalRecords", oParsedData.totalRecords || 0);
                oDashModel.setProperty("/topUsers", oParsedData.topUsers || []);

            }.bind(this)).finally(function() {
                if (oCardLine) oCardLine.setBusy(false);
                if (oCardBar)  oCardBar.setBusy(false);
                if (oCardLogs) oCardLogs.setBusy(false);
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

        onPressKPI: function(oEvent) {
            var oTile = oEvent.getSource();
            var sHeader = "";
            
            if (oTile.data("kpiTitle")) {
                sHeader = oTile.data("kpiTitle");
            } else if (oTile.getHeader) {
                sHeader = oTile.getHeader();
            }

            var oModel = this.getView().getModel("dash");

            if (this._oKPIPopover) {
                this._oKPIPopover.destroy();
                this._oKPIPopover = null;
            }

            var oContent;
            var sPopoverTitle = "";

            if (sHeader.indexOf("Changes Today") !== -1) {
                sPopoverTitle = "Number of Changes Today";

                var aLineData = oModel.getProperty("/lineData") || [];
                var oTodayChart = aLineData.length > 0 ? aLineData[aLineData.length - 1] : {create: 0, update: 0, delete: 0};

                oContent = new sap.m.VBox({
                    items: [
                        new sap.m.ObjectStatus({ text: "Create: " + oTodayChart.create, state: "Success", icon: "sap-icon://add-document" }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.ObjectStatus({ text: "Update: " + oTodayChart.update, state: "Warning", icon: "sap-icon://edit" }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.ObjectStatus({ text: "Delete: " + oTodayChart.delete, state: "Error", icon: "sap-icon://delete" })
                    ]
                }).addStyleClass("sapUiSmallMargin");

            } 
            else if (sHeader.indexOf("Custom Tables") !== -1) {
                sPopoverTitle = "Recently Active Tables";
                var aLogsTable = oModel.getProperty("/recentLogs") || [];
                var aUniqueTableNames = [];
                
                aLogsTable.forEach(function(log) {
                    if (log.tableName && aUniqueTableNames.indexOf(log.tableName) === -1 && aUniqueTableNames.length < 3) {
                        aUniqueTableNames.push(log.tableName);
                    }
                });

                var oList = new sap.m.List({ showSeparators: "Inner", busyIndicatorDelay: 0 });
                oContent = oList;

                if (aUniqueTableNames.length === 0) {
                    oList.addItem(new sap.m.StandardListItem({ title: "No recent activity", icon: "sap-icon://sys-cancel" }));
                } else {
                    oList.setBusy(true); 
                    var oMainODataModel = this.getOwnerComponent().getModel(); 

                    var aPromises = aUniqueTableNames.map(function(sTableName) {
                        return GetData.loadTableData(oMainODataModel, sTableName, "", "E")
                            .then(function(oPayload) {
                                var oMeta = (oPayload.metadata && oPayload.metadata.length > 0) ? oPayload.metadata[0] : {};
                                return {
                                    name: sTableName,
                                    desc: oMeta.tableDescription || oMeta.table_description || "No Description",
                                    cols: oPayload.metadata ? oPayload.metadata.length : 0 
                                };
                            })
                            .catch(function() {
                                return { name: sTableName, desc: "Error loading details", cols: 0 };
                            });
                    });

                    Promise.all(aPromises).then(function(aResults) {
                        oList.setBusy(false);
                        aResults.forEach(function(t) {
                            oList.addItem(new sap.m.ObjectListItem({
                                title: t.name,
                                icon: "sap-icon://table-chart",
                                attributes: [
                                    new sap.m.ObjectAttribute({ text: t.desc }) 
                                ],
                                firstStatus: new sap.m.ObjectStatus({
                                    text: t.cols + " Cols", 
                                    icon: "sap-icon://add-column",
                                    state: "Information"
                                })
                            }));
                        });
                    });
                }
            } 
            else {
                sPopoverTitle = "Data Insight";
                var iTables = oModel.getProperty("/kpi/totalTables") || 0;
                var iRecords = oModel.getProperty("/kpi/totalRecords") || 0;
                var iAvg = iTables > 0 ? Math.round(iRecords / iTables) : 0;

                oContent = new sap.m.VBox({
                    items: [
                        new sap.m.Text({ text: "Average records per table:" }).addStyleClass("sapUiTinyMarginBottom"),
                        new sap.m.ObjectNumber({
                            number: iAvg,
                            unit: "Records / Table",
                            state: "Success"
                        })
                    ]
                }).addStyleClass("sapUiSmallMargin");
            }

            this._oKPIPopover = new sap.m.Popover({
                title: sPopoverTitle,
                contentWidth: "320px",
                placement: "Bottom",
                content: [oContent],
                endButton: new sap.m.Button({
                    icon: "sap-icon://decline",
                    type: "Transparent",
                    press: function () { this._oKPIPopover.close(); }.bind(this)
                })
            });

            this.getView().addDependent(this._oKPIPopover);
            this._oKPIPopover.openBy(oTile);
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

            GetData.loadTableData(oODataModel, sQuery.toUpperCase(), "", "E")
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

                        var iTotal = iValidCount + iEmptyCount;
                        var iPercentage = iTotal > 0 ? Math.round((iValidCount / iTotal) * 100) : 0;
                        var sColor = "Neutral";
                        
                        if (iPercentage >= 90) {
                            sColor = "Good";
                        } else if (iPercentage >= 70) {
                            sColor = "Critical";
                        } else {
                            sColor = "Error";
                        }

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