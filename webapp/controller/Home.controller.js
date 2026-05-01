sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("zapp.controller.Home", {
        
        onInit: function () {
        },

        _getAuthProp: function (sProp) {
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            return oAuthModel ? oAuthModel.getProperty(sProp) : false;
        },

        _navIfPermitted: function (sRoute, bHasPermission, sErrMsg, sMsgType) {
            var oRouter = this.getOwnerComponent().getRouter(),
                sType = sMsgType || "warning";

            if (!bHasPermission) {
                MessageBox[sType](sErrMsg, { title: "Access Denied" });
                return;
            }
            
            oRouter.navTo(sRoute);
        },

        onNavToApp: function () {
            var bHasRole = this._getAuthProp("/isAdmin") || this._getAuthProp("/isManager") || this._getAuthProp("/isClerk"),
                sMsg = "You are currently Unassigned!\nPlease contact the IT Administrator to request system access.";
            
            this._navIfPermitted("RouteMain", bHasRole, sMsg, "error");
        },

        onNavToMyRequests: function () {
            var bHasRole = this._getAuthProp("/isAdmin") || this._getAuthProp("/isManager") || this._getAuthProp("/isClerk"),
                sMsg = "You are currently Unassigned!\nPlease contact the IT Administrator to request system access.";
            
            this._navIfPermitted("RouteMyRequests", bHasRole, sMsg, "error");
        },

        onNavToDashboard: function () {
            var bIsAdmin = this._getAuthProp("/isAdmin"),
                sMsg = "Dashboard function is only available for Admins!\nYou do not have permission to access!";
            
            this._navIfPermitted("RouteDashboard", bIsAdmin, sMsg);
        },

        onNavToApproval: function () {
            var bHasPerm = this._getAuthProp("/isAdmin") || this._getAuthProp("/isManager"),
                sMsg = "Approval function is only available for Managers and Admins!\nYou do not have permission to access!";
            
            this._navIfPermitted("RouteApproval", bHasPerm, sMsg);
        },

        onNavToAuditLog: function () {
            var bIsAdmin = this._getAuthProp("/isAdmin"),
                sMsg = "Audit Log function is only available for Admins!\nYou do not have permission to access!";
            
            this._navIfPermitted("RouteAuditLog", bIsAdmin, sMsg);
        },

        onNavToRoleAssignment: function () {
            var bIsAdmin = this._getAuthProp("/isAdmin"),
                sMsg = "Role Assignment function is only available for Admins!\nYou do not have permission to access!";
            
            this._navIfPermitted("RouteRoleAssignment", bIsAdmin, sMsg);
        }
    });
});