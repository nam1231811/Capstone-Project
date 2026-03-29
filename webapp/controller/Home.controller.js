sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("zapp.controller.Home", {
        onInit: function () {
        },

        onNavToApp: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain"); 
        },

        onNavToMyRequests: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMyRequests"); 
        },

        onNavToDashboard: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsClerk = oAuthModel.getProperty("/isClerk");
            var bIsAdmin = oAuthModel.getProperty("/isAdmin");

            if (bIsClerk && !bIsAdmin) {
                MessageBox.warning("Dashboard function is only available for Managers and Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteDashboard"); 
        },

        onNavToApproval: function () {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            
            if (oAuthModel.getProperty("/isClerk") && !oAuthModel.getProperty("/isAdmin") && !oAuthModel.getProperty("/isManager")) {
                MessageBox.warning("Approval function is only available for Managers and Admins!\nYou do not have permission to access!", {
                    title: "Access Denied"
                });
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteApproval"); 
        },

        onNavToAuditLog: function () {
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