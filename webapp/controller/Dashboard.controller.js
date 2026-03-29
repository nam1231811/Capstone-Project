sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",           
    "sap/ui/model/FilterOperator",
    "sap/ui/core/ResizeHandler",
    "zapp/models/GetData",
    "zapp/api/DashboardApi"
], function (Controller, JSONModel, Filter, FilterOperator, ResizeHandler, GetData, DashboardApi) {
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

            var oRouter = this.getOwnerComponent().getRouter();
            
            var oRoute = oRouter.getRoute("RouteDashboard"); 
            if (oRoute) {
                oRoute.attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadDashboardData();
            }

            this._loadDashboardData();
        },

        _onRouteMatched: function () {
            this._loadDashboardData();
        },

        _loadDashboardData: function() {
            var oDashModel = this.getView().getModel("dash");

            var oCardLine = this.byId("cardLineChart");
            var oCardBar  = this.byId("cardBarChart");
            var oCardLogs = this.byId("cardRecentLogs");

            if (oCardLine) oCardLine.setBusy(true);
            if (oCardBar)  oCardBar.setBusy(true);
            if (oCardLogs) oCardLogs.setBusy(true);

            DashboardApi.getDashboardData()
                .then(function(oParsedData) {
                    oDashModel.setProperty("/kpi/totalTables", oParsedData.totalTables);
                    oDashModel.setProperty("/kpi/changedToday", oParsedData.changedToday);
                    oDashModel.setProperty("/kpi/totalRecords", oParsedData.totalRecords);
                    oDashModel.setProperty("/topUsers", oParsedData.topUsers);
                    oDashModel.setProperty("/recentLogs", oParsedData.recentLogs);
                    oDashModel.setProperty("/lineData", oParsedData.lineData);
                })
                .catch(function(error) {
                    console.error("Lỗi lấy dữ liệu Dashboard:", error);
                    sap.m.MessageToast.show("Lỗi tải dữ liệu Dashboard.");
                })
                .finally(function() {
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