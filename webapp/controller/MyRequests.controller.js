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
                new Filter("status", FilterOperator.EQ, "P") 
            ]);
             
            var oAuditModel = this.getOwnerComponent().getModel("auditOData");
            var oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aList = []; 
                var aAllContexts = [];
                
                aResults[0].forEach(ctx => aAllContexts.push({ ctx: ctx, source: "TEMP" }));
                aResults[1].forEach(ctx => aAllContexts.push({ ctx: ctx, source: "AUDIT" }));
                
                aAllContexts.forEach(function(oWrapper) {
                    var oData = oWrapper.ctx.getObject();
                    var sCheckStatus = String(oData.status || oData.Status || "").toUpperCase();

                    var sStatusText = "";
                    if (oWrapper.source === "TEMP") {
                        sStatusText = "PENDING";
                    } else {
                        if (sCheckStatus === "P") return; 
                        if (sCheckStatus === "R") {
                            sStatusText = "REJECTED";
                        } else {
                            sStatusText = "APPROVED"; 
                        }
                    }

                    var sRecordOwner = oData.created_by || oData.CreatedBy || oData.changed_by || oData.ChangedBy || "";
                    if (sRecordOwner.toUpperCase() !== sCurrentUser.toUpperCase()) {
                        return; 
                    }

                    var sReqId = "";
                    if (oWrapper.source === "TEMP") {
                        sReqId = oData.uuid || oData.Uuid || oData.UUID || "";
                    } else {
                        sReqId = oData.log_uuid || oData.LogUuid || oData.LOG_UUID || oData.uuid || ""; 
                    }

                    var sActionCode = String(oData.action_type || oData.ActionType || oData.action || oData.Action || "").toUpperCase();
                    var sActionText = "UPDATE";
                    
                    if (sActionCode === "C" || sActionCode === "CREATE") sActionText = "CREATE";
                    else if (sActionCode === "D" || sActionCode === "DELETE") sActionText = "DELETE";
                    else if (sActionCode === "U" || sActionCode === "UPDATE") sActionText = "UPDATE";
                    else {
                        var bHasOld = !!(oData.old_data || oData.OldData);
                        var bHasNew = !!(oData.new_data || oData.NewData || oData.data || oData.Data);
                        if (bHasOld && !bHasNew) sActionText = "DELETE";
                        else if (!bHasOld && bHasNew) sActionText = "CREATE";
                        else sActionText = "UPDATE";
                    }

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

                    var aFields = [];
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

                        aFields.push({ 
                            field: key, 
                            oldData: sOldVal, 
                            value: sNewVal 
                        });
                    });

                    aList.push({
                        _odataContext: oWrapper.ctx,
                        source: oWrapper.source, 
                        reqId: sReqId,           
                        tableName: oData.table_name || oData.TableName || "",
                        action: sActionText,
                        status: sStatusText,
                        rawDataDate: new Date(oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt), 
                        changedAt: DataFormatter.formatDateTime(oData.changed_at || oData.ChangedAt || oData.created_at || oData.CreatedAt),
                        rejectReason: oData.RejectReason || oData.reject_reason || "",
                        fields: aFields
                    });
                });

                aList.sort(function(a, b) {
                    return b.rawDataDate - a.rawDataDate;
                });

                var aUniqueList = [];
                var oSeenSignatures = {};

                aList.forEach(function(item) {
                    var sRecordId = "";
                    
                    var oIdField = item.fields.find(f => f.field.indexOf("ID") !== -1 || f.field.indexOf("CODE") !== -1 || f.field === "UUID");
                    if (oIdField) {
                        sRecordId = (oIdField.oldData !== "-" && oIdField.oldData !== "N/A") ? oIdField.oldData : oIdField.value;
                    } else if (item.fields.length > 0) {
                        sRecordId = item.fields[0].value; 
                    }

                    var sSignature = item.tableName + "_" + item.action + "_" + sRecordId;

                    if (!oSeenSignatures[sSignature]) {
                        oSeenSignatures[sSignature] = true;
                        aUniqueList.push(item);
                    }
                });
                
                aList = aUniqueList; 

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
                                                            visible: "{= ${myreq>/currentDetail/status} === 'REJECTED' && ${myreq>/currentDetail/action} !== 'DELETE' }" 
                                                        }),
                                                        new sap.m.ObjectStatus({ 
                                                            text: "{myreq>value}", 
                                                            visible: "{= ${myreq>/currentDetail/status} !== 'REJECTED' || ${myreq>/currentDetail/action} === 'DELETE' }", 
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

            if (oRowData.action !== "UPDATE") {
                this._oResubmitDialog.setBusy(false);
                return;
            }

            this._oResubmitDialog.setBusy(true);

            var oODataModel = this.getOwnerComponent().getModel();
            
            GetData.loadTableData(oODataModel, oRowData.tableName).then(function(oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [];
                var aMeta = oPayload.metadata || oPayload.Meta || [];
                
                var oNewDataMapped = {};
                oClone.fields.forEach(function(d) { oNewDataMapped[d.field] = d.value; });

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

                var aUpdatedFields = oClone.fields.map(function(d) {
                    var sOldValue = "N/A";
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
            var that = this;

            var oNewPayload = {};
            oCurrentReq.fields.forEach(function(item) {
                if (oCurrentReq.action === "DELETE") {
                    oNewPayload[item.field] = item.oldData; 
                } else {
                    oNewPayload[item.field] = item.value; 
                }
            });

            var sNewBase64 = "";
            try {
                sNewBase64 = GetData.encodeFunction(oNewPayload);
            } catch(e) {
                sap.m.MessageBox.error("Data encoding error!"); return;
            }

            sap.ui.core.BusyIndicator.show(0);

            var sServiceUrl = oODataModel.getServiceUrl();
            if (!sServiceUrl.endsWith("/")) {
                sServiceUrl += "/";
            }
            
            var sActionUrl = sServiceUrl + "Data(uuid=" + oCurrentReq.reqId + ")/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.resubmit";

            fetch(sServiceUrl, {
                method: "HEAD",
                headers: {
                    "X-CSRF-Token": "Fetch"
                }
            })
            .then(function (headResponse) {
                if (!headResponse.ok) {
                    throw new Error("Cannot fetch CSRF token" + headResponse.status);
                }
                
                var sToken = headResponse.headers.get("X-CSRF-Token");
                var oPayload = {
                    "table_name": oCurrentReq.tableName,
                    "json_data": sNewBase64
                };

                return fetch(sActionUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": sToken,
                        "If-Match": "*"
                    },
                    body: JSON.stringify(oPayload)
                });
            })
            .then(function (postResponse) {
                if (!postResponse.ok) {
                    return postResponse.json().then(function (errData) {
                        throw errData;
                    });
                }

                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageToast.show("Resubmitted successfully!");
                that._oResubmitDialog.close();
                that._loadMyRequests(); 
            })
            .catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                var sMsg = "Error during resubmit!";

                try {
                    if (err.error && err.error.message) {
                        sMsg = err.error.message.value || err.error.message;
                    } else if (err.message) {
                        sMsg = err.message;
                    }
                } catch(e) {}
                
                sap.m.MessageBox.error(sMsg);
            });
        }
    });
});