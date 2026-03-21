sap.ui.define([
	"sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "zapp/api/DeleteFromDatabase"
], function (Controller,JSONModel,fioriLibrary, DeleteFromDatabase) {
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
        if (aData.length === 0) {
            var tableName = oEvent.getParameter("arguments").tableName|| this._record || "";
            console.log(tableName);
            this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                    layout: fioriLibrary.LayoutType.OneColumn,
                    tableName: tableName,
                    newTable: true
                });
            return
        }
        if (aData[this._record] != undefined) {
            this.getView().getModel("detailRecord").setProperty("/Data", aData[this._record]);
        }
        console.log(this.getView().getModel("detailRecord").getProperty("/Data"));
        
    },

    onRollback: function () {
        var oFCL = this.oView.getParent().getParent();
        var tableName = this.getView().getModel("overall").getProperty("/tableName")
        if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn)
                this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                    layout: fioriLibrary.LayoutType.OneColumn,
                    tableName: tableName,
                    newTable: false
                });
            } else {
                console.error("unknown fcl id");
            }
    },

    onDeleteRow: function () {
        var oView = this.getView();
        var oModel = oView.getModel();
        var oDetailModel = oView.getModel("detailRecord");
        var oDataRaw = oDetailModel.getProperty("/Data");
        var tableName = this.getView().getModel("overall").getProperty("/tableName")
        var aCells = Object.values(oDataRaw).filter(i => typeof i === 'object' && i.uuid);
    
        sap.m.MessageBox.confirm("Do you want to delete this record?", {
            onClose: function (sAction) {
                oView.setBusy(true); 
                if (sAction !== sap.m.MessageBox.Action.OK) 
                    return;

                if (aCells[0].IsActiveEntity) {
                    DeleteFromDatabase.postDelete(tableName, aCells[0].row_id).then(function () {
                        this._cleanUpAfterDelete(oDataRaw[0].row_id);
                    }.bind(this)).catch(function (oError) {
                        console.error( oError);
                        sap.m.MessageBox.error("Delete fail " + oError.message);
                    }).finally(function () {
                        oView.setBusy(false);
                    });

                } else {
                    var aPromises = aCells.map(function (oCell) {
                    var sPath = "/Data(uuid=" + oCell.uuid + 
                                ",fieldname='" + oCell.fieldname + 
                                "',row_id=" + oCell.row_id +
                                ",IsActiveEntity=" + oCell.IsActiveEntity + ")";
                
                        console.log("Path: " + sPath);
                        return oModel.delete(sPath, "$direct"); 
                    });
                    Promise.all(aPromises).then(function () {
                        this._cleanUpAfterDelete(oDataRaw[0].row_id);
                    }.bind(this)).catch(function (oError) {
                        console.error( oError);
                        sap.m.MessageBox.error("Delete fail " + oError.message);
                    }).finally(function () {
                        oView.setBusy(false);
                    });
                }
            }.bind(this)
        });
    },
    
    _cleanUpAfterDelete: function(sRowId) {
        var oDisplayModel = this.getView().getModel("displayModel");
        var aData = oDisplayModel.getProperty("/Data");
        var aNewData = aData.filter(function(row) {
            return !(row[0] && row[0].row_id === sRowId);
        });
        this.getView().getModel("overall").setProperty("/count", aNewData.length);
        oDisplayModel.setProperty("/Data", aNewData);
        oDisplayModel.refresh(true);
        sap.m.MessageBox.success("Delete record " + sRowId + " successfully", {
            title: "Successfull",
            onClose: function() {
                this.onRollback(); 
            }.bind(this)
        });
    }
});
});