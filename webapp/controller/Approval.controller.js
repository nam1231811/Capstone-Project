sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/models/GetData",
    "zapp/utils/DataFormatter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, GetData, DataFormatter) { 
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
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel.getProperty("/isManager");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (!bIsManager && !bIsAdmin) {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
                return;
            }

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
            
            var oAuditModel = this.getOwnerComponent().getModel("auditOData");
            var oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aPendingList = this._formatData(aResults[0], true);
                var aHistoryList = this._formatData(aResults[1], false);

                aPendingList.sort(function(a, b) {
                    return new Date(b.rawDataTime) - new Date(a.rawDataTime);
                });
                aPendingList.forEach(function(item, index) { 
                    item.indexNo = index + 1; 
                });

                aHistoryList.sort(function(a, b) {
                    return new Date(b.rawDataTime) - new Date(a.rawDataTime);
                });
                aHistoryList.forEach(function(item, index) { 
                    item.indexNo = index + 1; 
                });

                oApprovalModel.setProperty("/pendingList", aPendingList);
                oApprovalModel.setProperty("/pendingCount", aPendingList.length);
                oApprovalModel.setProperty("/historyList", aHistoryList);
                oApprovalModel.setProperty("/historyCount", aHistoryList.length);

                oView.setBusy(false);
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                sap.m.MessageBox.error("Error loading data");
                console.error(oError);
            });
        },

        _formatData: function (aContexts, bIsPending) {
            return aContexts.map(function (oContext) {
                var oData = oContext.getObject();

                var sActionCode = String(oData.action_type || oData.ActionType || oData.action || oData.Action || "").toUpperCase();
                var sActionText = "UPDATE";
                
                if (sActionCode === "C" || sActionCode === "CREATE") sActionText = "CREATE";
                else if (sActionCode === "D" || sActionCode === "DELETE") sActionText = "DELETE";
                else if (sActionCode === "U" || sActionCode === "UPDATE") sActionText = "UPDATE";

                var sStatusCode = oData.status || oData.Status || "";
                var sStatusText = bIsPending ? "PENDING" : (sStatusCode === "A" ? "APPROVED" : "REJECTED");

                var sRawTime = oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt;

                var sOldDataStr = oData.old_data || oData.OldData || "";
                var sNewDataStr = oData.new_data || oData.NewData || "";

                var sTempData = oData.data || oData.Data || "";
                if (sTempData) {
                    if (sActionText === "DELETE") sOldDataStr = sTempData;
                    else if (sActionText === "CREATE") sNewDataStr = sTempData; 
                    else sNewDataStr = sTempData;
                }

                if (sActionText === "DELETE" && !sOldDataStr && sNewDataStr) {
                    sOldDataStr = sNewDataStr;
                    sNewDataStr = "";          
                }

                if (sActionText === "CREATE" && !sNewDataStr && sOldDataStr) {
                    sNewDataStr = sOldDataStr; 
                    sOldDataStr = "";
                }

                var oParsedOld = {};
                if (sOldDataStr) {
                    try {
                        oParsedOld = (!sOldDataStr.startsWith("{") && !sOldDataStr.startsWith("[")) 
                                    ? GetData.decodeFunction({ json_string: sOldDataStr }) 
                                    : JSON.parse(sOldDataStr);
                    } catch (e) {}
                }

                var oParsedNew = {};
                if (sNewDataStr) {
                    try {
                        oParsedNew = (!sNewDataStr.startsWith("{") && !sNewDataStr.startsWith("[")) 
                                    ? GetData.decodeFunction({ json_string: sNewDataStr }) 
                                    : JSON.parse(sNewDataStr);
                    } catch (e) {}
                }

                var aDiff = [];
                var aAllKeys = Object.keys(oParsedNew);
                Object.keys(oParsedOld).forEach(k => { if (!aAllKeys.includes(k)) aAllKeys.push(k); });

                aAllKeys.forEach(function (key) {
                    var sOldVal = "-";
                    if (sActionText !== "CREATE") {
                        sOldVal = oParsedOld[key] !== undefined ? String(oParsedOld[key]) : "Loading...";
                    }
                    
                    var sNewVal = "-";
                    if (sActionText !== "DELETE") {
                        sNewVal = oParsedNew[key] !== undefined ? String(oParsedNew[key]) : "-";
                    }

                    aDiff.push({ 
                        field: key, 
                        oldData: sOldVal, 
                        newData: sNewVal 
                    });
                });

                return {
                    _odataContext: oContext,
                    reqId: oData.uuid || oData.Uuid || oData.log_uuid || oData.LogUuid,
                    tableName: oData.table_name || oData.TableName || "",
                    action: sActionText,
                    status: sStatusText,
                    requestedBy: oData.created_by || oData.CreatedBy || oData.changed_by || "USER",
                    processedBy: oData.changed_by || oData.ChangedBy || "",
                    rawDataTime: sRawTime,
                    requestedAt: DataFormatter.formatDateTime(oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt),
                    processedAt: DataFormatter.formatDateTime(oData.changed_at || oData.ChangedAt),
                    
                    diff: aDiff
                };
            });
        },
        
        _applyFilters: function() {
            var sActionKey = this.byId("actionFilterBar").getSelectedKey();
            var oSearchField = this.byId("searchRequestedBy");
            var sSearchQuery = oSearchField ? oSearchField.getValue().trim() : "";
            
            var bIsPending = this.getView().getModel("approval").getProperty("/isPendingMode");
            var sTableId = bIsPending ? "pendingTable" : "historyTable";
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            var oBinding = oTable.getBinding("items");
            var aFilters = [];
            
            if (sActionKey && sActionKey !== "ALL") {
                aFilters.push(new Filter("action", FilterOperator.EQ, sActionKey));
            }
            
            if (sSearchQuery) {
                var sSearchTarget = bIsPending ? "requestedBy" : "processedBy";
                aFilters.push(new Filter(sSearchTarget, FilterOperator.Contains, sSearchQuery));
            }
            
            oBinding.filter(aFilters);
        },

        onToggleMode: function() {
            var oModel = this.getView().getModel("approval");
            var bCurrentMode = oModel.getProperty("/isPendingMode");
            
            oModel.setProperty("/isPendingMode", !bCurrentMode);
            
            this.byId("actionFilterBar").setSelectedKey("ALL");
            
            var oSearchField = this.byId("searchRequestedBy");
            if(oSearchField) {
                oSearchField.setValue(""); 
                var sPlaceholder = !bCurrentMode ? "Search requestor..." : "Search approver...";
                oSearchField.setPlaceholder(sPlaceholder);
            }
            
            this._applyFilters(); 
        },

        onActionFilterSelect: function (oEvent) {
            this._applyFilters();
        },

        onSearchUser: function (oEvent) {
            this._applyFilters();
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
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.ObjectHeader({
                                    title: "Target Table: {approval>/currentDetail/tableName}",
                                    icon: "sap-icon://table-view",
                                    responsive: true,
                                    fullScreenOptimized: true,
                                    statuses: [
                                        new sap.m.ObjectStatus({
                                            text: "{approval>/currentDetail/action}",
                                            state: "{= ${approval>/currentDetail/action} === 'CREATE' ? 'Success' : (${approval>/currentDetail/action} === 'DELETE' ? 'Error' : 'Warning') }",
                                            icon: "{= ${approval>/currentDetail/action} === 'CREATE' ? 'sap-icon://add' : (${approval>/currentDetail/action} === 'DELETE' ? 'sap-icon://delete' : 'sap-icon://edit') }",
                                            inverted: true
                                        })
                                    ]
                                }),

                                new sap.m.MessageStrip({
                                    text: "Please review the data differences below before making a decision",
                                    type: "Information",
                                    showIcon: true,
                                    class: "sapUiSmallMargin"
                                }),
                                
                                new sap.m.Table({
                                    backgroundDesign: "Solid",
                                    sticky: ["ColumnHeaders"],
                                    class: "sapUiTinyMargin",
                                    items: {
                                        path: "approval>/currentDetail/diff",
                                        template: new sap.m.ColumnListItem({
                                            cells: [
                                                new sap.m.Text({ text: "{approval>field}", design: "Bold" }),
                                                
                                                new sap.m.ObjectStatus({ 
                                                    text: "{approval>oldData}",
                                                    state: "{= ${approval>/currentDetail/action} === 'DELETE' ? 'Warning' : 'None' }"
                                                }),

                                                new sap.m.ObjectStatus({ 
                                                    text: "{approval>newData}", 
                                                    state: "{= ${approval>/currentDetail/action} === 'DELETE' ? 'None' : (${approval>oldData} !== ${approval>newData} && ${approval>oldData} !== 'N/A' && ${approval>oldData} !== '-' ? 'Warning' : 'Success') }",
                                                    icon: "{= ${approval>/currentDetail/action} === 'DELETE' ? '' : (${approval>oldData} !== ${approval>newData} && ${approval>oldData} !== 'N/A' && ${approval>oldData} !== '-' ? 'sap-icon://edit' : 'sap-icon://sys-enter-2') }"
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
                            new sap.m.Title({ text: "Review Request" }),
                            new sap.m.ToolbarSpacer(),
                            new sap.m.Button({ icon: "sap-icon://decline", type: "Transparent", press: function() { this._oDiffDialog.close(); }.bind(this) })
                        ]
                    })
                });
                this.getView().addDependent(this._oDiffDialog);
            }

            this._oDiffDialog.open();

            if (oRowData.action === "CREATE") return;

            this._oDiffDialog.setBusy(true);

            var oODataModel = this.getOwnerComponent().getModel();
            GetData.loadTableData(oODataModel, oRowData.tableName).then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [];
                var aMeta = oPayload.metadata || oPayload.Meta || [];

                var oNewDataMapped = {};
                oRowData.diff.forEach(function(d) { 
                    oNewDataMapped[d.field] = (oRowData.action === "DELETE") ? d.oldData : d.newData; 
                });

                var aKeyFields = [];
                aMeta.forEach(function(col) {
                    if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true) {
                        aKeyFields.push(col.fieldname || col.fieldName);
                    }
                });

                if (aKeyFields.length === 0) {
                    var oIdCol = aMeta.find(c => (c.fieldname || c.fieldName || "").toUpperCase().includes("ID"));
                    if (oIdCol) aKeyFields.push(oIdCol.fieldname || oIdCol.fieldName);
                }

                var oOldRow = aMasterData.find(function(row) {
                    var oJson = {};
                    try { oJson = JSON.parse(row.data || "{}"); } catch(e) {}
                    
                    if (aKeyFields.length === 0) return false;

                    return aKeyFields.every(function(keyField) {
                        var sVal1 = String(oJson[keyField] || "").trim().toUpperCase();
                        var sVal2 = String(oNewDataMapped[keyField] || "").trim().toUpperCase();
                        return sVal1 === sVal2 && sVal1 !== "";
                    });
                });

                var aUpdatedDiff = oRowData.diff.map(function(d) {
                    var sOldValue = d.oldData;
                    if (oOldRow) {
                        var oOldJson = {};
                        try { oOldJson = JSON.parse(oOldRow.data || "{}"); } catch(e) {}
                        if (oOldJson[d.field] !== undefined) {
                            sOldValue = String(oOldJson[d.field]);
                        }
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
                console.error("Error loading master data for Old Data comparison:", e);
                this._oDiffDialog.setBusy(false);
            }.bind(this));
        },

        onApproveRequest: function () {
            this._processRequest("APPROVED");
        },

        onRejectRequest: function () {
            var oTextArea = new sap.m.TextArea({
                width: "100%",
                placeholder: "Please enter the reason why this request is rejected...", 
                rows: 4
            });

            var oMessageStrip = new sap.m.MessageStrip({
                text: "Rejecting this request will halt the current workflow",
                type: "Warning",
                showIcon: true
            }).addStyleClass("sapUiMediumMarginBottom");

            var oLabel = new sap.m.Label({ 
                text: "Rejection Reason", 
                required: true 
            });

            var oRejectDialog = new sap.m.Dialog({
                title: "Confirm Rejection",
                type: "Message",
                state: "Error",
                content: [
                    new sap.m.VBox({
                        items: [
                            oMessageStrip,
                            oLabel,
                            oTextArea
                        ]
                    }).addStyleClass("sapUiTinyMarginTop")
                ],
                beginButton: new sap.m.Button({
                    type: "Reject",
                    text: "Reject Request", 
                    press: function () {
                        var sReason = oTextArea.getValue().trim();
                        if (!sReason) {
                            sap.m.MessageToast.show("Please enter a reason for rejection!");
                            return;
                        }
                        oRejectDialog.close();
                        this._processRequest("REJECTED", sReason);
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () { oRejectDialog.close(); }
                }),
                afterClose: function () { oRejectDialog.destroy(); }
            });

            oRejectDialog.open();
        },

        _processRequest: function (sStatus, sReason) {
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

            if (sStatus === "REJECTED" && sReason) {
                oActionContext.setParameter("reason", sReason);
            }

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