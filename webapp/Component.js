sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator"
], function (UIComponent, JSONModel, BusyIndicator) {
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

            BusyIndicator.show(0);

            this._initAuthModel().then(function () {
                BusyIndicator.hide();
                this.getRouter().initialize();
            }.bind(this)).catch(function (error) {
                BusyIndicator.hide();
                this.getRouter().initialize();
                console.error("Lỗi khi tải quyền user:", error);
            }.bind(this));
        },

        _initAuthModel: function () {
            var that = this;

            return new Promise(function (resolve, reject) {
                
                var oAuthModel = new JSONModel({
                    isClerk: false,
                    isManager: false,
                    isAdmin: false,
                    currentUser: ""
                });
                that.setModel(oAuthModel, "auth");

                let sCurrentUserId = "DEFAULT_USER";
                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUserId = sap.ushell.Container.getUser().getId();
                }
                if (sCurrentUserId === "DEFAULT_USER") {
                    // 94 manager, 097 admin, 092 clerk
                    sCurrentUserId = "DEV-097";
                }
                
                sCurrentUserId = sCurrentUserId.toUpperCase();
                oAuthModel.setProperty("/currentUser", sCurrentUserId);
                console.log("Current User ID: ", sCurrentUserId);

                var oODataModel = that.getModel();
                if (oODataModel) {
                    var oContextBinding = oODataModel.bindContext("/UserRoleList('" + sCurrentUserId + "')");
                    
                    oContextBinding.requestObject().then(function (oData) {
                        console.log("User roles: ", oData);

                        oAuthModel.setProperty("/isClerk", oData.IsClerk);
                        oAuthModel.setProperty("/isManager", oData.IsManager);
                        oAuthModel.setProperty("/isAdmin", oData.IsAdmin);

                        resolve();

                    }).catch(function (e) {
                        console.error("Error fetching user roles: ", e);
                        resolve(); 
                    });
                } else {
                    console.error("OData Model not found!");
                    resolve();
                }
            });
        }
    });
});