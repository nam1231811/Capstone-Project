sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/utils/DataFormatter",
    "zapp/api/LoadData"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, DataFormatter, LoadData) { 
    "use strict";

    const PATH_APPROVE = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.approve(...)";
    const PATH_REJECT = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.reject(...)";

    return Controller.extend("zapp.controller.Approval", {
        onInit: function () {
            var oApprovalModel = new JSONModel({
                    isPendingMode: true,
                    pendingList: [],
                    historyList: [],
                    pendingCount: 0,
                    historyCount: 0,
                    currentDetail: null
                }),
                oRouter = this.getOwnerComponent().getRouter();

            this.getView().setModel(oApprovalModel, "approval");

            if (oRouter.getRoute("RouteApproval")) {
                oRouter.getRoute("RouteApproval").attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadApprovalData();
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth"),
                bIsManager = oAuthModel.getProperty("/isManager"),
                bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (!bIsManager && !bIsAdmin) {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
                return;
            }

            this._loadApprovalData();
        },

        _loadApprovalData: function () {
            var oView = this.getView(),
                oODataModel = this.getOwnerComponent().getModel(),
                oApprovalModel = oView.getModel("approval"),
                oAuditModel = this.getOwnerComponent().getModel("auditOData"),
                oPendingBinding, oHistoryBinding;

            if (!oODataModel) return;
            oView.setBusy(true);

            oPendingBinding = oODataModel.bindList("/Data", null, null, [
                new Filter("status", FilterOperator.EQ, "P")
            ]);
            oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aPendingList = this._formatData(aResults[0], true),
                    aHistoryList = this._formatData(aResults[1], false);

                aPendingList.sort((a, b) => new Date(b.rawDataTime) - new Date(a.rawDataTime))
                            .forEach((item, idx) => item.indexNo = idx + 1);

                aHistoryList.sort((a, b) => new Date(b.rawDataTime) - new Date(a.rawDataTime))
                            .forEach((item, idx) => item.indexNo = idx + 1);

                oApprovalModel.setProperty("/pendingList", aPendingList);
                oApprovalModel.setProperty("/pendingCount", aPendingList.length);
                oApprovalModel.setProperty("/historyList", aHistoryList);
                oApprovalModel.setProperty("/historyCount", aHistoryList.length);

                oView.setBusy(false);
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                MessageBox.error("Error loading data");
                console.error(oError);
            });
        },

        _safeParse: function(sDataStr) {
            if (!sDataStr) return {};
            try {
                return (!sDataStr.startsWith("{") && !sDataStr.startsWith("[")) 
                    ? DataFormatter.decodeFunction({ json_string: sDataStr }) 
                    : JSON.parse(sDataStr);
            } catch (e) {
                return {};
            }
        },

        _formatData: function (aContexts, bIsPending) {
            return aContexts.map(function (oContext) {
                var oData = oContext.getObject(),
                    sActionCode = String(oData.action_type || oData.ActionType || oData.action || oData.Action || "").toUpperCase(),
                    sStatusCode = oData.status || oData.Status || "",
                    sRawTime = oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt,
                    sActionText = "UPDATE",
                    sStatusText = bIsPending ? "PENDING" : (sStatusCode === "A" ? "APPROVED" : "REJECTED"),
                    sOldDataStr = oData.old_data || oData.OldData || "",
                    sNewDataStr = oData.new_data || oData.NewData || "",
                    sTempData = oData.data || oData.Data || "",
                    oParsedOld, oParsedNew, aDiff = [], aAllKeys;
                
                if (sActionCode === "C" || sActionCode === "CREATE") sActionText = "CREATE";
                else if (sActionCode === "D" || sActionCode === "DELETE") sActionText = "DELETE";

                if (sTempData) {
                    if (sActionText === "DELETE") sOldDataStr = sTempData;
                    else sNewDataStr = sTempData;
                }

                if (sActionText === "DELETE" && !sOldDataStr && sNewDataStr) {
                    sOldDataStr = sNewDataStr;
                    sNewDataStr = "";          
                } else if (sActionText === "CREATE" && !sNewDataStr && sOldDataStr) {
                    sNewDataStr = sOldDataStr; 
                    sOldDataStr = "";
                }

                oParsedOld = this._safeParse(sOldDataStr);
                oParsedNew = this._safeParse(sNewDataStr);

                aAllKeys = Object.keys(oParsedNew);
                Object.keys(oParsedOld).forEach(k => { if (!aAllKeys.includes(k)) aAllKeys.push(k); });

                aAllKeys.forEach(function (key) {
                    var sOldVal = (sActionText !== "CREATE" && oParsedOld[key] !== undefined) ? String(oParsedOld[key]) : (sActionText === "CREATE" ? "-" : "Loading..."),
                        sNewVal = (sActionText !== "DELETE" && oParsedNew[key] !== undefined) ? String(oParsedNew[key]) : "-";

                    aDiff.push({ field: key, oldData: sOldVal, newData: sNewVal });
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
            }.bind(this));
        },
        
        _applyFilters: function() {
            var sActionKey = this.byId("actionFilterBar").getSelectedKey(),
                oSearchField = this.byId("searchRequestedBy"),
                sSearchQuery = oSearchField ? oSearchField.getValue().trim() : "",
                bIsPending = this.getView().getModel("approval").getProperty("/isPendingMode"),
                sTableId = bIsPending ? "pendingTable" : "historyTable",
                oTable = this.byId(sTableId),
                oBinding, aFilters = [];

            if (!oTable) return;
            oBinding = oTable.getBinding("items");
            
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
            var oModel = this.getView().getModel("approval"),
                bCurrentMode = oModel.getProperty("/isPendingMode"),
                oSearchField = this.byId("searchRequestedBy");
            
            oModel.setProperty("/isPendingMode", !bCurrentMode);
            this.byId("actionFilterBar").setSelectedKey("ALL");
            
            if (oSearchField) {
                oSearchField.setValue(""); 
                oSearchField.setPlaceholder(!bCurrentMode ? "Search requestor..." : "Search approver...");
            }
            this._applyFilters(); 
        },

        onActionFilterSelect: function () {
            this._applyFilters();
        },

        onSearchUser: function () {
            this._applyFilters();
        },

        onViewDiffDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("approval"),
                oRowData = oContext.getObject(),
                oModel = this.getView().getModel("approval"),
                oODataModel = this.getOwnerComponent().getModel();

            oModel.setProperty("/currentDetail", oRowData);
            this._oDiffDialog = this.byId("diffDialog");
            this._oDiffDialog.open();

            if (oRowData.action === "CREATE") return;

            this._oDiffDialog.setBusy(true);

            LoadData.loadTableData(oODataModel, oRowData.tableName).then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [],
                    aMeta = oPayload.metadata || oPayload.Meta || [],
                    oNewDataMapped = {},
                    aKeyFields = [],
                    oOldRow, aUpdatedDiff, oIdCol;

                oRowData.diff.forEach(d => oNewDataMapped[d.field] = (oRowData.action === "DELETE") ? d.oldData : d.newData);

                aMeta.forEach(function(col) {
                    if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true) {
                        aKeyFields.push(col.fieldname || col.fieldName);
                    }
                });

                if (aKeyFields.length === 0) {
                    oIdCol = aMeta.find(c => (c.fieldname || c.fieldName || "").toUpperCase().includes("ID"));
                    if (oIdCol) aKeyFields.push(oIdCol.fieldname || oIdCol.fieldName);
                }

                oOldRow = aMasterData.find(function(row) {
                    var oJson = {};
                    try { oJson = JSON.parse(row.data || "{}"); } catch(e) {}
                    if (aKeyFields.length === 0) return false;

                    return aKeyFields.every(function(keyField) {
                        var sVal1 = String(oJson[keyField] || "").trim().toUpperCase(),
                            sVal2 = String(oNewDataMapped[keyField] || "").trim().toUpperCase();
                        return sVal1 === sVal2 && sVal1 !== "";
                    });
                });

                aUpdatedDiff = oRowData.diff.map(function(d) {
                    var sOldValue = d.oldData,
                        oOldJson = {};
                    if (oOldRow) {
                        try { oOldJson = JSON.parse(oOldRow.data || "{}"); } catch(e) {}
                        if (oOldJson[d.field] !== undefined) sOldValue = String(oOldJson[d.field]);
                    }
                    return { field: d.field, oldData: sOldValue, newData: String(d.newData) };
                });

                oModel.setProperty("/currentDetail/diff", aUpdatedDiff);
                this._oDiffDialog.setBusy(false);

            }.bind(this)).catch(function(e) {
                console.error("Error loading master data for Old Data comparison:", e);
                this._oDiffDialog.setBusy(false);
            }.bind(this));
        },

        onCloseDiffDialog: function() {
            if (this._oDiffDialog) {
                this._oDiffDialog.close();
            }
        },

        onApproveRequest: function () {
            this._processRequest("APPROVED");
        },

        onRejectRequest: function () {
            var oRejectDialog = this.byId("rejectDialog"),
                oTextArea = this.byId("rejectReasonInput");

            if (oTextArea) {
                oTextArea.setValue("");
            }
            oRejectDialog.open();
        },

        onConfirmReject: function () {
            var oTextArea = this.byId("rejectReasonInput"),
                sReason = oTextArea ? oTextArea.getValue().trim() : "";

            if (!sReason) {
                MessageToast.show("Please enter a reason for rejection!");
                return;
            }

            this.byId("rejectDialog").close();
            this._processRequest("REJECTED", sReason);
        },

        onCancelReject: function () {
            this.byId("rejectDialog").close();
        },

        _processRequest: function (sStatus, sReason) {
            var oView = this.getView(),
                oModel = oView.getModel("approval"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                oODataModel = this.getOwnerComponent().getModel(),
                oODataContext = oCurrentReq ? oCurrentReq._odataContext : null,
                sActionPath, oActionContext;

            if (!oODataModel) return;

            if (!oODataContext) {
                MessageBox.error("Error connecting to data source!");
                return;
            }

            sActionPath = (sStatus === "APPROVED") ? PATH_APPROVE : PATH_REJECT;
            oActionContext = oODataModel.bindContext(sActionPath, oODataContext);

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