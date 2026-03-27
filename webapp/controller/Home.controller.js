sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("zapp.controller.Home", {
        onInit: function () {
        },

        // Click vào App 1 (Hiện tại)
        onNavToApp: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain"); 
        },

        // Click vào Dashboard
        onNavToDashboard: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteDashboard"); 
        },

        // Click vào Approval
        onNavToApproval: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteApproval"); 
        },

        // Click vào Audit Log
        onNavToAuditLog: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteAuditLog"); 
        },

        // Click vào Role Assignment
        onNavToRoleAssignment: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteRoleAssignment"); 
        }
    });
});