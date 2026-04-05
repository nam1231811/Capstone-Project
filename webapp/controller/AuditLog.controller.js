sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/utils/DataFormatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, DataFormatter) {
    "use strict";

    return Controller.extend("zapp.controller.AuditLog", {
        formatter: DataFormatter,

        onInit: function () {
            var oModel = new JSONModel({
                mainLogs: [],
                allLogs: [],
                selectedRowId: "",
                processNodes: [],
                processLanes: [],
                selectedNodeChanges: [],
                selectedNodeAction: undefined,
                selectedNodeTime: "",
                selectedLogUuid: ""
            });
            this.getView().setModel(oModel, "audit");

            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter.getRoute("RouteAuditLog")) {
                oRouter.getRoute("RouteAuditLog").attachPatternMatched(this._onRouteMatched, this);
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            
            if (!oAuthModel.getProperty("/isAdmin")) {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true); 
                return;
            }
        },

        onValueHelpRequest: function (oEvent) {
            var oView = this.getView();

            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: "List of tables",
                    busyIndicatorDelay: 0,
                    noDataText: "No data available",
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
                            this.byId("auditSearchInput").setValue(sName);
                            this.onSearchAuditLog(sName);
                        }
                    }.bind(this),
                    columns: [
                        new sap.m.Column({ header: new sap.m.Label({ text: "Table Name", design: "Bold" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: "Description", design: "Bold" }), demandPopin: true })
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

        onSearchAuditLog: function (vEventOrString) {
            var sTableName = typeof vEventOrString === "string" ? vEventOrString : this.byId("auditSearchInput").getValue();
            var oLocalModel = this.getView().getModel("audit");
            var oODataModel = this.getOwnerComponent().getModel("auditOData");

            if (!oODataModel) {
                sap.m.MessageBox.error("No model found for backend connection");
                return;
            }

            if (!sTableName || sTableName.trim() === "") {
                sap.m.MessageToast.show("Please enter the table name to search!");
                oLocalModel.setProperty("/mainLogs", []);
                return;
            }

            this.byId("auditMasterTable").setBusy(true);

            var oListBinding = oODataModel.bindList("/AuditLog");
            oListBinding.filter(new sap.ui.model.Filter("TableName", sap.ui.model.FilterOperator.EQ, sTableName.toUpperCase()));

            oListBinding.requestContexts(0, 5000).then(function (aContexts) {
                var aAllLogs = [];
                aContexts.forEach(function (oCtx) {
                    aAllLogs.push(oCtx.getObject());
                });

                aAllLogs.sort(function (a, b) {
                    return new Date(b.ChangedAt) - new Date(a.ChangedAt);
                });

                oLocalModel.setProperty("/allLogs", aAllLogs);

                var aMainLogs = [];

                aAllLogs.forEach(function (oLog) {
                    var sAction = "UPDATE";
                    if (oLog.Action === 'C') sAction = "CREATE";
                    if (oLog.Action === 'D') sAction = "DELETE";

                    var sTime = DataFormatter.formatDateTime(oLog.ChangedAt);

                    aMainLogs.push({
                        rowId: oLog.RecordKey,
                        lastAction: sAction,
                        lastUser: oLog.ChangedBy,
                        lastTimestamp: sTime
                    });
                });

                oLocalModel.setProperty("/mainLogs", aMainLogs);
                this.byId("auditMasterTable").setBusy(false);
                sap.m.MessageToast.show("Loaded audit log for table: " + sTableName.toUpperCase());

            }.bind(this)).catch(function (oError) {
                this.byId("auditMasterTable").setBusy(false);
                sap.m.MessageBox.error("Error occurred while loading audit log data: " + oError.message);
            }.bind(this));
        },

        onClearAuditSearch: function () {
            this.byId("auditSearchInput").setValue("");
            this.getView().getModel("audit").setProperty("/mainLogs", []);
        },

        onViewAuditTrail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("audit");
            var oRowData = oContext.getObject();
            var oLocalModel = this.getView().getModel("audit");

            var sRowId = oRowData.rowId;
            oLocalModel.setProperty("/selectedRowId", sRowId);

            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var aTrailLogs = aAllLogs.filter(function (l) { return l.RecordKey === sRowId; });

            aTrailLogs.sort(function (a, b) {
                return new Date(a.ChangedAt) - new Date(b.ChangedAt);
            });

            var aProcessNodes = [];
            var aProcessLanes = [];

            aTrailLogs.forEach(function (oLog, index) {
                var sAction = oLog.Action === 'C' ? 'CREATE' : (oLog.Action === 'U' ? 'UPDATE' : 'DELETE');

                var sTime = DataFormatter.formatDateTime(oLog.ChangedAt);

                var sLaneId = "lane_" + index;
                aProcessLanes.push({
                    id: sLaneId,
                    icon: sAction === 'CREATE' ? 'sap-icon://add' : (sAction === 'DELETE' ? 'sap-icon://delete' : 'sap-icon://edit'),
                    label: sAction + " (" + sTime + ")",
                    position: index
                });

                var sNodeId = oLog.LogUuid;
                var aChildren = [];
                if (index < aTrailLogs.length - 1) {
                    aChildren.push(aTrailLogs[index + 1].LogUuid);
                }

                var sState = "";
                if (sAction === 'CREATE') {
                    sState = "Positive";
                } else if (sAction === 'DELETE') {
                    sState = "Negative";
                } else if (sAction === 'UPDATE') {
                    sState = "Critical";
                }

                aProcessNodes.push({
                    id: sNodeId,
                    lane: sLaneId,
                    title: "User: " + oLog.ChangedBy,
                    titleAbbreviation: oLog.ChangedBy.substring(0, 2).toUpperCase(),
                    children: aChildren,
                    state: sState,
                    texts: ["Click to view details"]
                });
            });

            oLocalModel.setProperty("/processNodes", aProcessNodes);
            oLocalModel.setProperty("/processLanes", aProcessLanes);

            var oDialog = this.byId("auditTrailDialog");
            oDialog.open();

            var oProcessFlow = this.byId("auditProcessFlow");
            if (oProcessFlow) {
                oProcessFlow.setZoomLevel("One");
                oProcessFlow.updateModel();
            }
        },

        onNodePress: function (oEvent) {
            var oParameters = oEvent.getParameters();
            var sLogId = oParameters.getNodeId();
            var oLocalModel = this.getView().getModel("audit");

            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var oSelectedLog = aAllLogs.find(function (l) { return l.LogUuid === sLogId; });

            if (!oSelectedLog) return;

            var sAction = oSelectedLog.Action === 'C' ? 'CREATE' : (oSelectedLog.Action === 'U' ? 'UPDATE' : 'DELETE');

            var sTime = DataFormatter.formatDateTime(oSelectedLog.ChangedAt);

            var aChanges = [];
            var oOld = {}, oNew = {};
            try { if (oSelectedLog.OldData) oOld = JSON.parse(oSelectedLog.OldData); } catch (e) { }
            try { if (oSelectedLog.NewData) oNew = JSON.parse(oSelectedLog.NewData); } catch (e) { }

            var aAllKeys = Object.keys(oOld).concat(Object.keys(oNew));
            var aUniqueKeys = aAllKeys.filter(function (item, pos) { return aAllKeys.indexOf(item) === pos; });

            aUniqueKeys.forEach(function (sKey) {
                if (sKey.toUpperCase() === 'MANDT') return;

                var sOldVal = oOld.hasOwnProperty(sKey) ? String(oOld[sKey]) : "-";
                var sNewVal = oNew.hasOwnProperty(sKey) ? String(oNew[sKey]) : "-";

                if (sOldVal !== sNewVal) {
                    aChanges.push({
                        field: sKey,
                        oldValue: sOldVal,
                        newValue: sNewVal
                    });
                }
            });

            oLocalModel.setProperty("/selectedNodeChanges", aChanges);
            oLocalModel.setProperty("/selectedNodeAction", sAction);
            oLocalModel.setProperty("/selectedNodeTime", sTime);
            oLocalModel.setProperty("/selectedLogUuid", sLogId);

            this.byId("detailNodeDialog").open();
        },

        onCloseTrailDialog: function () {
            this.byId("auditTrailDialog").close();
        },

        onCloseDetailDialog: function () {
            this.byId("detailNodeDialog").close();
        },

        onRequestRevert: function () {
            var oLocalModel = this.getView().getModel("audit");
            var sLogId = oLocalModel.getProperty("/selectedLogUuid");
            var sTime = oLocalModel.getProperty("/selectedNodeTime");

            var sTableName = this.byId("auditSearchInput").getValue();
            var sRowId = oLocalModel.getProperty("/selectedRowId");

            var sMessage = "You are about to revert the record [ID: " + sRowId + "] to the state at: " + sTime + ".\n\n" +
                "Are you sure you want to create this Request?";

            MessageBox.confirm(sMessage, {
                title: "Confirm Revert Request",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sConfirmAction) {
                    if (sConfirmAction === MessageBox.Action.YES) {
                        this._sendRevertRequestToBackend(sTableName, sRowId, sLogId);
                    }
                }.bind(this)
            });
        },

        _sendRevertRequestToBackend: function (sTableName, sRowId, sLogId) {
            var oView = this.getView();
            var oLocalModel = oView.getModel("audit");
            var oMainModel = oView.getModel();

            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var oOriginalLog = aAllLogs.find(function (l) { return l.LogUuid === sLogId; });

            if (!oOriginalLog || !oOriginalLog.OldData || oOriginalLog.OldData === "") {
                sap.m.MessageBox.error("Không có dữ liệu gốc để khôi phục!");
                return;
            }

            oView.setBusy(true);

            var oOldDataObj = {};
            try {
                oOldDataObj = JSON.parse(oOriginalLog.OldData);
            } catch (e) {
                oView.setBusy(false);
                sap.m.MessageBox.error("Lỗi: Dữ liệu lịch sử bị sai định dạng JSON.");
                return;
            }

            var aDataToSave = [oOldDataObj];
            var sJsonString = JSON.stringify(aDataToSave);

            var sBase64Data = btoa(unescape(encodeURIComponent(sJsonString)));

            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            var oActionContext = oMainModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName.toUpperCase());
            oActionContext.setParameter("json_data", sBase64Data);

            oActionContext.execute().then(function () {
                oView.setBusy(false);
                sap.m.MessageToast.show("Khôi phục thành công! Dữ liệu đã được cập nhật thẳng vào Database.");

                var oDetailDialog = this.byId("detailNodeDialog");
                if (oDetailDialog) oDetailDialog.close();

                var oAuditDialog = this.byId("auditTrailDialog");
                if (oAuditDialog) oAuditDialog.close();

                this.onSearchAuditLog(sTableName);

            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                sap.m.MessageBox.error("Lỗi khi ghi đè Database: " + oError.message);
                console.error(oError);
            }.bind(this));
        }
    });
});