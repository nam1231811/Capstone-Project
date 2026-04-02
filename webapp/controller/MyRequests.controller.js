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

    return Controller.extend("zapp.controller.MyRequests", {
        onInit: function () {
            var oModel = new JSONModel({
                list: [],
                currentDetail: null
            });
            this.getView().setModel(oModel, "myreq");

            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter.getRoute("RouteMyRequests")) { 
                oRouter.getRoute("RouteMyRequests").attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadMyRequests();
            }
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true); 
        },

        _onRouteMatched: function () {
            this._loadMyRequests();
        },

        onRefreshList: function() {
            this._loadMyRequests();
        },

        _loadMyRequests: function () {
            var oView = this.getView();
            var oODataModel = this.getOwnerComponent().getModel();
            var oMyReqModel = oView.getModel("myreq");
            var oAuthModel = this.getOwnerComponent().getModel("auth"); 

            if (!oODataModel) return;
            oView.setBusy(true);

            var sCurrentUser = oAuthModel.getProperty("/currentUser");
            
            var oPendingBinding = oODataModel.bindList("/Data", null, null, [
                new Filter({
                    filters: [
                        new Filter("status", FilterOperator.EQ, "P"),
                        new Filter("status", FilterOperator.EQ, "R")
                    ],
                    and: false
                })
            ]);
             
            var oAuditModel = this.getOwnerComponent().getModel("auditOData");
            var oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aList = []; 
                var aAllContexts = [];
                
                aResults[0].forEach(ctx => aAllContexts.push({ ctx: ctx, isPending: true }));
                aResults[1].forEach(ctx => aAllContexts.push({ ctx: ctx, isPending: false }));
                
                aAllContexts.forEach(function(oWrapper) {
                    var oData = oWrapper.ctx.getObject();
                    var sRecordOwner = oData.created_by || oData.CreatedBy || oData.changed_by || oData.ChangedBy || "";
                    if (sRecordOwner.toUpperCase() !== sCurrentUser.toUpperCase()) {
                        return; 
                    }

                    var sActionCode = oData.action_type || oData.ActionType || oData.action || "";
                    var sActionText = sActionCode === "C" ? "CREATE" : (sActionCode === "U" ? "UPDATE" : "DELETE");
                    var sStatusCode = oData.status || oData.Status || "";
                    var sStatusText = oWrapper.isPending ? "PENDING" : (sStatusCode === "R" ? "REJECTED" : "APPROVED");

                    var sOldDataStr = oData.old_data || oData.OldData || "";
                    var sNewDataStr = oData.new_data || oData.NewData || oData.data || oData.Data || "";

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

                    var aFields = [];
                    var aAllKeys = Object.keys(oParsedNew);
                    Object.keys(oParsedOld).forEach(k => { if (!aAllKeys.includes(k)) aAllKeys.push(k); });

                    aAllKeys.forEach(function (key) {
                        var sOldVal = "-";
                        if (sActionCode !== "C") {
                            sOldVal = oParsedOld[key] !== undefined ? String(oParsedOld[key]) : "Loading...";
                        }
                        var sNewVal = oParsedNew[key] !== undefined ? String(oParsedNew[key]) : "-";

                        aFields.push({ 
                            field: key, 
                            oldData: sOldVal, 
                            value: sNewVal 
                        });
                    });

                    aList.push({
                        _odataContext: oWrapper.ctx,
                        reqId: oData.uuid || oData.log_uuid,
                        tableName: oData.table_name || oData.TableName || "",
                        action: sActionText,
                        status: sStatusText,
                        rawDataDate: new Date(oData.changed_at || oData.ChangedAt || oData.created_at), 
                        changedAt: DataFormatter.formatDateTime(oData.changed_at || oData.ChangedAt),
                        rejectReason: oData.RejectReason || oData.reject_reason || "",
                        fields: aFields
                    });
                });

                aList.sort(function(a, b) {
                    return b.rawDataDate - a.rawDataDate;
                });

                aList.forEach(function(item, index) {
                    item.indexNo = index + 1;
                });

                oMyReqModel.setProperty("/list", aList);
                oView.setBusy(false);
                this.onStatusFilterSelect();

            }.bind(this)).catch(function(e) {
                oView.setBusy(false);
                console.error(e);
            });
        },

        onStatusFilterSelect: function() {
            var sKey = this.byId("statusFilterBar").getSelectedKey();
            var oBinding = this.byId("myRequestsTable").getBinding("items");
            if (sKey === "ALL") {
                oBinding.filter([]);
            } else {
                oBinding.filter([new Filter("status", FilterOperator.EQ, sKey)]);
            }
        },

        onOpenDetailDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("myreq");
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("myreq");
            
            var oClone = Object.assign({}, oRowData);
            oClone.fields = JSON.parse(JSON.stringify(oRowData.fields));
            
            oModel.setProperty("/currentDetail", oClone);

            var bIsRejected = (oRowData.status === "REJECTED");

            if (!this._oResubmitDialog) {
                this._oResubmitDialog = new sap.m.Dialog({
                    contentWidth: "800px", 
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.ObjectHeader({
                                    title: "Target Table: {myreq>/currentDetail/tableName}",
                                    icon: "sap-icon://form",
                                    responsive: true,
                                    fullScreenOptimized: true,
                                    statuses: [
                                        new sap.m.ObjectStatus({
                                            text: "{myreq>/currentDetail/action}",
                                            state: "{= ${myreq>/currentDetail/action} === 'CREATE' ? 'Success' : (${myreq>/currentDetail/action} === 'DELETE' ? 'Error' : 'Warning') }",
                                            icon: "{= ${myreq>/currentDetail/action} === 'CREATE' ? 'sap-icon://add' : (${myreq>/currentDetail/action} === 'DELETE' ? 'sap-icon://delete' : 'sap-icon://edit') }",
                                            inverted: true
                                        })
                                    ]
                                }),

                                new sap.m.MessageStrip({
                                    text: "Comment for this Rejection: {myreq>/currentDetail/rejectReason}",
                                    type: "Error",
                                    showIcon: true,
                                    visible: "{= ${myreq>/currentDetail/status} === 'REJECTED' }"
                                }).addStyleClass("sapUiSmallMargin"),
                                
                                new sap.m.Table({
                                    backgroundDesign: "Solid",
                                    sticky: ["ColumnHeaders"],
                                    items: {
                                        path: "myreq>/currentDetail/fields",
                                        template: new sap.m.ColumnListItem({
                                            cells: [
                                                new sap.m.Text({ text: "{myreq>field}", design: "Bold" }),
                                                new sap.m.Text({ text: "{myreq>oldData}" }),
                                                
                                                new sap.m.HBox({
                                                    items: [
                                                        new sap.m.Input({ 
                                                            value: "{myreq>value}", 
                                                            visible: "{= ${myreq>/currentDetail/status} === 'REJECTED' }" 
                                                        }),
                                                        new sap.m.ObjectStatus({ 
                                                            text: "{myreq>value}", 
                                                            visible: "{= ${myreq>/currentDetail/status} !== 'REJECTED' }", 
                                                            state: "{= ${myreq>oldData} !== ${myreq>value} && ${myreq>oldData} !== 'N/A' && ${myreq>oldData} !== '-' ? 'Warning' : 'Success' }",
                                                            icon: "{= ${myreq>oldData} !== ${myreq>value} && ${myreq>oldData} !== 'N/A' && ${myreq>oldData} !== '-' ? 'sap-icon://edit' : 'sap-icon://sys-enter-2' }"
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    },
                                    columns: [
                                        new sap.m.Column({ header: new sap.m.Label({ text: "Field", design: "Bold" }), width: "25%" }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: "Old Data", design: "Bold" }), width: "35%" }),
                                        new sap.m.Column({ header: new sap.m.Label({ text: "New Data", design: "Bold" }), width: "40%" })
                                    ]
                                }).addStyleClass("sapUiTinyMargin")
                            ]
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "Delete Draft",
                            type: "Reject",
                            icon: "sap-icon://delete",
                            visible: "{= ${myreq>/currentDetail/status} === 'REJECTED' }",
                            press: this._processDeleteDraft.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Resubmit Request",
                            type: "Accept",
                            icon: "sap-icon://paper-plane",
                            visible: "{= ${myreq>/currentDetail/status} === 'REJECTED' }",
                            press: this._processResubmit.bind(this)
                        }),
                        new sap.m.Button({
                            text: "Close",
                            type: "Transparent",
                            press: function() { this._oResubmitDialog.close(); }.bind(this)
                        })
                    ]
                });
                this.getView().addDependent(this._oResubmitDialog);
            }

            this._oResubmitDialog.bindElement({ path: "myreq>/currentDetail" });
            this._oResubmitDialog.setTitle(bIsRejected ? "Edit Rejected Request" : "Request Details");
            this._oResubmitDialog.open();

            if (oRowData.action === "CREATE" || oRowData.status !== "PENDING") {
                this._oResubmitDialog.setBusy(false);
                return;
            }

            this._oResubmitDialog.setBusy(true);

            var oODataModel = this.getOwnerComponent().getModel();
            GetData.loadMeta(oODataModel, oRowData.tableName, "", "E").then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [];
                
                var oNewDataMapped = {};
                oClone.fields.forEach(function(d) { oNewDataMapped[d.field] = d.value; });

                var oOldRow = aMasterData.find(function(row) {
                    var oJson = JSON.parse(row.data || "{}");
                    if (oNewDataMapped.ID && String(oJson.ID) === String(oNewDataMapped.ID)) return true;
                    if (oNewDataMapped.UUID && String(oJson.UUID) === String(oNewDataMapped.UUID)) return true;
                    if (oNewDataMapped.CODE && String(oJson.CODE) === String(oNewDataMapped.CODE)) return true;
                    return false;
                });

                var aUpdatedFields = oClone.fields.map(function(d) {
                    var sOldValue = "N/A";
                    if (oOldRow) {
                        var oOldJson = JSON.parse(oOldRow.data || "{}");
                        sOldValue = oOldJson[d.field] !== undefined ? String(oOldJson[d.field]) : "N/A";
                    }
                    return {
                        field: d.field,
                        oldData: sOldValue,
                        value: d.value 
                    };
                });

                oModel.setProperty("/currentDetail/fields", aUpdatedFields);
                this._oResubmitDialog.setBusy(false);

            }.bind(this)).catch(function(e) {
                console.error("Error loading master data:", e);
                this._oResubmitDialog.setBusy(false);
            }.bind(this));
        },

        _processDeleteDraft: function () {
            var oView = this.getView();
            var oModel = oView.getModel("myreq");
            var oCurrentReq = oModel.getProperty("/currentDetail");

            var oODataContext = oCurrentReq._odataContext;
            if (!oODataContext) {
                MessageBox.error("Connection to original data lost. Please refresh!");
                return;
            }

            MessageBox.confirm("Are you sure you want to permanently delete this draft?", {
                title: "Confirm Deletion",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        sap.ui.core.BusyIndicator.show(0);

                        oODataContext.delete().then(function () {
                            sap.ui.core.BusyIndicator.hide();
                            MessageToast.show("Draft deleted successfully!");
                            
                            this._oResubmitDialog.close();
                            this._loadMyRequests();

                        }.bind(this)).catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.error("Error during deletion: " + (oError.message || "Check Console"));
                            console.error(oError);
                        });
                    }
                }.bind(this)
            });
        },

        _processResubmit: function () {
            var oView = this.getView();
            var oModel = oView.getModel("myreq");
            var oCurrentReq = oModel.getProperty("/currentDetail");
            var oODataModel = this.getOwnerComponent().getModel();

            var oODataContext = oCurrentReq._odataContext;
            if (!oODataContext) {
                MessageBox.error("Connection to original data lost. Please refresh!");
                return;
            }

            var oNewPayload = {};
            oCurrentReq.fields.forEach(function(item) {
                oNewPayload[item.field] = item.value; 
            });

            var sNewBase64 = "";
            try {
                sNewBase64 = GetData.encodeFunction(oNewPayload);
            } catch(e) {
                MessageBox.error("Data encoding error!"); return;
            }

            var sActionPath = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.resubmit(...)";
            var oActionContext = oODataModel.bindContext(sActionPath, oODataContext);
            
            oActionContext.setParameter("table_name", oCurrentReq.tableName);
            oActionContext.setParameter("json_data", sNewBase64);

            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Resubmitted successfully! Status changed to Pending.");
                
                this._oResubmitDialog.close();
                this._loadMyRequests(); 

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Error during resubmit: " + (oError.message || "Check Console"));
                console.error(oError);
            });
        }
    });
});