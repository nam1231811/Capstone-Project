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
            oModel.setProperty("/formData", { isEditMode: false, userId: "", roleId: "Clerk", validTo: "" });
            this._openRoleDialog("Assign New Role");
        },

        onEditRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("roleLocal");

            var sCurrentRole = "Clerk";
            if (oRowData.IsAdmin) sCurrentRole = "Admin";
            else if (oRowData.IsManager) sCurrentRole = "Manager";

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
            var oLocalModel = this.getView().getModel("roleLocal");
            var oFormData = oLocalModel.getProperty("/formData");
            var sUserId = oFormData.userId.toUpperCase();
            var sValidTo = oFormData.validTo || "";

            if (!sUserId) {
                MessageBox.error("Please enter a system Username!");
                return;
            }

            if (sValidTo !== "") {
                var oToday = new Date();
                var sYear = oToday.getFullYear().toString();
                var sMonth = (oToday.getMonth() + 1).toString().padStart(2, '0');
                var sDay = oToday.getDate().toString().padStart(2, '0');
                var sTodayYYYYMMDD = sYear + sMonth + sDay;

                if (sValidTo < sTodayYYYYMMDD) {
                    MessageBox.error("Error: Expiration date cannot be in the past!");
                    return;
                }
            }

            sap.ui.core.BusyIndicator.show(0);
            var oODataModel = this.getView().getModel();

            var sActionName = "";
            if (oFormData.roleId === "Admin") sActionName = "assignAdmin";
            else if (oFormData.roleId === "Manager") sActionName = "assignManager";
            else if (oFormData.roleId === "Clerk") sActionName = "assignClerk";

            var sActionPath = "/UserRoleList('" + sUserId + "')/com.sap.gateway.srvd.zsd_dynamic_meta.v0001." + sActionName + "(...)";
            var oActionContext = oODataModel.bindContext(sActionPath);

            oActionContext.setParameter("ValidTo", sValidTo);

            oActionContext.execute().then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Successfully assigned " + oFormData.roleId + " role to " + sUserId + "!");

                this.byId("usersTable").getBinding("items").refresh();
                this._oRoleDialog.close();

            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Role assignment error: " + (oError.message || "User does not exist or system error."));
            });
        },

        onRevokeRole: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext();

            if (!oContext) return;

            var sUsername = oContext.getProperty("Username");

            var sValidity = oContext.getProperty("ValidityText");
            if (sValidity === "Unassigned") {
                sap.m.MessageBox.information("User '" + sUsername + "' currently has no role to revoke!");
                return;
            }

            sap.m.MessageBox.confirm(
                "This action will immediately revoke all tool permissions for User '" + sUsername + "'.\n\nAre you sure you want to revoke the role?",
                {
                    title: "Security Warning",
                    icon: sap.m.MessageBox.Icon.WARNING,
                    actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    emphasizedAction: sap.m.MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === sap.m.MessageBox.Action.YES) {

                            sap.ui.core.BusyIndicator.show(0);

                            var oOperation = oContext.getModel().bindContext("com.sap.gateway.srvd.zsd_dynamic_meta.v0001.revokeRole(...)", oContext);

                            oOperation.execute().then(function () {
                                sap.ui.core.BusyIndicator.hide();
                                sap.m.MessageToast.show("Successfully revoked role for " + sUsername + "!");
                                oContext.refresh();
                            }).catch(function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                sap.m.MessageBox.error("Error revoking role: " + oError.message);
                            });
                        }
                    }
                }
            );
        }
    });
});