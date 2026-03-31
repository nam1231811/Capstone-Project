sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("zapp.controller.AuditLog", {
        onInit: function () {
            var oModel = new JSONModel({
                mainLogs: [],
                currentTrail: [],
                selectedRowId: "",
                allLogs: [] // Chứa bộ nhớ đệm toàn bộ Log tải từ DB
            });
            this.getView().setModel(oModel, "audit");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true);
        },

        onValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            var oBundle = oView.getModel("i18n") ? oView.getModel("i18n").getResourceBundle() : null;

            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: "List of Tables",
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
                sap.m.MessageBox.error("Không tìm thấy Model kết nối đến Backend. Vui lòng kiểm tra lại manifest.json!");
                return;
            }

            if (!sTableName || sTableName.trim() === "") {
                sap.m.MessageToast.show("Please enter the table name to search!");
                oLocalModel.setProperty("/mainLogs", []);
                return;
            }

            this.getView().setBusy(true);

            // GỌI ODATA V4 LẤY LOG TỪ BACKEND
            var oListBinding = oODataModel.bindList("/AuditLog");
            oListBinding.filter(new sap.ui.model.Filter("TableName", sap.ui.model.FilterOperator.EQ, sTableName.toUpperCase()));

            oListBinding.requestContexts(0, 5000).then(function (aContexts) {
                var aAllLogs = [];
                aContexts.forEach(function (oCtx) {
                    aAllLogs.push(oCtx.getObject());
                });

                // Sắp xếp Mới nhất -> Cũ nhất
                aAllLogs.sort(function (a, b) {
                    return new Date(b.ChangedAt) - new Date(a.ChangedAt);
                });

                oLocalModel.setProperty("/allLogs", aAllLogs);

                // GOM NHÓM THEO ROW ID (Chỉ lấy hành động mới nhất)
                var oLatestLogsMap = {};
                var aMainLogs = [];

                aAllLogs.forEach(function (oLog) {
                    if (!oLatestLogsMap[oLog.RecordKey]) {
                        oLatestLogsMap[oLog.RecordKey] = true;

                        var sAction = "UPDATE";
                        if (oLog.Action === 'C') sAction = "CREATE";
                        if (oLog.Action === 'D') sAction = "DELETE";

                        var sTime = "";
                        if (oLog.ChangedAt) {
                            var oDate = new Date(oLog.ChangedAt); // Tự động quy đổi từ UTC sang giờ máy tính (VD: GMT+7)
                            var yyyy = oDate.getFullYear();
                            var MM = String(oDate.getMonth() + 1).padStart(2, '0');
                            var dd = String(oDate.getDate()).padStart(2, '0');
                            var HH = String(oDate.getHours()).padStart(2, '0');
                            var mm = String(oDate.getMinutes()).padStart(2, '0');
                            var ss = String(oDate.getSeconds()).padStart(2, '0');
                            sTime = yyyy + "-" + MM + "-" + dd + " " + HH + ":" + mm + ":" + ss;
                        }

                        aMainLogs.push({
                            rowId: oLog.RecordKey,
                            lastAction: sAction,
                            lastUser: oLog.ChangedBy,
                            lastTimestamp: sTime
                        });
                    }
                });

                oLocalModel.setProperty("/mainLogs", aMainLogs);
                this.getView().setBusy(false);
                sap.m.MessageToast.show("Loaded audit log for table: " + sTableName.toUpperCase());

            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                sap.m.MessageBox.error("Lỗi khi tải dữ liệu Audit Log: " + oError.message);
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

            // THUẬT TOÁN JSON DIFFING
            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var aTrailUI = [];

            var aTrailLogs = aAllLogs.filter(function (l) { return l.RecordKey === sRowId; });

            aTrailLogs.forEach(function (oLog) {
                var sAction = oLog.Action === 'C' ? 'CREATE' : (oLog.Action === 'U' ? 'UPDATE' : 'DELETE');
                var sTime = "";
                if (oLog.ChangedAt) {
                    var oDate = new Date(oLog.ChangedAt);
                    var yyyy = oDate.getFullYear();
                    var MM = String(oDate.getMonth() + 1).padStart(2, '0');
                    var dd = String(oDate.getDate()).padStart(2, '0');
                    var HH = String(oDate.getHours()).padStart(2, '0');
                    var mm = String(oDate.getMinutes()).padStart(2, '0');
                    var ss = String(oDate.getSeconds()).padStart(2, '0');
                    sTime = yyyy + "-" + MM + "-" + dd + " " + HH + ":" + mm + ":" + ss;
                }
                var aChanges = [];

                var oOld = {}, oNew = {};
                try { if (oLog.OldData) oOld = JSON.parse(oLog.OldData); } catch (e) { }
                try { if (oLog.NewData) oNew = JSON.parse(oLog.NewData); } catch (e) { }

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

                if (aChanges.length === 0) {
                    aChanges.push({ field: "Không có thay đổi chi tiết", oldValue: "-", newValue: "-" });
                }


                aTrailUI.push({
                    logId: oLog.LogUuid,
                    timestamp: sTime,
                    user: oLog.ChangedBy,
                    action: sAction,
                    changes: aChanges
                });
            });

            oLocalModel.setProperty("/currentTrail", aTrailUI);

            // TẠO DIALOG HIỂN THỊ
            if (!this._oTrailDialog) {
                this._oTrailDialog = new sap.m.Dialog({
                    title: "Detailed Audit Trail - Record ID: {audit>/selectedRowId}",
                    contentWidth: "900px",
                    contentHeight: "600px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.ScrollContainer({
                            width: "100%",
                            height: "100%",
                            vertical: true,
                            content: [
                                new sap.m.VBox({
                                    class: "sapUiSmallMargin",
                                    items: {
                                        path: "audit>/currentTrail",
                                        template: new sap.m.Panel({
                                            expandable: true,
                                            expanded: true,
                                            width: "auto",
                                            class: "sapUiTinyMarginBottom",
                                            headerToolbar: new sap.m.OverflowToolbar({
                                                style: "Clear",
                                                content: [
                                                    new sap.m.Avatar({
                                                        src: "{= ${audit>action} === 'CREATE' ? 'sap-icon://add' : (${audit>action} === 'DELETE' ? 'sap-icon://delete' : 'sap-icon://edit-property') }",
                                                        displaySize: "XS",
                                                        backgroundColor: "{= ${audit>action} === 'CREATE' ? 'Accent3' : (${audit>action} === 'DELETE' ? 'Accent2' : 'Accent1') }"
                                                    }),
                                                    new sap.m.Label({ text: "{audit>user}", design: "Bold" }),
                                                    new sap.m.Text({ text: "•" }),
                                                    new sap.m.Text({ text: "{audit>timestamp}" }),

                                                    new sap.m.ToolbarSpacer(),

                                                    new sap.m.ObjectStatus({
                                                        text: "{audit>action}",
                                                        state: "{= ${audit>action} === 'CREATE' ? 'Success' : (${audit>action} === 'DELETE' ? 'Error' : 'Warning') }"
                                                    }),
                                                    new sap.m.ToolbarSeparator(),
                                                    new sap.m.Button({
                                                        text: "Revert",
                                                        icon: "sap-icon://undo",
                                                        type: "Transparent",
                                                        visible: "{= ${audit>action} === 'UPDATE' || ${audit>action} === 'DELETE'}",
                                                        press: this.onRequestRevert.bind(this)
                                                    })
                                                ]
                                            }),
                                            content: [
                                                new sap.m.Table({
                                                    backgroundDesign: "Transparent",
                                                    showSeparators: "Inner",
                                                    columns: [
                                                        new sap.m.Column({ width: "30%", header: new sap.m.Label({ text: "Field Changed", design: "Bold" }) }),
                                                        new sap.m.Column({ width: "35%", header: new sap.m.Label({ text: "Old Value" }) }),
                                                        new sap.m.Column({ width: "35%", header: new sap.m.Label({ text: "New Value" }) })
                                                    ],
                                                    items: {
                                                        path: "audit>changes",
                                                        template: new sap.m.ColumnListItem({
                                                            cells: [
                                                                new sap.m.Text({ text: "{audit>field}" }),
                                                                new sap.m.Text({ text: "{audit>oldValue}" }),
                                                                new sap.m.ObjectStatus({
                                                                    text: "{audit>newValue}",
                                                                    state: "{= ${audit>oldValue} !== '-' ? 'Success' : 'None' }"
                                                                })
                                                            ]
                                                        })
                                                    }
                                                })
                                            ]
                                        })
                                    }
                                })
                            ]
                        })
                    ],
                    endButton: new sap.m.Button({
                        text: "Close Dialog",
                        press: function () {
                            this._oTrailDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._oTrailDialog);
            }

            this._oTrailDialog.open();
        },

        onRequestRevert: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("audit");
            var oLogEntry = oContext.getObject();
            var sTableName = this.byId("auditSearchInput").getValue();
            var sRowId = this.getView().getModel("audit").getProperty("/selectedRowId");

            var sMessage = "You are about to revert the record [ID: " + sRowId + "] to the state at: " + oLogEntry.timestamp + ".\n\n" +
                "This request will be sent to the Manager for approval. Are you sure you want to create this Request?";

            MessageBox.confirm(sMessage, {
                title: "Confirm Revert Request",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        this._sendRevertRequestToBackend(sTableName, sRowId, oLogEntry.logId);
                    }
                }.bind(this)
            });
        },

        _sendRevertRequestToBackend: function (sTableName, sRowId, sLogId) {
            var oView = this.getView();
            var oLocalModel = oView.getModel("audit");
            // Gọi Model mặc định (mainService) để bắn data vào bảng ZTEMP_DATA_GSP14
            var oMainModel = oView.getModel();

            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var oOriginalLog = aAllLogs.find(function (l) { return l.LogUuid === sLogId; });

            if (!oOriginalLog || !oOriginalLog.OldData || oOriginalLog.OldData === "") {
                sap.m.MessageBox.error("Không có dữ liệu gốc để khôi phục!");
                return;
            }

            oView.setBusy(true);

            // Mã hóa dữ liệu JSON thành chuỗi Base64
            var sBase64Data = btoa(unescape(encodeURIComponent(oOriginalLog.OldData)));

            // ===================================================================
            // CHÌA KHÓA NẰM Ở ĐÂY: Format ID sang chuẩn Edm.Guid (8-4-4-4-12)
            // ===================================================================
            var sFormattedUuid = sRowId;
            if (sFormattedUuid.length === 32 && sFormattedUuid.indexOf("-") === -1) {
                sFormattedUuid = sFormattedUuid.substring(0, 8) + "-" +
                    sFormattedUuid.substring(8, 12) + "-" +
                    sFormattedUuid.substring(12, 16) + "-" +
                    sFormattedUuid.substring(16, 20) + "-" +
                    sFormattedUuid.substring(20);
            }
            // OData V4 thường ưu tiên chữ thường cho GUID
            sFormattedUuid = sFormattedUuid.toLowerCase();

            if (oOriginalLog.Action === 'D') {
                // TRƯỜNG HỢP 1: REVERT LỆNH DELETE (CREATE LẠI DỮ LIỆU)
                var oFinalPayload = {
                    "table_name": sTableName.toUpperCase(),
                    "data": sBase64Data
                };
                var oListBinding = oMainModel.bindList("/Data");
                var oContext = oListBinding.create(oFinalPayload);

                oContext.created().then(function () {
                    oView.setBusy(false);
                    sap.m.MessageToast.show("Đã gửi yêu cầu Revert (Khôi phục bản ghi)! Vui lòng kiểm tra Approval.");
                    this._oTrailDialog.close();
                }.bind(this)).catch(function (oError) {
                    oView.setBusy(false);
                    if (oContext.isTransient()) { oContext.delete(); }
                    sap.m.MessageBox.error("Lỗi khi gửi yêu cầu Revert: " + oError.message);
                }.bind(this));

            } else {
                // TRƯỜNG HỢP 2: REVERT LỆNH UPDATE (GỬI LỆNH PATCH)
                var sPath = "/Data(uuid=" + sFormattedUuid + ")";

                // Gom nhóm request y hệt như file DetailData
                var oContextBinding = oMainModel.bindContext(sPath, null, {
                    $$updateGroupId: "updateGroup"
                });
                var oContext = oContextBinding.getBoundContext();

                oContext.setProperty("table_name", sTableName.toUpperCase());
                oContext.setProperty("data", sBase64Data);

                oMainModel.submitBatch("updateGroup").then(function () {
                    if (oMainModel.hasPendingChanges("updateGroup")) {
                        oView.setBusy(false);
                        sap.m.MessageBox.error("Lỗi: Yêu cầu cập nhật bị từ chối từ Backend.");
                        oMainModel.resetChanges("updateGroup");
                    } else {
                        oView.setBusy(false);
                        sap.m.MessageToast.show("Đã gửi yêu cầu Revert (Hoàn tác Update)! Vui lòng kiểm tra Approval.");
                        this._oTrailDialog.close();
                    }
                }.bind(this)).catch(function (oError) {
                    oView.setBusy(false);
                    sap.m.MessageBox.error("Lỗi hoàn tác Update: " + oError.message);
                }.bind(this));
            }
        }
    });
});