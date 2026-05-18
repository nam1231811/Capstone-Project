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
    const PATH_MASS_APPROVE = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.massApprove(...)";
    const PATH_LOCK = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.lockRequest(...)";
    const PATH_UNLOCK = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.unlockRequest(...)";

    return Controller.extend("zapp.controller.Approval", {

        onInit: function () {
            var oApprovalModel = new JSONModel({
                    isPendingMode: true,
                    pendingList: [],
                    historyList: [],
                    pendingCount: 0,
                    historyCount: 0,
                    currentDetail: null,
                    searchQuery: ""
                }),
                oRouter = this.getOwnerComponent().getRouter();

            this.getView().setModel(oApprovalModel, "approval");
            this._reviewTimerId = null;

            if (oRouter.getRoute("RouteApproval")) {
                oRouter.getRoute("RouteApproval").attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadApprovalData();
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            if (!oAuthModel.getProperty("/isManager") && !oAuthModel.getProperty("/isAdmin")) {
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

            oPendingBinding = oODataModel.bindList("/Data", null, null, [new Filter("status", FilterOperator.EQ, "P")]);
            oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aPendingCtx = aResults[0] || [],
                    aHistoryCtx = aResults[1] || [],
                    aPendingList = this._formatData(aPendingCtx, true),
                    aHistoryList = this._formatData(aHistoryCtx, false);

                aPendingList.sort(function(a, b) { return new Date(b.rawDataTime) - new Date(a.rawDataTime); });
                aPendingList.forEach(function(item, idx) { item.indexNo = idx + 1; });

                aHistoryList.sort(function(a, b) { return new Date(b.rawDataTime) - new Date(a.rawDataTime); });
                aHistoryList.forEach(function(item, idx) { item.indexNo = idx + 1; });

                oApprovalModel.setProperty("/pendingList", aPendingList);
                oApprovalModel.setProperty("/pendingCount", aPendingList.length);
                oApprovalModel.setProperty("/historyList", aHistoryList);
                oApprovalModel.setProperty("/historyCount", aHistoryList.length);

                this._applyFilters();
                oView.setBusy(false);

            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                MessageBox.error("Error loading data: " + oError.message);
            });
        },

        _formatData: function (aContexts, bIsPending) {
            var aFormattedList = [];
            aContexts.forEach(function (oContext) {
                var oData = oContext.getObject(),
                    sActionCode = String(oData.action_type || oData.ActionType || oData.action || oData.Action || "").toUpperCase(),
                    sStatusCode = oData.status || oData.Status || "",
                    sRawTime = oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt,
                    sActionText = "UPDATE",
                    sStatusText = bIsPending ? "PENDING" : (sStatusCode === "A" ? "APPROVED" : "REJECTED"),
                    sOldDataStr = oData.old_data || oData.OldData || "",
                    sNewDataStr = oData.new_data || oData.NewData || "",
                    sTempData = oData.data || oData.Data || "",
                    oParsedOld = {}, oParsedNew = {}, aAllKeys = [], aDiff = [];

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
                
                Object.keys(oParsedNew).forEach(function(key) { aAllKeys.push(key); });
                Object.keys(oParsedOld).forEach(function(key) {
                    if (aAllKeys.indexOf(key) === -1) aAllKeys.push(key);
                });

                aAllKeys.forEach(function (key) {
                    var sOldVal = "-", sNewVal = "-";
                    if (sActionText !== "CREATE" && oParsedOld[key] !== undefined) sOldVal = String(oParsedOld[key]);
                    if (sActionText !== "DELETE" && oParsedNew[key] !== undefined) sNewVal = String(oParsedNew[key]);
                    aDiff.push({ field: key, oldData: sOldVal, newData: sNewVal });
                });

                aFormattedList.push({
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
                });
            }.bind(this));

            return aFormattedList;
        },

        _safeParse: function(sDataStr) {
            if (!sDataStr) return {};
            try {
                return (!sDataStr.startsWith("{") && !sDataStr.startsWith("["))
                    ? DataFormatter.decodeFunction({ json_string: sDataStr })
                    : JSON.parse(sDataStr);
            } catch (e) { return {}; }
        },
        
        onToggleMode: function() {
            var oModel = this.getView().getModel("approval"),
                bCurrentMode = oModel.getProperty("/isPendingMode");
            
            oModel.setProperty("/isPendingMode", !bCurrentMode);
            this.byId("pendingTable").removeSelections(true);
            this._applyFilters();
        },

        onActionFilterSelect: function () { 
            this._applyFilters(); 
        },

        onSearchTable: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            this.getView().getModel("approval").setProperty("/searchQuery", sQuery);
            this._applyFilters();
        },

        _applyFilters: function() {
            var oModel = this.getView().getModel("approval"),
                sActionKey = this.byId("actionFilterBar").getSelectedKey(),
                bIsPending = oModel.getProperty("/isPendingMode"),
                sQuery = oModel.getProperty("/searchQuery"),
                sTableId = bIsPending ? "pendingTable" : "historyTable",
                oTable = this.byId(sTableId),
                oBinding,
                aFinalFilters = [];
            
            if (!oTable) return;
            oBinding = oTable.getBinding("items");

            if (sActionKey && sActionKey !== "ALL") {
                aFinalFilters.push(new Filter("action", FilterOperator.EQ, sActionKey));
            }

            if (sQuery && sQuery.trim() !== "") {
                aFinalFilters.push(new Filter("tableName", FilterOperator.Contains, sQuery.trim()));
            }
            
            oBinding.filter(aFinalFilters);
        },

        onViewDiffDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("approval"),
                oRowData = oContext.getObject(),
                oModel = this.getView().getModel("approval"),
                oODataModel = this.getOwnerComponent().getModel();

            if (!oModel.getProperty("/isPendingMode")) {
                this._openDiffDialog(oRowData, oODataModel, oModel);
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            var oLockContext = oODataModel.bindContext(PATH_LOCK, oRowData._odataContext);

            oLockContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                this._openDiffDialog(oRowData, oODataModel, oModel);
                this._startReviewTimer();

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                var sErrorMsg = "This request is currently being reviewed by someone else";
                var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                if (aMessages && aMessages.length > 0) {
                    var aErrors = aMessages.filter(function (m) { return m.type === "Error"; });
                    if (aErrors.length > 0) {
                        sErrorMsg = aErrors[aErrors.length - 1].message; 
                    }
                }
                MessageBox.error(sErrorMsg);
                sap.ui.getCore().getMessageManager().removeAllMessages(); 
            });
        },

        _startReviewTimer: function() {
            this._clearReviewTimer();

            this._reviewTimerId = setTimeout(function() {
                MessageBox.warning("Your 5-minute review session has expired.\nThe lock has been released automatically for other managers.", {
                    title: "Session Expired"
                });
                this.onCloseDiffDialog();
            }.bind(this), 300000);
        },

        _clearReviewTimer: function() {
            if (this._reviewTimerId) {
                clearTimeout(this._reviewTimerId);
                this._reviewTimerId = null;
            }
        },

        _openDiffDialog: function(oRowData, oODataModel, oModel) {
            oModel.setProperty("/currentDetail", oRowData);
            this._oDiffDialog = this.byId("diffDialog");
            this._oDiffDialog.open();

            if (oRowData.action === "CREATE") {
                return;
            }

            this._oDiffDialog.setBusy(true);

            LoadData.loadTableData(oODataModel, oRowData.tableName).then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [],
                    aMeta = oPayload.metadata || oPayload.Meta || [],
                    oNewDataMapped = {}, aKeyFields = [], oIdCol = null,
                    oOldRow = null, aUpdatedDiff = [],
                    i, j, row, oJson, bIsMatch, keyField, sVal1, sVal2, sOldValue, oOldJson;

                oRowData.diff.forEach(function(d) {
                    oNewDataMapped[d.field] = (oRowData.action === "DELETE") ? d.oldData : d.newData;
                });

                aMeta.forEach(function(col) {
                    if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true) {
                        aKeyFields.push(col.fieldname || col.fieldName);
                    }
                });

                if (aKeyFields.length === 0) {
                    aMeta.forEach(function(c) {
                        var sFieldName = c.fieldname || c.fieldName || "";
                        if (sFieldName.toUpperCase().indexOf("ID") !== -1) oIdCol = c;
                    });
                    if (oIdCol) aKeyFields.push(oIdCol.fieldname || oIdCol.fieldName);
                }

                for (i = 0; i < aMasterData.length; i++) {
                    row = aMasterData[i];
                    oJson = {};
                    try { oJson = JSON.parse(row.data || "{}"); } catch(e) {}
                    
                    if (aKeyFields.length === 0) continue;
                    bIsMatch = true;
                    for (j = 0; j < aKeyFields.length; j++) {
                        keyField = aKeyFields[j];
                        sVal1 = String(oJson[keyField] || "").trim().toUpperCase();
                        sVal2 = String(oNewDataMapped[keyField] || "").trim().toUpperCase();
                        if (sVal1 !== sVal2 || sVal1 === "") {
                            bIsMatch = false; break;
                        }
                    }
                    if (bIsMatch) { oOldRow = row; break; }
                }

                oRowData.diff.forEach(function(d) {
                    sOldValue = d.oldData;
                    oOldJson = {};
                    if (oOldRow) {
                        try { oOldJson = JSON.parse(oOldRow.data || "{}"); } catch(e) {}
                        if (oOldJson[d.field] !== undefined) sOldValue = String(oOldJson[d.field]);
                    }
                    aUpdatedDiff.push({ field: d.field, oldData: sOldValue, newData: String(d.newData) });
                });

                oModel.setProperty("/currentDetail/diff", aUpdatedDiff);
                this._oDiffDialog.setBusy(false);

            }.bind(this)).catch(function(e) {
                this._oDiffDialog.setBusy(false);
                console.error("Error loading data:", e);
            }.bind(this));
        },

        onCloseDiffDialog: function() {
            var oModel = this.getView().getModel("approval"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                oODataModel = this.getOwnerComponent().getModel();

            this._clearReviewTimer();

            if (this._oDiffDialog) {
                this._oDiffDialog.close();
            }

            if (oModel.getProperty("/isPendingMode") && oCurrentReq && oCurrentReq._odataContext) {
                var oUnlockContext = oODataModel.bindContext(PATH_UNLOCK, oCurrentReq._odataContext);
                oUnlockContext.execute().catch(function(e) {
                    console.warn("Fail to unlock request", e);
                });
            }

            oModel.setProperty("/currentDetail", null);
        },

        onApproveRequest: function () { 
            this._processRequest("APPROVED"); 
        },

        _processRequest: function (sStatus, sReason) {
            var oView = this.getView(),
                oModel = oView.getModel("approval"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                oODataModel = this.getOwnerComponent().getModel(),
                oODataContext = oCurrentReq ? oCurrentReq._odataContext : null,
                sActionPath = (sStatus === "APPROVED") ? PATH_APPROVE : PATH_REJECT,
                oActionContext;

            if (!oODataModel || !oODataContext) {
                MessageBox.error("Error connecting to data source");
                return;
            }

            oActionContext = oODataModel.bindContext(sActionPath, oODataContext);
            if (sStatus === "REJECTED" && sReason) oActionContext.setParameter("reason", sReason);

            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show(sStatus === "APPROVED" ? "Approved!" : "Rejected!");
                this._clearReviewTimer();
                oModel.setProperty("/currentDetail", null);
                this._oDiffDialog.close();
                this._loadApprovalData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Error processing request: " + oError.message);
                console.error(oError);
            });
        },

        onRejectRequest: function () {
            var oTextArea = this.byId("rejectReasonInput");
            if (oTextArea) oTextArea.setValue("");
            this.byId("rejectDialog").open();
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

        onMassApprove: function() {
            var oTable = this.byId("pendingTable"),
                aSelectedItems = oTable ? oTable.getSelectedItems() : [],
                iCount = aSelectedItems.length;

            if (iCount === 0) {
                MessageToast.show("Please select at least one request to approve");
                return;
            }

            MessageBox.confirm("Are you sure you want to approve " + iCount + " selected requests?", {
                title: "Confirm Mass Approval",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sConfirmAction) {
                    if (sConfirmAction === MessageBox.Action.YES) {
                        
                        var aUuids = [],
                            sUuidsJson = "",
                            oODataModel = this.getOwnerComponent().getModel(),
                            oActionContext = oODataModel.bindContext(PATH_MASS_APPROVE);

                        aSelectedItems.forEach(function(oItem) {
                            var oRowData = oItem.getBindingContext("approval").getObject();
                            aUuids.push(oRowData.reqId);
                        });

                        sUuidsJson = JSON.stringify(aUuids);
                        oActionContext.setParameter("uuids_json", sUuidsJson);

                        sap.ui.core.BusyIndicator.show(0);
                        sap.ui.getCore().getMessageManager().removeAllMessages();

                        oActionContext.execute().then(function () {
                            sap.ui.core.BusyIndicator.hide();

                            var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                            var aIssues = aMessages.filter(function (m) { 
                                return m.type === sap.ui.core.MessageType.Error || m.type === sap.ui.core.MessageType.Warning; 
                            });

                            if (aIssues.length > 0) {
                                var sIssueText = "Partial Success! Some requests were skipped because they are locked:\n\n";
                                var aUniqueMsgs = [...new Set(aIssues.map(item => item.message))];
                                aUniqueMsgs.forEach(function(msg) {
                                    sIssueText += "- " + msg + "\n";
                                });
                                MessageBox.warning(sIssueText);
                            } else {
                                var oResult = oActionContext.getBoundContext().getObject();
                                MessageToast.show(oResult.message || "All selected requests approved!");
                            }

                            oTable.removeSelections(true);
                            this._loadApprovalData();

                        }.bind(this)).catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.error("Failed to approve requests: " + oError.message);
                            console.error(oError);
                        });
                    }
                }.bind(this)
            });
        }
    });
});