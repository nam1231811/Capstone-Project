sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/utils/DataFormatter",
    "zapp/utils/GridValidator",
    "zapp/api/LoadData"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, DataFormatter, GridValidator, LoadData) {
    "use strict";

    const ACTION_RESUBMIT = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.resubmit";

    return Controller.extend("zapp.controller.MyRequests", {
        onInit: function () {
            var oModel = new JSONModel({
                    list: [],
                    currentDetail: null,
                    isTableBusy: false
                }),
                oRouter = this.getOwnerComponent().getRouter();

            this.getView().setModel(oModel, "myreq");

            if (oRouter.getRoute("RouteMyRequests")) {
                oRouter.getRoute("RouteMyRequests").attachPatternMatched(this._onRouteMatched, this);
            } else {
                this._loadMyRequests(true);
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth"),
                bIsClerk = oAuthModel ? oAuthModel.getProperty("/isClerk") : false;

            if (!bIsClerk) {
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
                return;
            }

            this._loadMyRequests(true);
        },

        onRefreshList: function () {
            this._loadMyRequests(true);
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

        _loadMyRequests: function (bForceRefresh) {
            var oView = this.getView(),
                oODataModel = this.getOwnerComponent().getModel(),
                oMyReqModel = oView.getModel("myreq"),
                oAuthModel = this.getOwnerComponent().getModel("auth"),
                oAuditModel = this.getOwnerComponent().getModel("auditOData"),
                sCurrentUser, oPendingBinding, oHistoryBinding;

            if (!oODataModel || !oAuditModel) return;
            oView.setBusy(true);

            if (bForceRefresh) {
                oODataModel.refresh();
                oAuditModel.refresh();
            }

            sCurrentUser = oAuthModel.getProperty("/currentUser");
            oPendingBinding = oODataModel.bindList("/Data", null, null, [
                new Filter("status", FilterOperator.EQ, "P")
            ]);
            oHistoryBinding = oAuditModel.bindList("/AuditLog", null, null, null);

            Promise.all([
                oPendingBinding.requestContexts(0, 500),
                oHistoryBinding.requestContexts(0, 500)
            ]).then(function (aResults) {
                var aList = [],
                    aAllContexts = [];

                aResults[0].forEach(ctx => aAllContexts.push({ ctx: ctx, source: "TEMP" }));
                aResults[1].forEach(ctx => aAllContexts.push({ ctx: ctx, source: "AUDIT" }));

                aAllContexts.forEach(function (oWrapper) {
                    var oData = oWrapper.ctx.getObject(),
                        sCheckStatus = String(oData.status || oData.Status || "").toUpperCase(),
                        sRecordOwner = oData.created_by || oData.CreatedBy || oData.changed_by || oData.ChangedBy || "",
                        sStatusText = "", sReqId = "", sActionCode = "", sActionText = "UPDATE",
                        sOldDataStr = oData.old_data || oData.OldData || "",
                        sNewDataStr = oData.new_data || oData.NewData || "",
                        sTempData = oData.data || oData.Data || "",
                        bHasOld, bHasNew, oParsedOld, oParsedNew, aFields = [], aAllKeys;

                    if (sRecordOwner.toUpperCase() !== sCurrentUser.toUpperCase()) return;

                    if (oWrapper.source === "TEMP") {
                        sStatusText = "PENDING";
                        sReqId = oData.uuid || oData.Uuid || oData.UUID || "";
                    } else {
                        if (sCheckStatus === "P") return;
                        sStatusText = (sCheckStatus === "R") ? "REJECTED" : "APPROVED";
                        sReqId = oData.log_uuid || oData.LogUuid || oData.LOG_UUID || oData.uuid || "";
                    }

                    sActionCode = String(oData.action_type || oData.ActionType || oData.action || oData.Action || "").toUpperCase();
                    
                    if (sActionCode === "C" || sActionCode === "CREATE") sActionText = "CREATE";
                    else if (sActionCode === "D" || sActionCode === "DELETE") sActionText = "DELETE";
                    else if (sActionCode === "U" || sActionCode === "UPDATE") sActionText = "UPDATE";
                    else {
                        bHasOld = !!(oData.old_data || oData.OldData);
                        bHasNew = !!(oData.new_data || oData.NewData || oData.data || oData.Data);
                        if (bHasOld && !bHasNew) sActionText = "DELETE";
                        else if (!bHasOld && bHasNew) sActionText = "CREATE";
                        else sActionText = "UPDATE";
                    }

                    if (sTempData) {
                        if (sActionText === "DELETE") sOldDataStr = sTempData;
                        else sNewDataStr = sTempData;
                    }

                    if (sActionText === "DELETE" && !sOldDataStr && sNewDataStr) {
                        sOldDataStr = sNewDataStr; sNewDataStr = "";
                    } else if (sActionText === "CREATE" && !sNewDataStr && sOldDataStr) {
                        sNewDataStr = sOldDataStr; sOldDataStr = "";
                    }

                    oParsedOld = this._safeParse(sOldDataStr);
                    oParsedNew = this._safeParse(sNewDataStr);

                    aAllKeys = Object.keys(oParsedNew);
                    Object.keys(oParsedOld).forEach(k => { if (!aAllKeys.includes(k)) aAllKeys.push(k); });

                    aAllKeys.forEach(function (key) {
                        if (String(key).toUpperCase() === "MANDT") return;

                        var sOldVal = (sActionText !== "CREATE" && oParsedOld[key] !== undefined) ? String(oParsedOld[key]) : "-",
                            sNewVal = (sActionText !== "DELETE" && oParsedNew[key] !== undefined) ? String(oParsedNew[key]) : "-";

                        aFields.push({ field: key, oldData: sOldVal, value: sNewVal });
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
                }.bind(this));

                aList.sort((a, b) => b.rawDataDate - a.rawDataDate)
                     .forEach((item, index) => item.indexNo = index + 1);

                oMyReqModel.setProperty("/list", aList);
                oView.setBusy(false);
                this._applyFilters();

            }.bind(this)).catch(function (e) {
                oView.setBusy(false);
                console.error(e);
            });
        },

        _applyFilters: function () {
            var sStatusKey = this.byId("statusFilterBar").getSelectedKey(),
                sSearchQuery = this.byId("searchTable").getValue(),
                oBinding = this.byId("myRequestsTable").getBinding("items"),
                aFilters = [];

            if (sStatusKey !== "ALL") {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatusKey));
            }
            if (sSearchQuery && sSearchQuery.trim() !== "") {
                aFilters.push(new Filter("tableName", FilterOperator.Contains, sSearchQuery.trim().toUpperCase()));
            }

            oBinding.filter(aFilters);
        },

        onStatusFilterSelect: function () {
            this._applyFilters();
        },

        onSearchTable: function () {
            this._applyFilters();
        },

        onOpenDetailDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("myreq"),
                oRowData = oContext.getObject(),
                oModel = this.getView().getModel("myreq"),
                oODataModel = this.getOwnerComponent().getModel(),
                oClone = Object.assign({}, oRowData),
                bNeedsFetch = (oRowData.status === "PENDING" || oRowData.status === "REJECTED") && (oRowData.action === "UPDATE" || oRowData.action === "CREATE");

            if (bNeedsFetch) {
                oClone.fields = [];
                oModel.setProperty("/isTableBusy", true);
            } else {
                oClone.fields = JSON.parse(JSON.stringify(oRowData.fields));
                oModel.setProperty("/isTableBusy", false);
            }

            oModel.setProperty("/currentDetail", oClone);

            this._oResubmitDialog = this.byId("resubmitDialog");
            this._oResubmitDialog.open();

            if (!bNeedsFetch) return;

            LoadData.loadTableData(oODataModel, oRowData.tableName).then(function (oPayload) {
                var aMasterData = oPayload.dataRows || oPayload.Data || [],
                    aMeta = oPayload.metadata || oPayload.Meta || [],
                    oNewDataMapped = {},
                    aKeyFields = [],
                    oIdCol, oOldRow, aUpdatedFields;

                oRowData.fields.forEach(d => oNewDataMapped[d.field] = d.value);

                aMeta.forEach(function (col) {
                    if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true) {
                        aKeyFields.push((col.fieldname || col.fieldName).toUpperCase());
                    }
                });

                if (aKeyFields.length === 0) {
                    oIdCol = aMeta.find(c => (c.fieldname || c.fieldName || "").toUpperCase().includes("ID"));
                    if (oIdCol) aKeyFields.push((oIdCol.fieldname || oIdCol.fieldName).toUpperCase());
                }

                oOldRow = aMasterData.find(function (row) {
                    var oJson = {};
                    try { oJson = JSON.parse(row.data || "{}"); } catch (e) { }

                    if (aKeyFields.length === 0) return false;
                    return aKeyFields.every(function (keyField) {
                        var sVal1 = String(oJson[keyField] || "").trim().toUpperCase(),
                            sVal2 = String(oNewDataMapped[keyField] || "").trim().toUpperCase();
                        return sVal1 === sVal2 && sVal1 !== "";
                    });
                });

                aUpdatedFields = oRowData.fields.map(function (d) {
                    var sOldValue = (oRowData.action === "CREATE") ? "N/A" : "N/A",
                        bIsKeyField = aKeyFields.includes(String(d.field).toUpperCase()),
                        oMetaDef, sDataType, iLength;

                    if (oOldRow) {
                        var oOldJson = {};
                        try { oOldJson = JSON.parse(oOldRow.data || "{}"); } catch (e) { }
                        if (oOldJson[d.field] !== undefined) sOldValue = String(oOldJson[d.field]);
                    }

                    oMetaDef = aMeta.find(function (m) {
                        var sName = m.fieldname || m.fieldName || m.FIELDNAME || m.Fieldname || m.name || m.Name || "";
                        return sName.toUpperCase() === (d.field || "").toUpperCase();
                    }) || {};

                    sDataType = oMetaDef.datatype || oMetaDef.dataType || oMetaDef.DATATYPE || oMetaDef.type || "CHAR";
                    iLength = parseInt(oMetaDef.leng || oMetaDef.length || oMetaDef.LENG || oMetaDef.maxLength || 0, 10);
                    if (isNaN(iLength)) iLength = 0;

                    return {
                        field: d.field,
                        oldData: sOldValue,
                        value: d.value,
                        isKey: bIsKeyField,
                        datatype: sDataType,
                        length: iLength,
                        valueState: "None",
                        valueStateText: ""
                    };
                });

                oModel.setProperty("/currentDetail/fields", aUpdatedFields);
                oModel.setProperty("/isTableBusy", false);

                this._validateDialogFields();

            }.bind(this)).catch(function (e) {
                console.error("Error loading master data:", e);
                oModel.setProperty("/isTableBusy", false);
                MessageBox.error("Cannot fetch old data right now.");
            }.bind(this));
        },

        onCloseDetailDialog: function () {
            if (this._oResubmitDialog) {
                this._oResubmitDialog.close();
            }
        },

        _validateDialogFields: function () {
            var oModel = this.getView().getModel("myreq"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                aFakeMeta = [], oFakeRow = {},
                aValidatedData, oResultRow, bHasError = false;

            if (!oCurrentReq || !oCurrentReq.fields || oCurrentReq.action === "DELETE") return false;

            oCurrentReq.fields.forEach(function (f, idx) {
                aFakeMeta.push({ fieldname: f.field, datatype: f.datatype, length: f.length });
                oFakeRow[idx] = { fieldname: f.field, value: f.value, isEditable: !f.isKey, isNew: (idx === 0) };
            });

            aValidatedData = GridValidator.performLiveValidation([oFakeRow], aFakeMeta, []);
            oResultRow = aValidatedData[0];

            oCurrentReq.fields.forEach(function (f, idx) {
                var oCell = oResultRow[idx],
                    sPath = "/currentDetail/fields/" + idx;

                if (oCell && oCell._state === "Error") {
                    oModel.setProperty(sPath + "/valueState", "Error");
                    oModel.setProperty(sPath + "/valueStateText", oCell._msg);
                    bHasError = true;
                } else {
                    oModel.setProperty(sPath + "/valueState", "None");
                    oModel.setProperty(sPath + "/valueStateText", "");
                }
            });

            return bHasError;
        },

        onDialogInputChange: function (oEvent) {
            var oInput = oEvent.getSource(),
                sValue = oEvent.getParameter("value"),
                sPath = oInput.getBindingContext("myreq").getPath();

            this.getView().getModel("myreq").setProperty(sPath + "/value", sValue);
            this._validateDialogFields();
        },

        _processResubmit: function () {
            var oView = this.getView(),
                oModel = oView.getModel("myreq"),
                oCurrentReq = oModel.getProperty("/currentDetail"),
                oODataModel = this.getOwnerComponent().getModel(),
                bHasError = this._validateDialogFields(),
                oNewPayload = {}, sNewBase64 = "",
                sServiceUrl, sActionUrl;

            if (bHasError) {
                MessageBox.error("Please correct the faulty fields (highlighted in red) before resubmitting!");
                return;
            }

            oCurrentReq.fields.forEach(function (item) {
                oNewPayload[item.field] = (oCurrentReq.action === "DELETE") 
                    ? item.oldData 
                    : DataFormatter.formatValueByType(item.value, item.datatype);
            });

            try {
                sNewBase64 = DataFormatter.encodeFunction(oNewPayload);
            } catch (e) {
                MessageBox.error("Data encoding error!"); return;
            }

            this._oResubmitDialog.setBusy(true);

            sServiceUrl = oODataModel.getServiceUrl();
            if (!sServiceUrl.endsWith("/")) sServiceUrl += "/";
            
            sActionUrl = sServiceUrl + "Data(uuid=" + oCurrentReq.reqId + ")/" + ACTION_RESUBMIT;

            fetch(sServiceUrl, { method: "HEAD", headers: { "X-CSRF-Token": "Fetch" } })
                .then(function (headResponse) {
                    var sToken, oPayload;
                    if (!headResponse.ok) throw new Error("Cannot fetch CSRF token" + headResponse.status);

                    sToken = headResponse.headers.get("X-CSRF-Token");
                    oPayload = { "table_name": oCurrentReq.tableName, "json_data": sNewBase64 };

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
                        return postResponse.json().then(errData => { throw errData; });
                    }

                    this._oResubmitDialog.setBusy(false);
                    MessageToast.show("Resubmitted successfully!");
                    this._oResubmitDialog.close();
                    this._loadMyRequests(true);
                }.bind(this))
                .catch(function (err) {
                    var sMsg = "Error during resubmit!";
                    this._oResubmitDialog.setBusy(false);
                    
                    try {
                        if (err.error && err.error.message) sMsg = err.error.message.value || err.error.message;
                        else if (err.message) sMsg = err.message;
                    } catch (e) { }

                    MessageBox.error(sMsg);
                }.bind(this));
        }
    });
});