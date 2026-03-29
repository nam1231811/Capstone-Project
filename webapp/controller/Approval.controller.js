sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/models/GetData"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.Approval", {
        onInit: function () {
            var oApprovalModel = new JSONModel({
                isPendingMode: true,
                pendingList: [],
                historyList: [],
                pendingCount: 0,
                historyCount: 0,
                currentDetail: null
            });
            this.getView().setModel(oApprovalModel, "approval");

            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter.getRoute("RouteApproval")) {
                oRouter.getRoute("RouteApproval").attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadApprovalData();
            }
        },

        _onRouteMatched: function () {
            this._loadApprovalData();
        },

        _loadApprovalData: function () {
            var oView = this.getView();
            var oODataModel = this.getOwnerComponent().getModel();
            var oApprovalModel = oView.getModel("approval");

            if (!oODataModel) return;

            oView.setBusy(true);

            var oPendingBinding = oODataModel.bindList("/Data", null, null, [
                new Filter("status", FilterOperator.EQ, "P")
            ]);
            var oHistoryBinding = oODataModel.bindList("/Data", null, null, [
                new Filter("status", FilterOperator.NE, "P")
            ]);

            Promise.all([
                oPendingBinding.requestContexts(0, 100),
                oHistoryBinding.requestContexts(0, 100)
            ]).then(function (aResults) {
                var aPendingContexts = aResults[0];
                var aHistoryContexts = aResults[1];

                var aPendingList = this._formatData(aPendingContexts);
                var aHistoryList = this._formatData(aHistoryContexts);

                oApprovalModel.setProperty("/pendingList", aPendingList);
                oApprovalModel.setProperty("/pendingCount", aPendingList.length);
                oApprovalModel.setProperty("/historyList", aHistoryList);
                oApprovalModel.setProperty("/historyCount", aHistoryList.length);

                oView.setBusy(false);
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                MessageBox.error("Error loading data: " + oError.message);
            });
        },

        _formatData: function (aContexts) {
            return aContexts.map(function (oContext) {
                var oData = oContext.getObject();

                var sActionCode = oData.action_type || oData.ActionType || "";
                var sActionText = sActionCode;
                if (sActionCode === "C") sActionText = "CREATE";
                else if (sActionCode === "U") sActionText = "UPDATE";
                else if (sActionCode === "D") sActionText = "DELETE";

                var sStatusCode = oData.status || oData.Status || "";
                var sStatusText = "PENDING";
                if (sStatusCode === "A") sStatusText = "APPROVED";
                else if (sStatusCode === "R") sStatusText = "REJECTED";

                var aDiff = [];
                var sRawData = oData.data || oData.Data;

                if (sRawData) {
                    try {
                        var oParsed;
                        if (!sRawData.startsWith("{") && !sRawData.startsWith("[")) {
                            oParsed = GetData.decodeFunction({ json_string: sRawData }); 
                        } else {
                            oParsed = JSON.parse(sRawData);
                        }

                        Object.keys(oParsed).forEach(function (key) {
                            aDiff.push({
                                field: key,
                                oldData: sActionCode === "C" ? "-" : "Loading...", 
                                newData: oParsed[key]
                            });
                        });
                    } catch (e) {
                        console.error("Error parsing JSON approval data", e);
                    }
                }

                return {
                    _odataContext: oContext,
                    reqId: oData.uuid || oData.Uuid,
                    tableName: oData.table_name || oData.TableName || "",
                    action: sActionText,
                    status: sStatusText,
                    requestedBy: oData.created_by || oData.CreatedBy || "USER",
                    requestedAt: oData.created_at || oData.CreatedAt || "",
                    processedBy: oData.changed_by || oData.ChangedBy || "",
                    processedAt: oData.changed_at || oData.ChangedAt || "",
                    diff: aDiff
                };
            });
        },

        onToggleMode: function() {
            var oModel = this.getView().getModel("approval");
            var bCurrentMode = oModel.getProperty("/isPendingMode");
            
            oModel.setProperty("/isPendingMode", !bCurrentMode);
            this.byId("actionFilterBar").setSelectedKey("ALL");
            this.onActionFilterSelect(); 
        },

        onActionFilterSelect: function (oEvent) {
            var sKey = this.byId("actionFilterBar").getSelectedKey();
            var bIsPending = this.getView().getModel("approval").getProperty("/isPendingMode");
            var sTableId = bIsPending ? "pendingTable" : "historyTable";
            var oTable = this.byId(sTableId);
            var oBinding = oTable.getBinding("items");

            if (sKey === "ALL") {
                oBinding.filter([]);
            } else {
                oBinding.filter([new Filter("action", FilterOperator.EQ, sKey)]);
            }
        },

        onViewDiffDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("approval");
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("approval");
            
            oModel.setProperty("/currentDetail", oRowData);

            if (!this._oDiffDialog) {
                this._oDiffDialog = new sap.m.Dialog({
                    title: "Approval Detail",
                    contentWidth: "800px",
                    resizable: true,
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.HBox({
                                    justifyContent: "SpaceBetween",
                                    class: "sapUiMediumMarginBottom",
                                    items: [
                                        new sap.m.Label({ text: "Data Table: {approval>/currentDetail/tableName}", design: "Bold" }),
                                        new sap.m.ObjectStatus({
                                            text: "{approval>/currentDetail/action}",
                                            state: "{= ${approval>/currentDetail/action} === 'CREATE' ? 'Success' : (${approval>/currentDetail/action} === 'DELETE' ? 'Error' : 'Warning') }"
                                        })
                                    ]
                                }),
                                
                                new sap.m.Table({
                                    backgroundDesign: "Solid",
                                    items: {
                                        path: "approval>/currentDetail/diff",
                                        template: new sap.m.ColumnListItem({
                                            cells: [
                                                new sap.m.Text({ text: "{approval>field}", design: "Bold" }),
                                                new sap.m.Text({ text: "{approval>oldData}" }),
                                                new sap.m.ObjectStatus({ 
                                                    text: "{approval>newData}", 
                                                    state: "{= ${approval>oldData} !== ${approval>newData} && ${approval>oldData} !== 'N/A' ? 'Warning' : 'Success' }",
                                                    icon: "{= ${approval>oldData} !== ${approval>newData} && ${approval>oldData} !== 'N/A' ? 'sap-icon://edit' : 'sap-icon://sys-enter-2' }"
                                                })
                                            ]
                                        })
                                    },
                                    columns: [
                                        new sap.m.Column({ header: new sap.m.Label({ text: "Field", design: "Bold" }) }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: "Old Data", design: "Bold" }) }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: "New Data", design: "Bold" }) })
                                    ]
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Approve",
                        type: "Accept",
                        icon: "sap-icon://accept",
                        press: this.onApproveRequest.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Reject",
                        type: "Reject",
                        icon: "sap-icon://decline",
                        press: this.onRejectRequest.bind(this)
                    }),
                    customHeader: new sap.m.Toolbar({
                        content: [
                            new sap.m.Title({ text: "Check Data" }),
                            new sap.m.ToolbarSpacer(),
                            new sap.m.Button({ icon: "sap-icon://decline", press: function() { this._oDiffDialog.close(); }.bind(this) })
                        ]
                    })
                });
                this.getView().addDependent(this._oDiffDialog);
            }

            this._oDiffDialog.open();

            if (oRowData.action === "CREATE") return;

            this._oDiffDialog.setBusy(true);

            var oODataModel = this.getOwnerComponent().getModel();
            GetData.loadMeta(oODataModel, oRowData.tableName, "", "E").then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [];
                
                var oNewDataMapped = {};
                oRowData.diff.forEach(function(d) { oNewDataMapped[d.field] = d.newData; });

                var oOldRow = aMasterData.find(function(row) {
                    var oJson = JSON.parse(row.data || "{}");
                    if (oNewDataMapped.ID && String(oJson.ID) === String(oNewDataMapped.ID)) return true;
                    if (oNewDataMapped.UUID && String(oJson.UUID) === String(oNewDataMapped.UUID)) return true;
                    if (oNewDataMapped.CODE && String(oJson.CODE) === String(oNewDataMapped.CODE)) return true;
                    return false;
                });

                var aUpdatedDiff = oRowData.diff.map(function(d) {
                    var sOldValue = "N/A";
                    if (oOldRow) {
                        var oOldJson = JSON.parse(oOldRow.data || "{}");
                        sOldValue = oOldJson[d.field] !== undefined ? String(oOldJson[d.field]) : "N/A";
                    }
                    return {
                        field: d.field,
                        oldData: sOldValue,
                        newData: String(d.newData)
                    };
                });

                oModel.setProperty("/currentDetail/diff", aUpdatedDiff);
                this._oDiffDialog.setBusy(false);

            }.bind(this)).catch(function(e) {
                console.error("Error loading master data:", e);
                this._oDiffDialog.setBusy(false);
            }.bind(this));
        },

        onApproveRequest: function () {
            this._processRequest("APPROVED");
        },

        onRejectRequest: function () {
            this._processRequest("REJECTED");
        },

        _processRequest: function (sStatus) {
            var oView = this.getView();
            var oModel = oView.getModel("approval");
            var oCurrentReq = oModel.getProperty("/currentDetail");

            var oODataModel = this.getOwnerComponent().getModel();
            if (!oODataModel) return;

            var oODataContext = oCurrentReq._odataContext;
            if (!oODataContext) {
                MessageBox.error("Error connecting to data source!");
                return;
            }

            var sActionName = (sStatus === "APPROVED") ? "approve" : "reject";

            var sActionPath = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001." + sActionName + "(...)";
            var oActionContext = oODataModel.bindContext(sActionPath, oODataContext);

            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show(sStatus === "APPROVED" ? "Approved!" : "Rejected!");

                this._oDiffDialog.close();
                this._loadApprovalData();

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Error processing Request: " + oError.message);
                console.error(oError);
            });
        }
    });
});