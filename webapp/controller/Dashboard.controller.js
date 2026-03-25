sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",           
    "sap/ui/model/FilterOperator",
    "zapp/models/GetData"
], function (Controller, JSONModel, Filter, FilterOperator, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.Dashboard", {
        onInit: function () {
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
                    { status: "Total of Data in Table", count: 1 },
                    { status: "Total of Missing Data in Table", count: 1 }
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
            sap.m.MessageToast.show("Sau này có thể click vào đây để xem báo cáo chi tiết!");
        },

        onValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            var oBundle = oView.getModel("i18n") ? oView.getModel("i18n").getResourceBundle() : null;

            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: oBundle ? oBundle.getText("listTableTitle") : "Chọn Bảng", 
                    busyIndicatorDelay: 0, 
                    noDataText: oBundle ? oBundle.getText("noDataText") : "Không có dữ liệu", 
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
                            header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableName") : "Tên Bảng", design: "Bold" }) 
                        }),
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle ? oBundle.getText("tableDesc") : "Mô Tả", design: "Bold" }),
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
            var sQuery = typeof vQuery === "string" ? vQuery : this.byId("searchTableInput").getValue();
            var oModel = this.getView().getModel("dash");
            var oODataModel = this.getView().getModel(); 
            var oView = this.getView();

            if (!sQuery) {
                oModel.setProperty("/pieData", [
                    { status: "Total of Data in Table", count: 1 },
                    { status: "Total of Missing Data in Table", count: 1 }
                ]);
                this._togglePieDataLabel(false);
                return;
            }

            oView.setBusy(true);

            GetData.loadMeta(oODataModel, sQuery.toUpperCase(), "", "E")
                .then(function(oPayload) {
                    var aData = oPayload.dataRows;

                    if (!aData || aData.length === 0) {
                        sap.m.MessageToast.show("This table currently has no data!");
                        oModel.setProperty("/pieData", []);
                        oView.setBusy(false);
                        return;
                    }

                    var iValidCount = 0;
                    var iEmptyCount = 0;

                    aData.forEach(function(row) {
                        var bHasEmpty = false;
                        Object.keys(row).forEach(function(key) {
                            var value = row[key];
                            if (value === "" || value === null || value === undefined) {
                                bHasEmpty = true;
                            }
                        });

                        if (bHasEmpty) { iEmptyCount++; } else { iValidCount++; }
                    });

                    oModel.setProperty("/pieData", [
                        { status: "Total of Data", count: iValidCount },
                        { status: "Total of Missing Data", count: iEmptyCount }
                    ]);

                    this._togglePieDataLabel(true);

                    sap.m.MessageToast.show("This table currently has" + aData.length + "records.");
                }.bind(this))
                .catch(function(oError) {
                    console.error("Lỗi:", oError);
                    sap.m.MessageBox.error("Cannot load data for table" + sQuery.toUpperCase());
                })
                .finally(function() {
                    oView.setBusy(false); 
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
        }
    });
});