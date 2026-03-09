sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library"
], function (Controller, JSONModel, fioriLibrary) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {
        _oMetaRaw: [], 
        _oDataRaw: [], 

        onInit: function () {
            this._loadOData();
            
        },

        _loadOData: function () {
            Promise.all([
                this._loadMeta(),
                this._loadData()
            ]).then(function() {
                this._displayData(); 
            }.bind(this));
        },  
        _loadMeta: function() {
            var oModel = this.getOwnerComponent().getModel();
            console.log(oModel);
            
            return oModel.bindList("/Meta").requestContexts().then(function (aMetaContexts) {
                console.log(this._oMetaRaw);
                
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
            }.bind(this));
        },

        _loadData: function() {
            var oModel = this.getOwnerComponent().getModel();
            return oModel.bindList("/Data").requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
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

        _displayData: function() {
            var oTable = this.byId("dataTable");
            var oTemplate = this.byId("columnTemplate")
            var listColumns = oTable.getColumns();
            var listColumnName = listColumns.map(column => column.getHeader().getText())
            // chỉ có thể sửa data không thể thay thế thứ th hhhk,qự hiển thị 
            
            const result = this._oDataRaw.map(record => {
                return listColumnName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn)
                    return cell;
                })
            });
            console.log(result);
            
            this.getView().getModel("displayModel").setProperty("/Data", result);
            oTemplate.bindCells({
                path: "displayModel>", 
                factory: function(sId, oContext) {
                    // oContext lúc này là từng object như {fieldname: "ID", value: "10001", ...}
                    return new sap.m.Text({
                        text: "{displayModel>value}"
                    });
                }
            });
            
            oTable.bindItems({
                path: "displayModel>/Data",
                template: oTemplate
            });
        },

        onListItemPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                this.getOwnerComponent().getRouter().navTo("detail", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
		}

    });
});