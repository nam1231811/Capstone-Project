sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "zapp/api/DeleteFromDatabase",
    "zapp/api/SaveToDatabase",
    "zapp/models/DataFormatter",
    "zapp/models/GetData",
], function (Controller, JSONModel, fioriLibrary, DeleteFromDatabase, SaveToDatabase,  DataFormatter, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.DetailData", {
        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();
            
            this.oRouter = oOwnerComponent.getRouter();
            this.oRouter.getRoute("DetailData").attachPatternMatched(this._onObjectMatched, this);

            var oDetailRecord = new JSONModel({ Data: [] });
            this.getView().setModel(oDetailRecord, "detailRecord");

            var oViewModel = new JSONModel({ isEditMode: false });
            this.getView().setModel(oViewModel, "viewModel");
        },

        _onObjectMatched: function (oEvent) {
            this.getView().getModel("viewModel").setProperty("/isEditMode", false);

            this._record = oEvent.getParameter("arguments").rowId || this._record || "0";
            var aData = this.getView().getModel("displayModel").getProperty("/Data");  
            
            if (aData.length === 0) {
                var tableName = oEvent.getParameter("arguments").tableName || this._record || "";
                this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                    layout: fioriLibrary.LayoutType.OneColumn,
                    tableName: tableName,
                    newTable: true
                });
                return;
            }
            if (aData[this._record] != undefined) {
                var oDataClone = JSON.parse(JSON.stringify(aData[this._record]));
                this.getView().getModel("detailRecord").setProperty("/Data", oDataClone);
            }
        },

        onEditAction: function () {
            var oView = this.getView();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");

            var aCells = Object.values(oDetailModel).filter(i => typeof i === 'object' && i.uuid);
            if (aCells.length === 0) {
                sap.m.MessageBox.warning("Không tìm thấy dữ liệu hợp lệ để chỉnh sửa.");
                return;
            }

            oView.getModel("viewModel").setProperty("/isEditMode", true);
        },

        onSaveAction: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");
            var tableName = this.getView().getModel("overall").getProperty("/tableName");
            var oDisplayModel = oView.getModel("displayModel");
            var aDisplayData = oDisplayModel.getProperty("/Data");
            var enUuid = Object.values(oDetailModel)[0].uuid; // Lấy UUID của record đang sửa
                
            // Tìm dòng trong displayModel để cập nhật
            var iIndex = aDisplayData.findIndex(row => {
                return row["0"].uuid === enUuid; 
            });
        
            if (iIndex !== -1) {
                aDisplayData[iIndex] = JSON.parse(JSON.stringify(oDetailModel)); 
                oDisplayModel.setProperty("/Data", aDisplayData);
            }

            var aPromises = {};
            var arrayData = Object.values(oDetailModel);
            arrayData.forEach(oCell => {
                if (oCell) {
                    if (oCell && oCell.fieldname) {
                        aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                    } else {
                        console.warn("On Save" + key + "error");
                    }
                }
            });
            var enUuid = arrayData[0].uuid
            
            var codeData = GetData.encodeFunction(aPromises);
            var path = "/Data(uuid=" + enUuid + ")"

            var oContext = oModel.bindContext(path).getBoundContext();
            oContext.setProperty("table_name", tableName);
            oContext.setProperty("data", codeData);

            oModel.submitBatch("updateGroup").then(function(){
                SaveToDatabase.onSaveDB(tableName, oView)
                this._updateDisplayModelAfterSave(oDetailModel) // Chỗ này nó chưa có biến input lại thành text
            }.bind(this)).catch(function(oError){
                sap.m.MessageBox.error("Lỗi: " + oError.message);
            });
            
            try {
                SaveToDatabase.onSaveDB(tableName, oView);
                this.getView().getModel("viewModel").setProperty("/isEditMode", false);
                this._updateDisplayModelAfterSave(oDetailModel);
            } catch (error) {
                sap.m.MessageBox.error("Lỗi: " + error.message);
            }
        },

        onCancelEdit: function() {
            var oView = this.getView();
            oView.getModel("viewModel").setProperty("/isEditMode", false);
            
            var aData = oView.getModel("displayModel").getProperty("/Data");
            if (aData[this._record] != undefined) {
                var oDataClone = JSON.parse(JSON.stringify(aData[this._record]));
                oView.getModel("detailRecord").setProperty("/Data", oDataClone);
            }
        },

        _updateDisplayModelAfterSave: function (oSavedData) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var aData = oDisplayModel.getProperty("/Data");
            
            if (aData[this._record] !== undefined) {
                aData[this._record] = oSavedData;
                oDisplayModel.setProperty("/Data", aData);
                oDisplayModel.refresh(true);
            }
        },

        onRollback: function () {
            var oFCL = this.oView.getParent().getParent();
            var tableName = this.getView().getModel("overall").getProperty("/tableName");
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);

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
                    if (sAction !== sap.m.MessageBox.Action.OK) {
                        oView.setBusy(false);
                        return;
                    }
                    
                    var aPromises = {};

                    aCells.forEach(oRow => {
                        console.log(oRow);
                        if (oRow && oRow.fieldname) {
                            aPromises[oRow.fieldname] = DataFormatter.formatValueByType(oRow.value, oRow.datatype);
                        } else {
                            console.warn("On Save" + key + "error");
                        }
                    });

                    if (aPromises && tableName) {
                        var codeData = GetData.encodeFunction(aPromises)
                        DeleteFromDatabase.postDelete(tableName, codeData, aCells[0].uuid).then(function () {                      
                            this._cleanUpAfterDelete(aCells[0].row_id);
                        }.bind(this)).catch(function (oError) {
                            console.error(oError);
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