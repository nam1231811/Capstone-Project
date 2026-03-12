sap.ui.define([
	"sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library"
], function (Controller,JSONModel,fioriLibrary) {
	"use strict";

return Controller.extend("zapp.controller.DetailData", {
    onInit: function () {
        var oOwnerComponent = this.getOwnerComponent();
        
		this.oRouter = oOwnerComponent.getRouter();
        this.oRouter.getRoute("DetailData").attachPatternMatched(this._onObjectMatched, this);

        var oDetailRecord = new JSONModel({
                Data: []
            });
        this.getView().setModel(oDetailRecord, "detailRecord");
    },

    _onObjectMatched: function (oEvent) {
        this._record = oEvent.getParameter("arguments").rowId|| this._record || "0";
        var aData = this.getView().getModel("displayModel").getProperty("/Data");        
        console.log(aData[this._record]);
        if (aData[this._record] != "undefined") {
            this.getView().getModel("detailRecord").setProperty("/Data", aData[this._record]);
        }
        console.log(this.getView().getModel("detailRecord").getProperty("/Data"));
        
    },

    onRollback: function () {
        var oFCL = this.oView.getParent().getParent();
        if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn)
                this.getOwnerComponent().getRouter().navTo("master", {
                    layout: fioriLibrary.LayoutType.OneColumn
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
        }
    });
});