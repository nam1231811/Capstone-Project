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
                userList: [
                    { userId: "DEV-092", fullName: "Nguyễn Văn Dev", department: "IT", roleId: "Manager", roleName: "Manager", validTo: "Indefinite" },
                    { userId: "USER-01", fullName: "Trần Thị Clerk", department: "HR", roleId: "Clerk", roleName: "Clerk", validTo: "31/12/2026" },
                    { userId: "USER-05", fullName: "Lê Văn System", department: "Finance", roleId: "Viewer", roleName: "Viewer", validTo: "30/06/2026" }
                ],
                formData: {
                    isEditMode: false,
                    userId: "",
                    fullName: "",
                    roleId: "Clerk",
                    validTo: ""
                }
            };

            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "role");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true); 
        },

        onSearchUser: function () {
            var sQuery = this.byId("searchUser").getValue();
            var sRoleFilter = this.byId("filterRole").getSelectedKey();
            var aFilters = [];

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("userId", FilterOperator.Contains, sQuery),
                        new Filter("fullName", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            if (sRoleFilter && sRoleFilter !== "ALL") {
                aFilters.push(new Filter("roleId", FilterOperator.EQ, sRoleFilter));
            }

            var oTable = this.byId("usersTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        onOpenAssignDialog: function () {
            var oModel = this.getView().getModel("role");
            oModel.setProperty("/formData", { isEditMode: false, userId: "", fullName: "", roleId: "Clerk", validTo: "" });
            this._openRoleDialog("Assign New Role");
        },

        onEditRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("role");
            var oRowData = oContext.getObject();
            var oModel = this.getView().getModel("role");

            oModel.setProperty("/formData", {
                isEditMode: true,
                userId: oRowData.userId,
                fullName: oRowData.fullName,
                roleId: oRowData.roleId,
                validTo: oRowData.validTo
            });

            this._openRoleDialog("Update Role - User: " + oRowData.userId);
        },

        _openRoleDialog: function (sTitle) {
            if (!this._oRoleDialog) {
                this._oRoleDialog = new sap.m.Dialog({
                    contentWidth: "500px",
                    content: [
                        new SimpleForm({
                            layout: "ResponsiveGridLayout",
                            labelSpanL: 4, labelSpanM: 4, emptySpanL: 1, emptySpanM: 1,
                            columnsL: 1, columnsM: 1,
                            content: [
                                new sap.m.Label({ text: "User ID", required: true }),
                                new sap.m.Input({ 
                                    value: "{role>/formData/userId}", 
                                    placeholder: "Enter User ID...", 
                                    enabled: "{= !${role>/formData/isEditMode} }"
                                }),

                                new sap.m.Label({ text: "Role", required: true }),
                                new sap.m.Select({
                                    selectedKey: "{role>/formData/roleId}",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Manager", text: "Manager" }),
                                        new sap.ui.core.Item({ key: "Clerk", text: "Clerk" }),
                                        new sap.ui.core.Item({ key: "Viewer", text: "Viewer" })
                                    ]
                                }),

                                new sap.m.Label({ text: "Expiry Date" }),
                                new sap.m.DatePicker({
                                    value: "{role>/formData/validTo}",
                                    valueFormat: "dd/MM/yyyy",
                                    displayFormat: "dd/MM/yyyy",
                                    placeholder: "Leave blank for indefinite"
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Save",
                        type: "Emphasized",
                        press: this.onSaveRole.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            this._oRoleDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._oRoleDialog);
            }

            this._oRoleDialog.setTitle(sTitle);
            this._oRoleDialog.open();
        },

        onSaveRole: function () {
            var oModel = this.getView().getModel("role");
            var oFormData = oModel.getProperty("/formData");
            var aUserList = oModel.getProperty("/userList");

            if (!oFormData.userId) {
                sap.m.MessageBox.error("Please enter a User ID!");
                return;
            }

            var sRoleName = "Viewer";
            if (oFormData.roleId === "Manager") sRoleName = "Manager";
            if (oFormData.roleId === "Clerk") sRoleName = "Clerk";

            var sValidTo = oFormData.validTo ? oFormData.validTo : "Indefinite";

            if (oFormData.isEditMode) {
                var iIndex = aUserList.findIndex(function(u) { return u.userId === oFormData.userId; });
                if (iIndex > -1) {
                    aUserList[iIndex].roleId = oFormData.roleId;
                    aUserList[iIndex].roleName = sRoleName;
                    aUserList[iIndex].validTo = sValidTo;
                }
                MessageToast.show("Updated role for " + oFormData.userId);
            } else {
                aUserList.unshift({
                    userId: oFormData.userId.toUpperCase(),
                    fullName: "Name not updated",
                    department: "N/A",
                    roleId: oFormData.roleId,
                    roleName: sRoleName,
                    validTo: sValidTo
                });
                MessageToast.show("Successfully assigned role for " + oFormData.userId);
            }

            oModel.setProperty("/userList", aUserList);
            this._oRoleDialog.close();
        },

        onRevokeRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("role");
            var sUserId = oContext.getProperty("userId");
            var oModel = this.getView().getModel("role");
            var aUserList = oModel.getProperty("/userList");

            MessageBox.confirm("Are you sure you want to revoke all permissions for User [" + sUserId + "]?", {
                title: "Confirm Revoke",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        var aNewList = aUserList.filter(function(u) { return u.userId !== sUserId; });
                        oModel.setProperty("/userList", aNewList);
                        MessageToast.show("Successfully revoked permissions for " + sUserId);
                    }
                }
            });
        }
    });
});