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

            var oOwnerComponent = this.getOwnerComponent();
	    	this.oRouter = oOwnerComponent.getRouter();            
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);

        },
        
        _onObjectMatched: function (oEvent) {
            var aData = this.getView().getModel("displayModel").getProperty("/Meta");        

            this._loadMeta(aData);
            console.log(this.getView().getModel("displayModel").getProperty("/Meta"));
        },
        
        _loadMeta: function(meta) {
            return meta.requestContexts().then(function (aMetaContexts) {
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                console.log(this._oMetaRaw);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
            }.bind(this));
        },
        
    });
});