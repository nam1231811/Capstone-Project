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
                kpi: {
                    totalTables: 24,
                    changedToday: 156,
                    totalRecords: 125000
                },
                lineData: [
                    { date: "T2", create: 12, update: 45, delete: 2 },
                    { date: "T3", create: 5, update: 30, delete: 0 },
                    { date: "T4", create: 20, update: 60, delete: 15 },
                    { date: "T5", create: 8, update: 25, delete: 1 },
                    { date: "T6", create: 15, update: 50, delete: 5 },
                    { date: "T7", create: 3, update: 10, delete: 0 },
                    { date: "CN", create: 0, update: 5, delete: 0 }
                ],
                topUsers: [
                    { user: "DEV-092", actions: 120 },
                    { user: "ADMIN", actions: 85 },
                    { user: "USER-01", actions: 40 },
                    { user: "USER-05", actions: 25 },
                    { user: "SYSTEM", actions: 10 }
                ],
                pieData: [
                    { status: "Valid Data in Table", count: 1 },
                    { status: "Missing Data in Table", count: 1 }
                ],
                recentLogs: [
                    { tableName: "ZEMPLOYEE_105", action: "UPDATE", user: "DEV-092", time: "10:05", status: "Success", rowId: "11" },
                    { tableName: "ZCOURSE_DEV335", action: "CREATE", user: "ADMIN", time: "09:30", status: "Success", rowId: "2" },
                    { tableName: "ZEMPLOYEE_105", action: "DELETE", user: "USER-01", time: "09:15", status: "Success", rowId: "9" },
                    { tableName: "ZDEPARTMENT", action: "UPDATE", user: "DEV-092", time: "08:45", status: "Success", rowId: "5" },
                    { tableName: "ZCONFIG", action: "UPDATE", user: "SYSTEM", time: "00:01", status: "Success", rowId: "1" }
                ]
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "dash");
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
                    plotArea: {
                        dataLabel: {
                            visible: bShow,
                            type: 'value'
                        }
                    }
                });
            }
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true); 
        },

        onPressKPI: function() {
            sap.m.MessageToast.show("Press KPI card - future enhancement to navigate to detailed view");
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
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableName") : "Table Name", design: "Bold" }) 
                        }),
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableDesc") : "Table Description", design: "Bold" }),
                            minScreenWidth: "Tablet", 
                            demandPopin: true         
                        })
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
            var sQuery = "";
            if (typeof vQuery === "string") {
                sQuery = vQuery;
            } else {
                sQuery = this.byId("searchTableInput").getValue();
            }

            var oModel = this.getView().getModel("dash");
            var oODataModel = this.getView().getModel(); 

            var oCard = this.byId("dataManagementCard");

            if (!sQuery) {
                this.onResetPieChart();
                return;
            }

            if (oCard) {
                oCard.setBusy(true);
            }

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
                                    if (aAllColumns.indexOf(key) === -1) {
                                        aAllColumns.push(key);
                                    }
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

                    var iValidCount = 0;
                    var iEmptyCount = 0;

                    parsedRows.forEach(function(parsedRow) {
                        aAllColumns.forEach(function(colName) {
                            var val = parsedRow[colName];
                            var isEmpty = false;

                            if (val === undefined || val === null) {
                                isEmpty = true;
                            } else if (typeof val === "string") {
                                var sTrim = val.trim();
                                if (sTrim === "" || sTrim === "0000-00-0" || sTrim === "0000-00-00" || sTrim === "-") {
                                    isEmpty = true;
                                }
                            }

                            if (isEmpty) {
                                iEmptyCount++;
                            } else {
                                iValidCount++;
                            }
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
                    if (oCard) {
                        oCard.setBusy(false); 
                    }
                });
        },

        onRecentLogPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oBindingContext = oItem.getBindingContext("dash");
            var oLogData = oBindingContext.getObject();

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("DetailData", {
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