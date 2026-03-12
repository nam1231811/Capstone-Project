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
        
        _onObjectMatched: function () {
            var oMeta = this.getView().getModel("displayModel").getProperty("/Meta"); 
            this._loadMeta(oMeta);
            var oData = this.getView().getModel("displayModel").getProperty("/Data");   
            this._loadData(oData);            
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
        
        _loadData: function(data) {
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                console.log(this._oDataRaw);
                this._oDataRaw = this._groupDataByRow(this._oDataRaw)
                console.log(this._oDataRaw);

                this.getView().getModel("overall").setProperty("/count", this._oDataRaw.length);
            }.bind(this));
        },
        
        _groupDataByRow: function (data) {
            if(!data || !Array.isArray(data)){
                return [];
            }

            const groupData = data.reduce(function (acc, obj) {
                var sKey = obj.row_id;
                if (!acc[sKey]) {
                    acc[sKey] = [];
                }
                acc[sKey].push(obj);
                return acc;
            }, {});

            //[ [Array(5)], [ Array(5)],... ]
            return Object.values(groupData);;
        },

        
        
    });
});