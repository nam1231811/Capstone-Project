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

    return Controller.extend("zapp.controller.Approval", {
        onInit: function () {
            var oApprovalModel = new JSONModel({
                    isPendingMode: true,
                    pendingList: [],
                    historyList: [],
                    pendingCount: 0,
                    historyCount: 0,
                    currentDetail: null,
                    uniqueTables: [],
                    uniqueRequesters: [],
                    uniqueApprovers: []
                }),
                oRouter = this.getOwnerComponent().getRouter();

            this._oColumnFilters = {
                table: null,
                requester: null,
                approver: null
            };

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
                var aPendingCtx = aResults[0] || [],
                    aHistoryCtx = aResults[1] || [],
                    aPendingList = this._formatData(aPendingCtx, true),
                    aHistoryList = this._formatData(aHistoryCtx, false);

                aPendingList.sort((a, b) => new Date(b.rawDataTime) - new Date(a.rawDataTime))
                            .forEach((item, idx) => item.indexNo = idx + 1);

                aHistoryList.sort((a, b) => new Date(b.rawDataTime) - new Date(a.rawDataTime))
                            .forEach((item, idx) => item.indexNo = idx + 1);

                oApprovalModel.setProperty("/pendingList", aPendingList);
                oApprovalModel.setProperty("/pendingCount", aPendingList.length);
                oApprovalModel.setProperty("/historyList", aHistoryList);
                oApprovalModel.setProperty("/historyCount", aHistoryList.length);

                var aAllTables = [...new Set([...aPendingList, ...aHistoryList].map(i => i.tableName))].map(t => ({tableName: t}));
                var aAllRequesters = [...new Set(aPendingList.map(i => i.requestedBy))].map(u => ({userName: u}));
                var aAllApprovers = [...new Set(aHistoryList.map(i => i.processedBy))].map(u => ({userName: u}));

                oApprovalModel.setProperty("/uniqueTables", aAllTables);
                oApprovalModel.setProperty("/uniqueRequesters", aAllRequesters);
                oApprovalModel.setProperty("/uniqueApprovers", aAllApprovers);

                this._applyFilters();

                oView.setBusy(false);
            }.bind(this)).catch(function (oError) {
                oView.setBusy(false);
                MessageBox.error("Error loading data: " + oError.message);
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
                    var sOldVal = (sActionText !== "CREATE" && oParsedOld[key] !== undefined) ? String(oParsedOld[key]) : (sActionText === "CREATE" ? "-" : "-"),
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

        onActionFilterSelect: function () { this._applyFilters(); },

        onOpenTableFilter: function (oEvent) { this.byId("tableFilterPopover").openBy(oEvent.getSource()); },
       
        onApplyTableFilter: function () {
            var aSelected = this.byId("tableFilterList").getSelectedItems();
            if (aSelected.length > 0) {
                var aFilters = aSelected.map(i => new Filter("tableName", FilterOperator.EQ, i.getBindingContext("approval").getProperty("tableName")));
                this._oColumnFilters.table = new Filter({ filters: aFilters, and: false });
            } else {
                this._oColumnFilters.table = null;
            }
            this._applyFilters();
            this.byId("tableFilterPopover").close();
        },

        onClearTableFilter: function () {
            this.byId("tableFilterList").removeSelections(true);
            this._oColumnFilters.table = null;
            this._applyFilters();
            this.byId("tableFilterPopover").close();
        },

        onOpenRequesterFilter: function (oEvent) { this.byId("requesterFilterPopover").openBy(oEvent.getSource()); },

        onApplyRequesterFilter: function () {
            var aSelected = this.byId("requesterFilterList").getSelectedItems();
            if (aSelected.length > 0) {
                var aFilters = aSelected.map(i => new Filter("requestedBy", FilterOperator.EQ, i.getBindingContext("approval").getProperty("userName")));
                this._oColumnFilters.requester = new Filter({ filters: aFilters, and: false });
            } else {
                this._oColumnFilters.requester = null;
            }
            this._applyFilters();
            this.byId("requesterFilterPopover").close();
        },

        onClearRequesterFilter: function () {
            this.byId("requesterFilterList").removeSelections(true);
            this._oColumnFilters.requester = null;
            this._applyFilters();
            this.byId("requesterFilterPopover").close();
        },

        onOpenApproverFilter: function (oEvent) { this.byId("approverFilterPopover").openBy(oEvent.getSource()); },

        onApplyApproverFilter: function () {
            var aSelected = this.byId("approverFilterList").getSelectedItems();
            if (aSelected.length > 0) {
                var aFilters = aSelected.map(i => new Filter("processedBy", FilterOperator.EQ, i.getBindingContext("approval").getProperty("userName")));
                this._oColumnFilters.approver = new Filter({ filters: aFilters, and: false });
            } else {
                this._oColumnFilters.approver = null;
            }
            this._applyFilters();
            this.byId("approverFilterPopover").close();
        },

        onClearApproverFilter: function () {
            this.byId("approverFilterList").removeSelections(true);
            this._oColumnFilters.approver = null;
            this._applyFilters();
            this.byId("approverFilterPopover").close();
        },

        _applyFilters: function() {
            var sActionKey = this.byId("actionFilterBar").getSelectedKey(),
                bIsPending = this.getView().getModel("approval").getProperty("/isPendingMode"),
                sTableId = bIsPending ? "pendingTable" : "historyTable",
                oTable = this.byId(sTableId),
                oBinding, aFinalFilters = [];

            if (!oTable) return;
            oBinding = oTable.getBinding("items");

            if (sActionKey && sActionKey !== "ALL") {
                aFinalFilters.push(new Filter("action", FilterOperator.EQ, sActionKey));
            }
            if (this._oColumnFilters.table) aFinalFilters.push(this._oColumnFilters.table);
            if (bIsPending && this._oColumnFilters.requester) aFinalFilters.push(this._oColumnFilters.requester);
            if (!bIsPending && this._oColumnFilters.approver) aFinalFilters.push(this._oColumnFilters.approver);
           
            oBinding.filter(aFinalFilters);
        },

        onToggleMode: function() {
            var oModel = this.getView().getModel("approval"),
                bCurrentMode = oModel.getProperty("/isPendingMode");
           
            oModel.setProperty("/isPendingMode", !bCurrentMode);
            this.byId("pendingTable").removeSelections(true);
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
            if (this._oDiffDialog) this._oDiffDialog.close();
        },

        onApproveRequest: function () { this._processRequest("APPROVED"); },

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

        onCancelReject: function () { this.byId("rejectDialog").close(); },

        _processRequest: function (sStatus, sReason) {
            var oView = this.getView(),
                oModel = oView.getModel("approval"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                oODataModel = this.getOwnerComponent().getModel(),
                oODataContext = oCurrentReq ? oCurrentReq._odataContext : null,
                sActionPath = (sStatus === "APPROVED") ? PATH_APPROVE : PATH_REJECT,
                oActionContext;

            if (!oODataModel || !oODataContext) {
                MessageBox.error("Error connecting to data source!");
                return;
            }

            oActionContext = oODataModel.bindContext(sActionPath, oODataContext);
            if (sStatus === "REJECTED" && sReason) oActionContext.setParameter("reason", sReason);

            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show(sStatus === "APPROVED" ? "Approved!" : "Rejected!");
                this._oDiffDialog.close();
                this._loadApprovalData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Error processing Request: " + oError.message);
            });
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
                       
                        var aUuids = aSelectedItems.map(oItem => oItem.getBindingContext("approval").getObject().reqId),
                            oActionContext = this.getOwnerComponent().getModel().bindContext(PATH_MASS_APPROVE);
                       
                        oActionContext.setParameter("uuids_json", JSON.stringify(aUuids));

                        sap.ui.core.BusyIndicator.show(0);

                        oActionContext.execute().then(function () {
                            var oResult = oActionContext.getBoundContext().getObject();
                            sap.ui.core.BusyIndicator.hide();
                           
                            MessageToast.show(oResult.message || "Approved!");
                           
                            oTable.removeSelections(true);
                            this._loadApprovalData();

                        }.bind(this)).catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.error("Failed to approve requests: " + oError.message);
                        });
                    }
                }.bind(this)
            });
        }
    });
});