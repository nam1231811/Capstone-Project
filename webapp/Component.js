sap.ui.define([
    "sap/ui/core/UIComponent"
    // Xóa dòng "capstoneproject/model/models" ở đây
], function (UIComponent) { // Xóa biến "models" ở đây
    "use strict";

    return UIComponent.extend("zapp.Component", {
        metadata: {
            manifest: "json"
        },
        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.getRouter().initialize();
            // Xóa dòng this.setModel(models.createDeviceModel(), "device");
        }
    });
});