sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("zapp.Component", {
        metadata: {
            manifest: "json"
        },
        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            var oFCLModel = new JSONModel({
                layout: "OneColumn"
            });
            this.setModel(oFCLModel, "fclModel");

            this._initAuthModel();

            this.getRouter().initialize();
        },

        _initAuthModel: function() {
            var oAuthModel = new JSONModel({
                isClerk: true,
                isManager: false,
                isAdmin: false,
                currentUser: ""
            });
            this.setModel(oAuthModel, "auth");

            let sCurrentUserId = sap.ushell.Container.getUser().getId();
            if (sap.ushell && sap.ushell.Container) { 
                sCurrentUserId = sap.ushell.Container.getUser().getId();
                if (sCurrentUserId === "DEFAULT_USER"){
                    // 94 manager, 097 admin, 092 clerk
                    sCurrentUserId = "DEV-094"; 
                }
            }
            sCurrentUserId = sCurrentUserId.toUpperCase(); 
            oAuthModel.setProperty("/currentUser", sCurrentUserId);
            console.log("Current User ID: ", sCurrentUserId);

            var oODataModel = this.getModel(); 
            if (oODataModel) {
                var oContextBinding = oODataModel.bindContext("/UserRoleList('" + sCurrentUserId + "')");
                oContextBinding.requestObject().then(function(oData) {
                    console.log("User roles: ", oData);
                    
                    oAuthModel.setProperty("/isClerk", oData.IsClerk);
                    oAuthModel.setProperty("/isManager", oData.IsManager);
                    oAuthModel.setProperty("/isAdmin", oData.IsAdmin);
                    
                }).catch(function(e) {
                    console.error("Error fetching user roles: ", e);
                });
            } else {
                console.error("OData Model not found!");
            }
        }
    });
});