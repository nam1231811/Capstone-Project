sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("zapp.controller.TableContainer", {
        _oMetaRaw: [], 
        _oDataRaw: [], 

        onInit: function () {
            var oViewModel = new JSONModel({
                layout: "OneColumn",
                tableName:""
            });
            this.getView().setModel(oViewModel, "view");
            this.getOwnerComponent().getRouter().getRoute("RouteObjectPage").attachPatternMatched(function() {
                oViewModel.setProperty("/layout", "OneColumn");
            }, this);
        },
  
    });
});