sap.ui.define([
    "sap/ui/core/UIComponent"
], function (UIComponent) {
    "use strict";

    return UIComponent.extend("zapp.Component", {
        metadata: {
            manifest: "json"
        },
        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            // TẠO MODEL ĐIỀU KHIỂN CHIA CỘT
            var oFCLModel = new sap.ui.model.json.JSONModel({
                layout: "OneColumn"
            });
            this.setModel(oFCLModel, "fclModel");

            this.getRouter().initialize();
        }
    });
});