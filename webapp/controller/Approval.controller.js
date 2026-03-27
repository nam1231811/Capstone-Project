sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("zapp.controller.Approval", {
        onInit: function () {
            var sUserRole = "Manager"; 
            
            var oAuthModel = new JSONModel({
                isManager: sUserRole === "Manager",
                isClerk: sUserRole !== "Manager",
                currentUser: "MNGR-001"
            });
            this.getView().setModel(oAuthModel, "auth");

            var aPendingList = [
                { reqId: "REQ-001", tableName: "ZEMPLOYEE_105", action: "UPDATE", requestedBy: "DEV-092", requestedAt: "2026-03-25 10:00:00", 
                  diff: [
                      { field: "Thành phố", oldData: "Ha Noi", newData: "Da Nang" },
                      { field: "Phòng ban", oldData: "IT", newData: "Marketing" }
                  ] 
                },
                { reqId: "REQ-002", tableName: "ZCOURSE_DEV335", action: "CREATE", requestedBy: "USER-01", requestedAt: "2026-03-25 09:30:00", 
                  diff: [
                      { field: "Khóa học", oldData: "-", newData: "SAP ABAP RAP" },
                      { field: "Thời lượng", oldData: "-", newData: "40 Giờ" }
                  ] 
                },
                { reqId: "REQ-003", tableName: "ZEMPLOYEE_105", action: "DELETE", requestedBy: "DEV-092", requestedAt: "2026-03-24 16:15:00", 
                  diff: [
                      { field: "Row ID", oldData: "EMP_99", newData: "Xóa toàn bộ dòng" }
                  ] 
                }
            ];

            var aHistoryList = [
                { reqId: "REQ-000", tableName: "ZDEPARTMENT", action: "UPDATE", status: "APPROVED", processedAt: "2026-03-23 14:00:00", processedBy: "MNGR-001" },
                { reqId: "REQ-099", tableName: "ZCONFIG", action: "DELETE", status: "REJECTED", processedAt: "2026-03-22 09:10:00", processedBy: "MNGR-002" }
            ];

            var oApprovalModel = new JSONModel({
                pendingList: aPendingList,
                historyList: aHistoryList,
                pendingCount: aPendingList.length,
                historyCount: aHistoryList.length,
                currentDetail: null
            });
            this.getView().setModel(oApprovalModel, "approval");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true); 
        },

        onActionFilterSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            var oTable = this.byId("pendingTable");
            var oBinding = oTable.getBinding("items");

            if (sKey === "ALL") {
                oBinding.filter([]);
            } else {
                oBinding.filter([new Filter("action", FilterOperator.EQ, sKey)]);
            }
        },

        onViewDiffDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("approval");
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("approval");
            
            oModel.setProperty("/currentDetail", oRowData);

            if (!this._oDiffDialog) {
                this._oDiffDialog = new sap.m.Dialog({
                    title: "Approval Detail - Request: {approval>/currentDetail/reqId}",
                    contentWidth: "800px",
                    resizable: true,
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.HBox({
                                    justifyContent: "SpaceBetween",
                                    class: "sapUiMediumMarginBottom",
                                    items: [
                                        new sap.m.Label({ text: "Data Table: {approval>/currentDetail/tableName}", design: "Bold" }),
                                        new sap.m.ObjectStatus({
                                            text: "{approval>/currentDetail/action}",
                                            state: "{= ${approval>/currentDetail/action} === 'CREATE' ? 'Success' : (${approval>/currentDetail/action} === 'DELETE' ? 'Error' : 'Warning') }"
                                        })
                                    ]
                                }),
                                
                                new sap.m.Table({
                                    backgroundDesign: "Solid",
                                    items: {
                                        path: "approval>/currentDetail/diff",
                                        template: new sap.m.ColumnListItem({
                                            cells: [
                                                new sap.m.Text({ text: "{approval>field}", design: "Bold" }),
                                                new sap.m.Text({ text: "{approval>oldData}" }),
                                                new sap.m.ObjectStatus({ 
                                                    text: "{approval>newData}", 
                                                    state: "Success",
                                                    icon: "sap-icon://sys-enter-2"
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
                            new sap.m.Title({ text: "Check Data" }),
                            new sap.m.ToolbarSpacer(),
                            new sap.m.Button({ icon: "sap-icon://decline", press: function() { this._oDiffDialog.close(); }.bind(this) })
                        ]
                    })
                });
                this.getView().addDependent(this._oDiffDialog);
            }

            this._oDiffDialog.open();
        },

        onApproveRequest: function () {
            this._processRequest("APPROVED");
        },

        onRejectRequest: function () {
            this._processRequest("REJECTED");
        },

        _processRequest: function (sStatus) {
            var oModel = this.getView().getModel("approval");
            var oCurrentReq = oModel.getProperty("/currentDetail");
            var aPending = oModel.getProperty("/pendingList");
            var aHistory = oModel.getProperty("/historyList");
            var sCurrentUser = this.getView().getModel("auth").getProperty("/currentUser");

            // TODO: Gọi API lưu DB thực tế (SE16N) nếu Approve, hoặc hủy bỏ nếu Reject.
            // VD: ApprovalAPI.submit(oCurrentReq.reqId, sStatus)...

            var aNewPending = aPending.filter(function(item) { return item.reqId !== oCurrentReq.reqId; });
            
            aHistory.unshift({
                reqId: oCurrentReq.reqId,
                tableName: oCurrentReq.tableName,
                action: oCurrentReq.action,
                status: sStatus,
                processedAt: new Date().toLocaleString(),
                processedBy: sCurrentUser
            });

            oModel.setProperty("/pendingList", aNewPending);
            oModel.setProperty("/historyList", aHistory);
            oModel.setProperty("/pendingCount", aNewPending.length);
            oModel.setProperty("/historyCount", aHistory.length);

            this._oDiffDialog.close();

            var sMsg = sStatus === "APPROVED" 
                ? "Request approved " + oCurrentReq.reqId + ". Data saved to database." 
                : "Request rejected " + oCurrentReq.reqId + ".";
            MessageToast.show(sMsg);
        }
    });
});