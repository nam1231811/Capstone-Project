sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/ResizeHandler",
    "zapp/api/DashboardApi",
    "zapp/api/LoadData",
    "zapp/utils/ValueHelp",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, ResizeHandler, DashboardApi, LoadData, ValueHelp, MessageToast, Filter, FilterOperator) {
    "use strict";

    const PATH_AUDIT_LOG = "/AuditLog";

    return Controller.extend("zapp.controller.Dashboard", {

        onInit: function () {
            var oData = {
                kpi: { totalTables: 0, changedToday: 0, totalRecords: 0 },
                lineData: [],
                topUsers: [],
                csrfToken: "",
                pieData: [
                    { status: "Valid Data in Table", count: 1 },
                    { status: "Missing Data in Table", count: 1 }
                ],
                qualityPercentage: 0,    
                qualityColor: "Neutral",
                dataInsight: { totalRows: 0, topMissingCols: [] },
                popoverType: "", 
                popoverTitle: "",
                popoverAvg: 0,
                popoverChanges: {},
                popoverTables: [],
                isPopoverTableBusy: false,
                detailTitle: "",
                detailRejectRate: null,
                detailTables: [],
                isDetailBusy: false
            };

            var oModel = new JSONModel(oData),
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
                oCardBar  = this.byId("cardBarChart");

            if (oCardLine) oCardLine.setBusy(true);
            if (oCardBar)  oCardBar.setBusy(true);

            DashboardApi.getDashboardData().then(function(oApiData) {
                oDashModel.setProperty("/kpi", oApiData.kpi);
                oDashModel.setProperty("/lineData", oApiData.lineData);
                oDashModel.setProperty("/topUsers", oApiData.topUsers);
                oDashModel.setProperty("/csrfToken", oApiData.csrfToken);
            }).catch(function(err) {
                console.error("Error loading dashboard data:", err);
                MessageToast.show("Error loading dashboard data");
            }).finally(function() {
                if (oCardLine) oCardLine.setBusy(false);
                if (oCardBar)  oCardBar.setBusy(false);
            });
        },

        onPressKPI: function(oEvent) {
            var oTile = oEvent.getSource(),
                sHeader = oTile.data("kpiTitle") || "",
                oModel = this.getView().getModel("dash"),
                oPopover = this.byId("kpiPopover"),
                aLineData, iTables, iRecords;

            if (sHeader.indexOf("Changes Today") !== -1) {
                oModel.setProperty("/popoverType", "CHANGES");
                oModel.setProperty("/popoverTitle", "Changes Today");
                aLineData = oModel.getProperty("/lineData") || [];
                oModel.setProperty("/popoverChanges", aLineData.length > 0 ? aLineData[aLineData.length - 1] : {CREATE_COUNT: 0, UPDATE_COUNT: 0, DELETE_COUNT: 0});
                oPopover.openBy(oTile);
            } 
            else if (sHeader.indexOf("Custom Tables") !== -1) {
                oModel.setProperty("/popoverType", "TABLES");
                oModel.setProperty("/popoverTitle", "Recently Active Tables");
                oModel.setProperty("/popoverTables", []);
                oModel.setProperty("/isPopoverTableBusy", true);
                oPopover.openBy(oTile);

                var oAuditModel = this.getOwnerComponent().getModel("auditOData") || this.getOwnerComponent().getModel(),
                    oListBinding = oAuditModel.bindList(PATH_AUDIT_LOG, undefined, undefined, undefined, { $select: "TableName" });
                
                oListBinding.requestContexts(0, 1000).then(function(aContexts) {
                    var aUniqueTables = [];
                    aContexts.forEach(function(ctx) {
                        var sTable = ctx.getProperty("TableName");
                        if (sTable && !aUniqueTables.includes(sTable)) {
                            aUniqueTables.push(sTable);
                        }
                    });
                    oModel.setProperty("/popoverTables", aUniqueTables.map(t => ({ name: t })));
                }).catch(function() {
                    MessageToast.show("Error loading tables list");
                }).finally(function() {
                    oModel.setProperty("/isPopoverTableBusy", false);
                });
            } 
            else {
                oModel.setProperty("/popoverType", "RECORDS");
                oModel.setProperty("/popoverTitle", "General Insight");
                iTables = oModel.getProperty("/kpi/totalTables") || 0;
                iRecords = oModel.getProperty("/kpi/totalRecords") || 0;
                oModel.setProperty("/popoverAvg", iTables > 0 ? Math.round(iRecords / iTables) : 0);
                oPopover.openBy(oTile);
            }
        },

        onCloseKPIPopover: function() {
            this.byId("kpiPopover").close();
        },

        onLineChartSelect: function(oEvent) {
            var aData = oEvent.getParameter("data");

            if (!aData || aData.length !== 1) {
                return; 
            }

            var oData = aData[0].data,
                sDate = oData["Date"] || oData.CHART_DATE; 
            
            if (!sDate) return;

            var sDateClean = sDate.replace(/-/g, ""),
                oDashModel = this.getView().getModel("dash"),
                oAuditModel = this.getOwnerComponent().getModel("auditOData") || this.getOwnerComponent().getModel(),
                oListBinding;

            oDashModel.setProperty("/detailTitle", "Changes on " + sDate);
            oDashModel.setProperty("/detailRejectRate", null); 
            oDashModel.setProperty("/isDetailBusy", true);
            oDashModel.setProperty("/detailTables", []);

            this.byId("detailDialog").open();

            oListBinding = oAuditModel.bindList(PATH_AUDIT_LOG, undefined, undefined, undefined, { 
                $select: "TableName,ChangedAt" 
            });

            oListBinding.requestContexts(0, 2000).then(function(aContexts) {
                var oTableStats = {}, aTableData;
                
                aContexts.forEach(function(ctx) {
                    var sTable = ctx.getProperty("TableName");
                    var sRawTime = ctx.getProperty("ChangedAt") || "";
                    var sCleanTime = String(sRawTime).replace(/\D/g, ""); 
                    
                    if (sTable && sCleanTime.indexOf(sDateClean) === 0) {
                        oTableStats[sTable] = oTableStats[sTable] || { name: sTable, count: 0 };
                        oTableStats[sTable].count++;
                    }
                });
                
                aTableData = Object.values(oTableStats).sort((a,b) => b.count - a.count);
                oDashModel.setProperty("/detailTables", aTableData);
                
            }).catch(function(err) {
                console.error("Error fetching detail data:", err);
                MessageToast.show("Error fetching detail data");
            }).finally(function() {
                oDashModel.setProperty("/isDetailBusy", false);
            });
        },

        onTopUserSelect: function(oEvent) {
            var aData = oEvent.getParameter("data");
            if (!aData || aData.length === 0) return;

            var oData = aData[0].data,
                sUser = oData["Changed By"] || oData.CHANGED_BY;

            if (!sUser) return;

            var oDashModel = this.getView().getModel("dash"),
                aTopUsers = oDashModel.getProperty("/topUsers"),
                oSelectedUser = aTopUsers.find(u => u.CHANGED_BY === sUser),
                oFilter = new Filter("ChangedBy", FilterOperator.EQ, sUser),
                oAuditModel = this.getOwnerComponent().getModel("auditOData") || this.getOwnerComponent().getModel(),
                oListBinding;
            
            oDashModel.setProperty("/detailTitle", "Activity of " + sUser);
            oDashModel.setProperty("/detailRejectRate", oSelectedUser ? oSelectedUser.REJECT_RATE : 0);
            oDashModel.setProperty("/isDetailBusy", true);
            oDashModel.setProperty("/detailTables", []);

            this.byId("detailDialog").open();

            oListBinding = oAuditModel.bindList(PATH_AUDIT_LOG, undefined, undefined, oFilter, { $select: "TableName" });
            oListBinding.requestContexts(0, 1000).then(function(aContexts) {
                var aUniqueTables = [];
                aContexts.forEach(function(ctx) {
                    var sTable = ctx.getProperty("TableName");
                    if (sTable && !aUniqueTables.includes(sTable)) {
                        aUniqueTables.push(sTable);
                    }
                });
                oDashModel.setProperty("/detailTables", aUniqueTables.map(t => ({ name: t })));
            }).finally(function() {
                oDashModel.setProperty("/isDetailBusy", false);
            });
        },

        onUserFilterChange: function(oEvent) {
            var sUserId = oEvent.getParameter("newValue") || oEvent.getParameter("query"),
                oDashModel = this.getView().getModel("dash"),
                sToken = oDashModel.getProperty("/csrfToken"),
                oCardLine = this.byId("cardLineChart");

            if (oCardLine) oCardLine.setBusy(true);

            DashboardApi.getChartData(sToken, sUserId.toUpperCase()).then(function(oResult) {
                oDashModel.setProperty("/lineData", oResult.CHART_DATA || []);
            }).catch(function(err) {
                console.error("Error filtering data:", err);
                MessageToast.show("Error filtering data.");
            }).finally(function() {
                if (oCardLine) oCardLine.setBusy(false);
            });
        },

        onCloseDetailDialog: function() {
            this.byId("detailDialog").close();
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

            if (!sQuery) return this.onResetPieChart();
            if (oCard) oCard.setBusy(true);

            LoadData.loadTableData(oODataModel, sQuery.toUpperCase(), "", "E").then(function(oPayload) {
                var aDataRows = oPayload.dataRows || [],
                    aAllColumns = [], 
                    parsedRows = [],
                    iValidCount = 0, 
                    iEmptyCount = 0,
                    oColEmptyCount = {},
                    aTopMissing, iTotal, iPercentage, sColor;

                if (aDataRows.length === 0) {
                    this.onResetPieChart(); 
                    MessageToast.show("No data found for this table");
                    return;
                }

                aDataRows.forEach(function(row) {
                    var oParsedData;
                    if (row.data && typeof row.data === "string") {
                        try {
                            oParsedData = JSON.parse(row.data);
                            parsedRows.push(oParsedData);
                            Object.keys(oParsedData).forEach(function(key) {
                                if (aAllColumns.indexOf(key) === -1) aAllColumns.push(key);
                            });
                        } catch (e) {}
                    }
                });

                if (aAllColumns.length === 0) return this.onResetPieChart();

                parsedRows.forEach(function(parsedRow) {
                    aAllColumns.forEach(function(colName) {
                        var val = parsedRow[colName],
                            isEmpty = false, 
                            sTrim;

                        if (val === undefined || val === null) { isEmpty = true; } 
                        else if (typeof val === "string") {
                            sTrim = val.trim();
                            if (sTrim === "" || sTrim === "0000-00-0" || sTrim === "0000-00-00" || sTrim === "-") isEmpty = true;
                        }
                        
                        if (isEmpty) {
                            iEmptyCount++; 
                            oColEmptyCount[colName] = (oColEmptyCount[colName] || 0) + 1;
                        } else {
                            iValidCount++;
                        }
                    });
                });

                aTopMissing = Object.keys(oColEmptyCount)
                    .map(key => ({ col: key, count: oColEmptyCount[key] }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);

                iTotal = iValidCount + iEmptyCount;
                iPercentage = iTotal > 0 ? Math.round((iValidCount / iTotal) * 100) : 0;
                sColor = iPercentage >= 90 ? "Good" : (iPercentage >= 70 ? "Critical" : "Error");

                oModel.setProperty("/pieData", [
                    { status: "Valid Data", count: iValidCount },
                    { status: "Missing Data", count: iEmptyCount }
                ]);
                this._togglePieDataLabel(true);
                
                oModel.setProperty("/qualityPercentage", iPercentage);
                oModel.setProperty("/qualityColor", sColor);
                oModel.setProperty("/dataInsight/totalRows", parsedRows.length);
                oModel.setProperty("/dataInsight/topMissingCols", aTopMissing);

            }.bind(this)).catch(function(oError) {
                console.error(oError);
                this.onResetPieChart(); 
                MessageToast.show("Error loading table data");
            }.bind(this)).finally(function() {
                if (oCard) oCard.setBusy(false);
            });
        },

        onResetPieChart: function() {
            var oModel = this.getView().getModel("dash");
            this.byId("searchTableInput").setValue("");
            this._togglePieDataLabel(false);
            
            oModel.setProperty("/pieData", [
                { status: "Valid Data in Table", count: 1 },
                { status: "Missing Data in Table", count: 1 }
            ]);
            oModel.setProperty("/qualityPercentage", 0);
            oModel.setProperty("/qualityColor", "Neutral");
            oModel.setProperty("/dataInsight/totalRows", 0);
            oModel.setProperty("/dataInsight/topMissingCols", []);
        },

        _togglePieDataLabel: function(bShow) {
            var oVizFrame = this.byId("idPieChart");
            if (oVizFrame) {
                oVizFrame.setVizProperties({
                    plotArea: { dataLabel: { visible: bShow, type: 'value' } }
                });
            }
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