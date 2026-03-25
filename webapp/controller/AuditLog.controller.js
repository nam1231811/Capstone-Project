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
                selectedRowId: ""
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

        onSearchAuditLog: function(vEventOrString) {
            var sTableName = typeof vEventOrString === "string" ? vEventOrString : this.byId("auditSearchInput").getValue();
            var oModel = this.getView().getModel("audit");

            if (!sTableName || sTableName.trim() === "") {
                sap.m.MessageToast.show("Please enter the table name to search!");
                oModel.setProperty("/mainLogs", []);
                return;
            }

            this.getView().setBusy(true);

            // TODO: Thay đoạn setTimeout này bằng API gọi xuống Backend
            setTimeout(function() {
                var aMockMainLogs = [
                    { rowId: "11", lastAction: "UPDATE", lastUser: "DEV-092", lastTimestamp: "2026-03-25 10:05:22" },
                    { rowId: "9", lastAction: "DELETE", lastUser: "USER-01", lastTimestamp: "2026-03-25 09:15:00" },
                    { rowId: "2", lastAction: "CREATE", lastUser: "ADMIN", lastTimestamp: "2026-03-24 15:30:10" },
                    { rowId: "5", lastAction: "UPDATE", lastUser: "DEV-092", lastTimestamp: "2026-03-23 08:45:00" }
                ];
                oModel.setProperty("/mainLogs", aMockMainLogs);
                this.getView().setBusy(false);
                sap.m.MessageToast.show("Loaded audit log for table" + sTableName.toUpperCase());
            }.bind(this), 500);
        },

        onClearAuditSearch: function() {
            this.byId("auditSearchInput").setValue("");
            this.getView().getModel("audit").setProperty("/mainLogs", []);
        },

        onViewAuditTrail: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext("audit");
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("audit");
            
            oModel.setProperty("/selectedRowId", oRowData.rowId);

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

            this.getView().setBusy(true);

            //MOCK DATA
            setTimeout(function() {
                var aMockTrail = [
                    { 
                        logId: "L103", timestamp: "2026-03-25 10:05:22", user: "DEV-092", action: "UPDATE", 
                        changes: [
                            { field: "Thành phố (CITY)", oldValue: "Ha Noi", newValue: "Da Nang" },
                            { field: "Lương (SALARY)", oldValue: "15.000.000", newValue: "20.500.000" }
                        ]
                    },
                    { 
                        logId: "L102", timestamp: "2026-03-20 14:10:00", user: "USER-01", action: "UPDATE", 
                        changes: [
                            { field: "Phòng ban (DEPARTMENT)", oldValue: "IT", newValue: "System Architecture" }
                        ]
                    },
                    { 
                        logId: "L101", timestamp: "2026-03-01 08:30:00", user: "ADMIN", action: "CREATE", 
                        changes: [
                            { field: "Toàn bộ dữ liệu", oldValue: "-", newValue: "Tạo mới bản ghi" }
                        ]
                    }
                ];
                
                oModel.setProperty("/currentTrail", aMockTrail);
                this.getView().setBusy(false);
                this._oTrailDialog.open();
            }.bind(this), 600);
        },

        onRequestRevert: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext("audit");
            var oLogEntry = oContext.getObject();
            var sTableName = this.byId("auditSearchInput").getValue();
            var sRowId = this.getView().getModel("audit").getProperty("/selectedRowId");

            var sMessage = "You are about to revert the record [ID: " + sRowId + "] to the state at: " + oLogEntry.timestamp + ".\n\n" +
                           "Data to be restored: " + oLogEntry.changes + "\n\n" +
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

        _sendRevertRequestToBackend: function(sTableName, sRowId, sLogId) {
            // TODO: Viết API POST gửi yêu cầu duyệt Revert xuống Workflow/Approval Table của ABAP
            // VD: ApprovalAPI.postRevertRequest(sTableName, sRowId, sLogId).then(...)
            sap.m.MessageToast.show("Đã gửi yêu cầu Revert cho Manager duyệt thành công!");
            this._oTrailDialog.close();
        }
    });
});