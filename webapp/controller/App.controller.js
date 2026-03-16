sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("zapp.controller.App", {
        onInit: function () {
            var oDisplayModel = new sap.ui.model.json.JSONModel({
                Meta: [],
                Data: []
            });
            this.getView().setModel(oDisplayModel, "displayModel");

            var oGeneral = new sap.ui.model.json.JSONModel({
                count: 0,
                tableName: "" 
            })
            this.getView().setModel(oGeneral, "overall");
        }
            
    });
});