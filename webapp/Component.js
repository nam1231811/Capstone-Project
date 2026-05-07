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

                var oRouter = this.getRouter();
                oRouter.initialize();

                if (sap.ushell && sap.ushell.Container) {
                    var oUrlParsing = sap.ushell.Container.getService("URLParsing");
                    var oHash = oUrlParsing.parseShellHash(window.location.hash);

                    if (oHash && oHash.action === "myRequests") {
                        oRouter.navTo("RouteMyRequests", {}, true);
                    }
                }

            }.bind(this)).catch(function (error) {
                BusyIndicator.hide();
                this.getRouter().initialize();
                console.error("Error loading user role:", error);
            }.bind(this));
        },

        _initAuthModel: function () {
            var that = this;

            return new Promise(function (resolve) {
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
                    sCurrentUserId = "DEV-097";
                }
                sCurrentUserId = sCurrentUserId.toUpperCase();
                oAuthModel.setProperty("/currentUser", sCurrentUserId);

                var oODataModel = that.getModel();
                if (oODataModel) {
                    var oContextBinding = oODataModel.bindContext("/UserRoleList('" + sCurrentUserId + "')");

                    oContextBinding.requestObject().then(function (oData) {

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