sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("zapp.controller.Home", {
        onInit: function () {
        },

        _checkHasRole: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");
            var bIsManager = oAuthModel.getProperty("/isManager");
            var bIsClerk = oAuthModel.getProperty("/isClerk");

            if (!bIsAdmin && !bIsManager && !bIsClerk) {
                MessageBox.error("You are currently Unassigned!\nPlease contact the IT Administrator to request system access.", {
                    title: "Access Denied"
                });
                return false;
            }
            return true;
        },

        onNavToApp: function () {
            // Chặn ngay từ cửa nếu không có role
            if (!this._checkHasRole()) return;

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain");
        },

        onNavToMyRequests: function () {
            // Chặn ngay từ cửa nếu không có role
            if (!this._checkHasRole()) return;

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMyRequests");
        },

        onNavToDashboard: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (!bIsAdmin) {
                MessageBox.warning("Dashboard function is only available for Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteDashboard");
        },

        onNavToApproval: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");
            var bIsManager = oAuthModel.getProperty("/isManager");

            if (!bIsAdmin && !bIsManager) {
                sap.m.MessageBox.warning("Approval function is only available for Managers and Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteApproval");
        },

        onNavToAuditLog: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (!bIsAdmin) {
                MessageBox.warning("Audit Log function is only available for Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteAuditLog");
        },

        onNavToRoleAssignment: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (!bIsAdmin) {
                sap.m.MessageBox.warning("Role Assignment function is only available for Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteRoleAssignment");
        }
    });
});