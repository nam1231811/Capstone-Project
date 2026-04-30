sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    const ACTION_ASSIGN_ADMIN = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignAdmin";
    const ACTION_ASSIGN_MANAGER = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignManager";
    const ACTION_ASSIGN_CLERK = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.assignClerk";
    const ACTION_REVOKE_ROLE = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.revokeRole(...)";

    return Controller.extend("zapp.controller.RoleAssignment", {
        onInit: function () {
            var oData = {
                    dialogTitle: "",
                    formData: {
                        isEditMode: false,
                        userId: "",
                        roleId: "Clerk",
                        validTo: ""
                    }
                },
                oLocalModel = new JSONModel(oData),
                oRouter = this.getOwnerComponent().getRouter();

            this.getView().setModel(oLocalModel, "roleLocal");

            if (oRouter.getRoute("RouteRoleAssignment")) {
                oRouter.getRoute("RouteRoleAssignment").attachPatternMatched(this._onRouteMatched, this);
            }
        },

        _onRouteMatched: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");

            if (!oAuthModel.getProperty("/isAdmin")) {
                MessageBox.error("Access Denied! You do not have permission to view this page.");
                this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
                return;
            }
        },

        _checkRoleTrue: function (val) {
            return val === true || val === 'Yes' || val === 'true' || val === 'X';
        },

        formatterRoleText: function (isAdmin, isManager, isClerk) {
            if (this._checkRoleTrue(isAdmin)) return 'Admin (Full Access)';
            if (this._checkRoleTrue(isManager)) return 'Manager';
            if (this._checkRoleTrue(isClerk)) return 'Clerk';
            return 'Unassigned';
        },

        formatterRoleIcon: function (isAdmin, isManager, isClerk) {
            if (this._checkRoleTrue(isAdmin)) return 'sap-icon://unlocked';
            if (this._checkRoleTrue(isManager)) return 'sap-icon://manager';
            if (this._checkRoleTrue(isClerk)) return 'sap-icon://employee';
            return 'sap-icon://sys-enter-2';
        },

        formatterRoleState: function (isAdmin, isManager, isClerk) {
            if (this._checkRoleTrue(isAdmin)) return 'Error';
            if (this._checkRoleTrue(isManager)) return 'Success';
            if (this._checkRoleTrue(isClerk)) return 'Warning';
            return 'Information';
        },

        formatterAvatarColor: function (isAdmin, isManager, isClerk) {
            if (this._checkRoleTrue(isAdmin)) return 'Accent2';
            if (this._checkRoleTrue(isManager)) return 'Accent3';
            if (this._checkRoleTrue(isClerk)) return 'Accent6';
            return 'Accent1';
        },

        formatterEnableDelete: function (isAdmin, isManager, isClerk) {
            return this._checkRoleTrue(isAdmin) || this._checkRoleTrue(isManager) || this._checkRoleTrue(isClerk);
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHome", {}, true);
        },

        onSearchUser: function () {
            var sQuery = this.byId("searchUser").getValue(),
                sRoleKey = this.byId("filterRole").getSelectedKey(),
                aFilters = [],
                oTable = this.byId("usersTable"),
                oBinding = oTable.getBinding("items");

            if (sQuery) {
                aFilters.push(new Filter("Username", FilterOperator.Contains, sQuery.toUpperCase()));
            }

            if (sRoleKey && sRoleKey !== "ALL") {
                if (sRoleKey === "Admin") {
                    aFilters.push(new Filter("IsAdmin", FilterOperator.EQ, true));
                } else if (sRoleKey === "Manager") {
                    aFilters.push(new Filter("IsManager", FilterOperator.EQ, true));
                } else if (sRoleKey === "Clerk") {
                    aFilters.push(new Filter("IsClerk", FilterOperator.EQ, true));
                }
            }

            if (oBinding) {
                oBinding.filter(aFilters, sap.ui.model.FilterType.Application);
            }
        },

        onOpenAssignDialog: function () {
            var oModel = this.getView().getModel("roleLocal");
            oModel.setProperty("/dialogTitle", "Assign New Role");
            oModel.setProperty("/formData", { isEditMode: false, userId: "", roleId: "", validTo: "" });
            
            this.byId("roleDialog").open();
        },

        onEditRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext(),
                oRowData = oContext.getObject(),
                oModel = this.getView().getModel("roleLocal"),
                oAuthModel = this.getOwnerComponent().getModel("auth"),
                sCurrentUser = oAuthModel ? oAuthModel.getProperty("/currentUser") : "",
                sCurrentRole = "";

            if (sCurrentUser && oRowData.Username && sCurrentUser.toUpperCase() === oRowData.Username.toUpperCase()) {
                MessageBox.warning("Action Denied!\nYou cannot modify your own system role.");
                return;
            }

            if (this._checkRoleTrue(oRowData.IsAdmin)) sCurrentRole = "Admin";
            else if (this._checkRoleTrue(oRowData.IsManager)) sCurrentRole = "Manager";
            else if (this._checkRoleTrue(oRowData.IsClerk)) sCurrentRole = "Clerk";

            oModel.setProperty("/dialogTitle", "Edit Role - User: " + oRowData.Username);
            oModel.setProperty("/formData", {
                isEditMode: true,
                userId: oRowData.Username,
                roleId: sCurrentRole,
                validTo: ""
            });

            this.byId("roleDialog").open();
        },

        onCloseRoleDialog: function () {
            this.byId("roleDialog").close();
        },

        onSaveRole: function () {
            var oView = this.getView(),
                oFormData = oView.getModel("roleLocal").getProperty("/formData"),
                sUserId = oFormData.userId,
                sValidTo = oFormData.validTo,
                sFormattedDate = "99991231",
                sActionName = "", sPath, oActionContext,
                oToday, sYear, sMonth, sDay, sTodayStr;

            if (!sUserId) {
                MessageBox.error("Please enter your User Account!");
                return;
            }

            if (!oFormData.roleId) {
                MessageBox.error("Please select a Role to assign!");
                return;
            }

            if (sValidTo && sValidTo.trim() !== "") {
                if (!/^\d{8}$/.test(sValidTo)) {
                    MessageBox.error("Invalid expiration date! Please enter the correct format DD/MM/YYYY or select from the calendar icon.");
                    return;
                }

                sFormattedDate = sValidTo;
                oToday = new Date();
                sYear = oToday.getFullYear().toString();
                sMonth = (oToday.getMonth() + 1).toString().padStart(2, '0');
                sDay = oToday.getDate().toString().padStart(2, '0');
                sTodayStr = sYear + sMonth + sDay;

                if (sFormattedDate < sTodayStr) {
                    MessageBox.error("Please select an expiration date greater than or equal to the current date!");
                    return;
                }
            }

            if (oFormData.roleId === "Admin") sActionName = ACTION_ASSIGN_ADMIN;
            else if (oFormData.roleId === "Manager") sActionName = ACTION_ASSIGN_MANAGER;
            else if (oFormData.roleId === "Clerk") sActionName = ACTION_ASSIGN_CLERK;

            sPath = "/UserRoleList('" + sUserId + "')/" + sActionName + "(...)";
            oActionContext = oView.getModel().bindContext(sPath);

            oActionContext.setParameter("ValidTo", sFormattedDate);

            sap.ui.core.BusyIndicator.show(0);

            oActionContext.execute().then(function () {
                MessageToast.show("Successfully assigned " + oFormData.roleId + " role to " + sUserId + "!");
                this.onCloseRoleDialog();

                setTimeout(function () {
                    this.byId("usersTable").getBinding("items").refresh();
                    sap.ui.core.BusyIndicator.hide();
                }.bind(this), 1500);

            }.bind(this)).catch(function (oError) {
                MessageBox.error("Error assigning role: " + oError.message);
                sap.ui.core.BusyIndicator.hide();
            });
        },

        onRevokeRole: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext(),
                sUsername = oContext.getProperty("Username"),
                oAuthModel = this.getOwnerComponent().getModel("auth"),
                sCurrentUser = oAuthModel ? oAuthModel.getProperty("/currentUser") : "";

            if (sCurrentUser && sUsername && sCurrentUser.toUpperCase() === sUsername.toUpperCase()) {
                MessageBox.warning("Action Denied!\nYou cannot revoke your own system role.");
                return;
            }

            MessageBox.confirm("Are you sure you want to revoke the role for " + sUsername + "?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        sap.ui.core.BusyIndicator.show(0);

                        var oOperation = oContext.getModel().bindContext(ACTION_REVOKE_ROLE, oContext);

                        oOperation.execute().then(function () {
                            MessageToast.show("Successfully revoked role for " + sUsername + "!");

                            setTimeout(function () {
                                this.byId("usersTable").getBinding("items").refresh();
                                sap.ui.core.BusyIndicator.hide();
                            }.bind(this), 1500);

                        }.bind(this)).catch(function (oError) {
                            MessageBox.error("Error revoking role: " + oError.message);
                            sap.ui.core.BusyIndicator.hide();
                        });
                    }
                }.bind(this)
            });
        }
    });
});