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

            // var oOwnerComponent = this.getOwnerComponent();
	    	// this.oRouter = oOwnerComponent.getRouter();            
            // this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);
        },
  
    });
});