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

            this._oTableFilters = {
                date: null,
                user: null,
                action: null
            };
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
            if (oBinding) {
                oBinding.filter([]);
            }

            if (this._pValueHelpDialog._oSearchField) {
                this._pValueHelpDialog._oSearchField.setValue("");
            }

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
                    if (oLog.Status !== 'P') {
                        var sAction = "UPDATE";
                        if (oLog.Action === 'C') sAction = "CREATE";
                        if (oLog.Action === 'D') sAction = "DELETE";

                        var sTime = DataFormatter.formatDateTime(oLog.ApprovedAt || oLog.ChangedAt);

                        var sDisplayKey = oLog.RecordKey; // Mặc định nếu lỗi thì vẫn hiện mã Hash
                        try {
                            // Ưu tiên lấy NewData, nếu xóa (Delete) không có NewData thì lấy OldData
                            var sJsonToParse = oLog.NewData ? oLog.NewData : oLog.OldData;
                            if (sJsonToParse) {
                                var oDataObj = JSON.parse(sJsonToParse);

                                // Lọc bỏ trường hệ thống MANDT
                                var aKeys = Object.keys(oDataObj).filter(k => k.toUpperCase() !== 'MANDT');

                                // Thuật toán dò tìm thông minh: Ưu tiên tìm cột có chữ 'ID' hoặc 'CODE'
                                // Nếu không có, mặc định lấy cột đầu tiên trong bảng
                                var sMainField = aKeys.find(k => {
                                    var sUpperK = k.toUpperCase();
                                    return sUpperK === 'ID' ||
                                        sUpperK === 'CODE' ||
                                        sUpperK.indexOf('_ID') !== -1 ||
                                        sUpperK.indexOf('_CODE') !== -1 ||
                                        sUpperK.indexOf('ID_') !== -1;
                                }) || aKeys[0];

                                if (sMainField && oDataObj[sMainField]) {
                                    // Sẽ tạo ra chuỗi đẹp mắt, VD: "ID: 47" hoặc "COMPANY_NAME: FPT"
                                    sDisplayKey = sMainField + ": " + oDataObj[sMainField];
                                }
                            }
                        } catch (e) {
                            // Bỏ qua lỗi parse JSON nếu có
                        }

                        aMainLogs.push({
                            rowId: oLog.RecordKey,
                            displayKey: sDisplayKey,
                            lastAction: sAction,
                            lastUser: oLog.ChangedBy,
                            lastTimestamp: sTime,
                            logUuid: oLog.LogUuid,
                            rawDate: new Date(oLog.ChangedAt)
                        });
                    }
                });
                oLocalModel.setProperty("/mainLogs", aMainLogs);


                //Filter unique users for User Filter Popover
                var aUniqueUsers = [];
                var oUserMap = {};

                aMainLogs.forEach(function (oLog) {
                    var sUser = oLog.lastUser;
                    if (sUser && !oUserMap[sUser]) {
                        oUserMap[sUser] = true;
                        aUniqueUsers.push({ userName: sUser });
                    }
                });
                oLocalModel.setProperty("/uniqueUsers", aUniqueUsers);

                //Filter unique actions for Action Filter Popover
                var aUniqueActions = [];
                var oActionMap = {};

                aMainLogs.forEach(function (oLog) {
                    var sActionStr = oLog.lastAction;
                    if (sActionStr && !oActionMap[sActionStr]) {
                        oActionMap[sActionStr] = true;
                        aUniqueActions.push({ actionName: sActionStr });
                    }
                });
                oLocalModel.setProperty("/uniqueActions", aUniqueActions);

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
            var sClickedLogUuid = oRowData.logUuid;

            var aAllLogs = oLocalModel.getProperty("/allLogs") || [];
            var aTrailLogs = aAllLogs.filter(function (l) { return l.RecordKey === sRowId; });

            // Sắp xếp theo thời gian
            aTrailLogs.sort(function (a, b) {
                return new Date(a.ChangedAt) - new Date(b.ChangedAt);
            });
            var aPhases = [];
            var aCurrentPhase = [];

            aTrailLogs.forEach(function (oLog) {
                if (oLog.Status !== 'P') {
                    aCurrentPhase.push(oLog);
                    if (oLog.Status === 'A') {
                        aPhases.push(aCurrentPhase);
                        aCurrentPhase = [];
                    }
                }
            });

            if (aCurrentPhase.length > 0) {
                aPhases.push(aCurrentPhase);
            }

            var aProcessNodes = [];
            var aProcessLanes = [];

            aPhases.forEach(function (phaseLogs) {
                phaseLogs.sort(function (a, b) {
                    return new Date(b.ChangedAt) - new Date(a.ChangedAt);
                });
            });

            aPhases.forEach(function (phaseLogs, phaseIndex) {
                var sLaneId = "lane_" + phaseIndex;

                aProcessLanes.push({
                    id: sLaneId,
                    icon: "sap-icon://process",
                    label: "Phase " + (phaseIndex + 1),
                    position: phaseIndex
                });

                phaseLogs.forEach(function (oLog, nodeIndex) {
                    var sAction = oLog.Action === 'C' ? 'Create' : (oLog.Action === 'U' ? 'Update' : 'Delete');
                    var sStatus = oLog.Status === 'A' ? 'Approved' : (oLog.Status === 'R' ? 'Rejected' : 'Pending');
                    var sTime = DataFormatter.formatDateTime(oLog.ChangedAt);
                    var sState = "";
                    switch (sStatus) {
                        case 'Approved':
                            sState = "Positive";
                            break;

                        case 'Rejected':
                            sState = "Negative";
                            break;

                        default:
                            sState = "Critical";
                            break;
                    }

                    var aChildren = [];
                    if (nodeIndex === 0 && phaseIndex < aPhases.length - 1) {

                        var aNextPhaseLogs = aPhases[phaseIndex + 1];

                        aNextPhaseLogs.forEach(function (oNextLog) {
                            aChildren.push(oNextLog.LogUuid);
                        });
                    }
                    var bIsTargetNode = (oLog.LogUuid === sClickedLogUuid);

                    aProcessNodes.push({
                        id: oLog.LogUuid,
                        lane: sLaneId,
                        title: "Request for: " + sAction + "Record",
                        titleAbbreviation: sAction.substring(0, 2).toUpperCase(),
                        children: aChildren,
                        state: sState,
                        status: sStatus,
                        texts: ["Approved Time: " + sTime, "Changed By: " + oLog.ChangedBy],
                        isHighlighted: bIsTargetNode,
                        isFocused: bIsTargetNode
                    });


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
        },

        onOpenDateFilter: function (oEvent) {
            var oButton = oEvent.getSource();
            var oPopover = this.getView().byId("dateFilterPopover");
            oPopover.openBy(oButton);
        },

        onApplyDateFilter: function () {
            var oDateRange = this.getView().byId("dateRangeFilter");
            var dStart = oDateRange.getDateValue();
            var dEnd = oDateRange.getSecondDateValue();

            if (dStart && dEnd) {
                dStart.setHours(0, 0, 0, 0);
                dEnd.setHours(23, 59, 59, 999);
                this._oTableFilters.date = new sap.ui.model.Filter({
                    path: "rawDate",
                    operator: sap.ui.model.FilterOperator.BT,
                    value1: dStart,
                    value2: dEnd
                });
            } else {
                this._oTableFilters.date = null;
            }

            this._applyCombinedFilters();
        },

        onClearDateFilter: function () {
            this.getView().byId("dateRangeFilter").setValue("");
            this._oTableFilters.date = null;
            this._applyCombinedFilters();
            this.getView().byId("dateFilterPopover").close();
        },

        onOpenUserFilter: function (oEvent) {
            var oButton = oEvent.getSource();
            var oPopover = this.getView().byId("userFilterPopover");
            oPopover.openBy(oButton);
        },

        onApplyUserFilter: function () {
            var oList = this.getView().byId("userFilterList");
            var aSelectedItems = oList.getSelectedItems();

            if (aSelectedItems.length > 0) {
                var aUserFilters = [];
                aSelectedItems.forEach(function (oItem) {
                    var sUserName = oItem.getBindingContext("audit").getProperty("userName");
                    aUserFilters.push(new sap.ui.model.Filter("lastUser", sap.ui.model.FilterOperator.EQ, sUserName));
                });

                this._oTableFilters.user = new sap.ui.model.Filter({
                    filters: aUserFilters,
                    and: false
                });
            } else {
                this._oTableFilters.user = null;
            }

            this._applyCombinedFilters();

            this.getView().byId("userFilterPopover").close();
        },

        onClearUserFilter: function () {
            this.getView().byId("userFilterList").removeSelections(true);
            this._oTableFilters.user = null;
            this._applyCombinedFilters();
            this.getView().byId("userFilterPopover").close();
        },

        onOpenActionFilter: function (oEvent) {
            var oButton = oEvent.getSource();
            var oPopover = this.getView().byId("actionFilterPopover");
            oPopover.openBy(oButton);
        },

        onApplyActionFilter: function () {
            var oList = this.getView().byId("actionFilterList");
            var aSelectedItems = oList.getSelectedItems();

            if (aSelectedItems.length > 0) {
                var aActionFilters = [];
                aSelectedItems.forEach(function (oItem) {
                    var sActionName = oItem.getBindingContext("audit").getProperty("actionName");
                    aActionFilters.push(new sap.ui.model.Filter("lastAction", sap.ui.model.FilterOperator.EQ, sActionName));
                });

                this._oTableFilters.action = new sap.ui.model.Filter({
                    filters: aActionFilters,
                    and: false
                });
            } else {
                this._oTableFilters.action = null;
            }

            this._applyCombinedFilters();
            this.getView().byId("actionFilterPopover").close();
        },

        onClearActionFilter: function () {
            this.getView().byId("actionFilterList").removeSelections(true);
            this._oTableFilters.action = null;
            this._applyCombinedFilters();
            this.getView().byId("actionFilterPopover").close();
        },

        _applyCombinedFilters: function () {
            var aFinalFilters = [];
            if (this._oTableFilters.date) {
                aFinalFilters.push(this._oTableFilters.date);
            }

            if (this._oTableFilters.user) {
                aFinalFilters.push(this._oTableFilters.user);
            }

            if (this._oTableFilters.action) {
                aFinalFilters.push(this._oTableFilters.action);
            }

            var oTable = this.getView().byId("auditMasterTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFinalFilters);
        },

        onClearAllFilters: function () {
            this._oTableFilters = {
                date: null,
                user: null,
                action: null
            };

            var oDateRange = this.getView().byId("dateRangeFilter");
            if (oDateRange) {
                oDateRange.setValue("");
            }

            var oUserList = this.getView().byId("userFilterList");
            if (oUserList) {
                oUserList.removeSelections(true);
            }

            var oActionList = this.getView().byId("actionFilterList");
            if (oActionList) {
                oActionList.removeSelections(true);
            }

            this._applyCombinedFilters();

            sap.m.MessageToast.show("All filters have been cleared.");
        },
    });
});