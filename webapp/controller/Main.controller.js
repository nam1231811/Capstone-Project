sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {
        _oMetaRaw: [], 
        _oDataRaw: [], 

        onInit: function () {
            
            var oViewModel = new JSONModel({
                count: 0,
                tableName: "" 
            });
            this.getView().setModel(oViewModel, "view");

            
            var oDisplayModel = new JSONModel({
                Meta: [],
                Data: []
            });
            this.getView().setModel(oDisplayModel, "displayModel");

            this._loadOData();
        },

        _loadOData: function () {
            var oModel = this.getOwnerComponent().getModel(); 
            var oViewModel = this.getView().getModel("view");
            var oDisplayModel = this.getView().getModel("displayModel");

            
            var oMetaBinding = oModel.bindList("/Meta"); 
            oMetaBinding.requestContexts().then(function (aMetaContexts) {
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                console.log("Dữ liệu Meta:", this._oMetaRaw);

                
                if (this._oMetaRaw.length > 0) {
                    oViewModel.setProperty("/tableName", this._oMetaRaw[0].table_name);
                    oDisplayModel.setProperty("/Meta", this._oMetaRaw);
                }

                
                return oModel.bindList("/Data").requestContexts();

            }.bind(this)).then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                console.log("Dữ liệu Data thực tế:", this._oDataRaw);

                
                oDisplayModel.setProperty("/Data", this._oDataRaw);
                oViewModel.setProperty("/count", this._oDataRaw.length);

            }.bind(this)).catch(function (oError) {
                console.error("Lỗi khi load dữ liệu OData:", oError);
            });
        }
    });
});