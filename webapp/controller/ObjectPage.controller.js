sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
    "use strict";
    return Controller.extend("zapp.controller.ObjectPage", {
        onCloseDetail: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain");
        }
    });
});