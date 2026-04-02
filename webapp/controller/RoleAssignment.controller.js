sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/layout/form/SimpleForm"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, SimpleForm) {
    "use strict";

    return Controller.extend("zapp.controller.RoleAssignment", {
        onInit: function () {
            var oData = {
                formData: {
                    isEditMode: false,
                    userId: "",
                    roleId: "Clerk",
                    validTo: ""
                }
            };
            var oLocalModel = new JSONModel(oData);
            this.getView().setModel(oLocalModel, "roleLocal");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true);
        },

        onSearchUser: function () {
            var sQuery = this.byId("searchUser").getValue();
            var sRoleKey = this.byId("filterRole").getSelectedKey();

            var aFilters = [];

            if (sQuery) {
                aFilters.push(new sap.ui.model.Filter("Username", sap.ui.model.FilterOperator.Contains, sQuery.toUpperCase()));
            }

            if (sRoleKey && sRoleKey !== "ALL") {
                if (sRoleKey === "Admin") {
                    aFilters.push(new sap.ui.model.Filter("IsAdmin", sap.ui.model.FilterOperator.EQ, true));
                } else if (sRoleKey === "Manager") {
                    aFilters.push(new sap.ui.model.Filter("IsManager", sap.ui.model.FilterOperator.EQ, true));
                } else if (sRoleKey === "Clerk") {
                    aFilters.push(new sap.ui.model.Filter("IsClerk", sap.ui.model.FilterOperator.EQ, true));
                }
            }

            var oTable = this.byId("usersTable");
            var oBinding = oTable.getBinding("items");

            if (oBinding) {
                oBinding.filter(aFilters, sap.ui.model.FilterType.Application);
            }
        },

        onOpenAssignDialog: function () {
            var oModel = this.getView().getModel("roleLocal");
            oModel.setProperty("/formData", { isEditMode: false, userId: "", roleId: "", validTo: "" });
            this._openRoleDialog("Assign New Role");
        },

        onEditRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("roleLocal");

            var sCurrentRole = "Clerk";
            if (oRowData.IsAdmin) sCurrentRole = "Admin";
            else if (oRowData.IsManager) sCurrentRole = "Manager";

            var sCurrentRole = "";
            if (oRowData.IsAdmin === true || oRowData.IsAdmin === 'true' || oRowData.IsAdmin === 'Yes') sCurrentRole = "Admin";
            else if (oRowData.IsManager === true || oRowData.IsManager === 'true' || oRowData.IsManager === 'Yes') sCurrentRole = "Manager";
            else if (oRowData.IsClerk === true || oRowData.IsClerk === 'true' || oRowData.IsClerk === 'Yes') sCurrentRole = "Clerk";

            oModel.setProperty("/formData", {
                isEditMode: true,
                userId: oRowData.Username,
                roleId: sCurrentRole,
                validTo: ""
            });

            this._openRoleDialog("Edit Role - User: " + oRowData.Username);
        },

        _openRoleDialog: function (sTitle) {
            if (!this._oRoleDialog) {
                this._oRoleDialog = new sap.m.Dialog({
                    contentWidth: "400px",
                    content: [
                        new SimpleForm({
                            layout: "ResponsiveGridLayout",
                            labelSpanL: 4, labelSpanM: 4, emptySpanL: 1, emptySpanM: 1, columnsL: 1, columnsM: 1,
                            content: [
                                new sap.m.Label({ text: "User Account", required: true }),
                                new sap.m.Input({
                                    value: "{roleLocal>/formData/userId}",
                                    placeholder: "e.g., DEV-097...",
                                    enabled: "{= !${roleLocal>/formData/isEditMode} }"
                                }),

                                new sap.m.Label({ text: "Assign Role", required: true }),
                                new sap.m.Select({
                                    selectedKey: "{roleLocal>/formData/roleId}",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "", text: "--- Select Role (Unassigned) ---" }),

                                        new sap.ui.core.Item({ key: "Admin", text: "Admin (Full Access)" }),
                                        new sap.ui.core.Item({ key: "Manager", text: "Manager (Approval)" }),
                                        new sap.ui.core.Item({ key: "Clerk", text: "Clerk (Employee)" })
                                    ]
                                }),

                                new sap.m.Label({ text: "Expiration Date" }),
                                new sap.m.DatePicker({
                                    value: "{roleLocal>/formData/validTo}",
                                    valueFormat: "yyyyMMdd",
                                    displayFormat: "dd/MM/yyyy",
                                    placeholder: "Leave blank = No expiration",
                                    minDate: new Date()
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Save (Assign Role)",
                        type: "Emphasized",
                        press: this.onSaveRole.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () { this._oRoleDialog.close(); }.bind(this)
                    })
                });
                this.getView().addDependent(this._oRoleDialog);
            }

            this._oRoleDialog.setTitle(sTitle);
            this._oRoleDialog.open();
        },

        onSaveRole: function () {
            var oView = this.getView();
            var oFormData = oView.getModel("roleLocal").getProperty("/formData");
            var sUserId = oFormData.userId;

            if (!sUserId) {
                sap.m.MessageBox.error("Please enter your User Account!");
                return;
            }

            if (!oFormData.roleId) {
                sap.m.MessageBox.error("Please select a Role to assign!");
                return;
            }

            // 1. LẤY NGÀY TRỰC TIẾP TỪ MODEL (Không cần tìm ID nữa)
            var sValidTo = oFormData.validTo;
            var sFormattedDate = "99991231";

            if (sValidTo && sValidTo.trim() !== "") {

                if (!/^\d{8}$/.test(sValidTo)) {
                    sap.m.MessageBox.error("Invalid expiration date! Please enter the correct format DD/MM/YYYY or select from the calendar icon.");
                    return;
                }

                sFormattedDate = sValidTo;

                var oToday = new Date();
                var sYear = oToday.getFullYear().toString();
                var sMonth = (oToday.getMonth() + 1).toString().padStart(2, '0');
                var sDay = oToday.getDate().toString().padStart(2, '0');
                var sTodayStr = sYear + sMonth + sDay;

                if (sFormattedDate < sTodayStr) {
                    sap.m.MessageBox.error("Please select an expiration date greater than or equal to the current date!");
                    return;
                }
            }

            // 2. CHUẨN BỊ ACTION NAME
            var sActionName = "";
            if (oFormData.roleId === "Admin") {
                sActionName = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignAdmin";
            } else if (oFormData.roleId === "Manager") {
                sActionName = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignManager";
            } else if (oFormData.roleId === "Clerk") {
                sActionName = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignClerk";
            }

            // 3. BIND ACTION & TRUYỀN THAM SỐ XUỐNG ABAP
            var sPath = "/UserRoleList('" + sUserId + "')/" + sActionName + "(...)";
            var oActionContext = oView.getModel().bindContext(sPath);

            oActionContext.setParameter("ValidTo", sFormattedDate);

            // 4. THỰC THI ACTION VÀ CHỜ BACKEND ABAP XỬ LÝ
            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                sap.m.MessageToast.show("Successfully assigned " + oFormData.roleId + " role to " + sUserId + "!");
                this._oRoleDialog.close();

                setTimeout(function () {
                    this.byId("usersTable").getBinding("items").refresh();
                    sap.ui.core.BusyIndicator.hide();
                }.bind(this), 1500);

            }.bind(this)).catch(function (oError) {
                sap.m.MessageBox.error("Error assigning role: " + oError.message);
                sap.ui.core.BusyIndicator.hide();
            });
        },

        onRevokeRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sUsername = oContext.getProperty("Username");

            sap.m.MessageBox.confirm("Are you sure you want to revoke the role for " + sUsername + "?", {
                onClose: function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        sap.ui.core.BusyIndicator.show(0);

                        var oOperation = oContext.getModel().bindContext("com.sap.gateway.srvd.zsd_dynamic_meta.v0001.revokeRole(...)", oContext);

                        oOperation.execute().then(function () {
                            sap.m.MessageToast.show("Successfully revoked role for " + sUsername + "!");

                            setTimeout(function () {
                                oContext.refresh();
                                sap.ui.core.BusyIndicator.hide();
                            }, 1500);

                        }).catch(function (oError) {
                            sap.m.MessageBox.error("Error revoking role: " + oError.message);
                            sap.ui.core.BusyIndicator.hide();
                        });
                    }
                }
            });
        }
    });
});