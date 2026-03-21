sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
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

            var oViewModel = new JSONModel({
                isEditMode: false 
            });
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

        onEditAction: async function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord");
            var oDataRaw = oDetailModel.getProperty("/Data");

            var aCells = Object.values(oDataRaw).filter(i => typeof i === 'object' && i.uuid);
            if (aCells.length === 0) {
                sap.m.MessageBox.warning("Không tìm thấy dữ liệu hợp lệ để chỉnh sửa.");
                return;
            }

            //viết 1 cái if-else
            if (aCells[0].IsActiveEntity === false) {
            
                oView.getModel("viewModel").setProperty("/isEditMode", true);

                try {
                    for (let i = 0; i < aCells.length; i++) {
                        let oCell = aCells[i];
                        let sEntityPath = "/Meta(uuid=" + oCell.uuid + ",fieldname='" + oCell.fieldname + "',IsActiveEntity=true)";

                        let oEntityBinding = oModel.bindContext(sEntityPath);
                        await oEntityBinding.requestObject(); 

                        let oActionBinding = oModel.bindContext("com.sap.gateway.srvd.zsd_dynamic_meta.v0001.Edit(...)", oEntityBinding.getBoundContext());
                        oActionBinding.setParameter("PreserveChanges", true);

                        await oActionBinding.execute();
                    }

                } catch (oError) {
                    sap.m.MessageBox.error("Hệ thống từ chối tạo Draft");
                } finally {
                    oView.setBusy(false);
                }
            }
            else {
                console.log('edit active record');
            }
        },

        onSaveAction: async function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord");
            var oDataRaw = oDetailModel.getProperty("/Data"); 

            var aCells = Object.values(oDataRaw).filter(i => typeof i === 'object' && i.uuid);
            var oGroupId = "updateGroup"; 

            oView.setBusy(true);

            try {
                let aPatchPromises = aCells.map(function (oCell) {
                    let sDraftDataPath = "/Data(uuid=" + oCell.uuid + ",fieldname='" + oCell.fieldname + "',row_id=" + oCell.row_id + ",IsActiveEntity=false)";
                    let oDraftDataBinding = oModel.bindContext(sDraftDataPath);
                    
                    return oDraftDataBinding.requestObject().then(function() {
                        oDraftDataBinding.getBoundContext().setProperty("value", oCell.value, oGroupId);
                    });
                });

                await Promise.all(aPatchPromises);
                await oModel.submitBatch(oGroupId); 

                for (let j = 0; j < aCells.length; j++) {
                    let oCell = aCells[j];
                    let sDraftMetaPath = "/Meta(uuid=" + oCell.uuid + ",fieldname='" + oCell.fieldname + "',IsActiveEntity=false)";

                    let oDraftMetaBinding = oModel.bindContext(sDraftMetaPath);
                    await oDraftMetaBinding.requestObject();

                    let oActivateAction = oModel.bindContext("com.sap.gateway.srvd.zsd_dynamic_meta.v0001.Activate(...)", oDraftMetaBinding.getBoundContext());
                    await oActivateAction.execute();
                }

                this._updateDisplayModelAfterSave(oDataRaw);
                oView.getModel("viewModel").setProperty("/isEditMode", false);
                sap.m.MessageToast.show("Cập nhật dữ liệu thành công!");

            } catch (oError) {
                sap.m.MessageBox.error("Lỗi khi lưu dữ liệu.");
            } finally {
                oView.setBusy(false);
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