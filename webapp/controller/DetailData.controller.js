sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "zapp/api/DeleteFromDatabase",
    "zapp/api/SaveToDatabase",
    "zapp/models/DataFormatter",
    "zapp/models/GetData",
    "zapp/utils/UploadExcelData"
], function (Controller, JSONModel, fioriLibrary, DeleteFromDatabase, SaveToDatabase, DataFormatter, GetData, UploadExcelData) {
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

            this._tableName = oEvent.getParameter("arguments").tableName || this.getView().getModel("overall").getProperty("/tableName");

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
                console.log(oDataClone);
                
                this._loadImpactAnalysisData();
            }
        },

        onEditAction: function () {
            var oView = this.getView();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");

            var aCells = Object.values(oDetailModel).filter(i => typeof i === 'object' && i.uuid);
            if (aCells.length === 0) {
                sap.m.MessageBox.warning("No valid data found for editing!");
                return;
            }

            oView.getModel("viewModel").setProperty("/isEditMode", true);
        },

        onSaveAction: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oDetailModel = oView.getModel("detailRecord").getProperty("/Data");
            var tableName = this._tableName;
            var enUuid = Object.values(oDetailModel)[0].uuid;

            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            var aAllData = oView.getModel("displayModel").getProperty("/Data") || [];
            var aMeta = oView.getModel("displayModel").getProperty("/Meta") || [];

            var aKeyIndexes = [];
            
            aMeta.forEach(function(col, idx) {
                var sColName = (col.fieldname || col.fieldName || "").toUpperCase();
                if (col.keyflag === "X" || col.keyFlag === "X" || 
                    col.isKey === true || col.is_key === true || col.IsKey === true || 
                    sColName === "ID" || sColName === "CODE" || 
                    sColName.indexOf("_ID") !== -1 || sColName.indexOf("_CODE") !== -1) {
                    aKeyIndexes.push(idx);
                }
            });

            if (aKeyIndexes.length === 0 && aMeta.length > 0) {
                aKeyIndexes.push(0); 
            }

            var sCurrentRecordIdx = parseInt(this._record, 10);
            var oOriginalRow = aAllData[sCurrentRecordIdx];

            var bIsKeyModified = false;
            var aModifiedKeys = [];

            aKeyIndexes.forEach(function(iKey) {
                var sNewVal = oDetailModel[iKey] ? String(oDetailModel[iKey].value).trim() : "";
                var sOldVal = oOriginalRow[iKey] ? String(oOriginalRow[iKey].value).trim() : "";
                
                if (sNewVal !== sOldVal) {
                    bIsKeyModified = true;
                    aModifiedKeys.push(aMeta[iKey].fieldname || aMeta[iKey].fieldName);
                }
            });

            if (bIsKeyModified) {
                sap.m.MessageBox.error("Cannot edit Primary Key!\nYou are not allowed to change the value of [" + aModifiedKeys.join(", ") + "].");
                return;
            }

            var bIsDuplicate = aAllData.some(function(oOldRow, idx) {
                if (idx === sCurrentRecordIdx) return false; 

                return aKeyIndexes.every(function(iKey) {
                    var sNewVal = oDetailModel[iKey] ? String(oDetailModel[iKey].value).trim().toUpperCase() : "";
                    var sOldVal = oOldRow[iKey] ? String(oOldRow[iKey].value).trim().toUpperCase() : "";
                    return sNewVal === sOldVal && sNewVal !== ""; 
                });
            });

            if (bIsDuplicate) {
                var sKeyNames = aKeyIndexes.map(i => aMeta[i].fieldname || aMeta[i].fieldName).join(", ");
                sap.m.MessageBox.error("Duplicate Key Error: The value for [" + sKeyNames + "] already exists in another record!");
                return; 
            }

            var bHasError = false;
            var sErrorMessage = "";
            var aPromises = {};

            var arrayData = Object.values(oDetailModel);
            arrayData.forEach(oCell => {
                if (oCell && oCell.fieldname) {
                    var oValidation = UploadExcelData._validateCellFormat(
                        oCell.value, 
                        oCell.datatype, 
                        { fieldname: oCell.fieldname }
                    );

                    if (!oValidation.valid) {
                        bHasError = true;
                        sErrorMessage += "Field [" + oCell.fieldname + "]: " + oValidation.msg + "\n";
                    } else {
                        aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                    }
                }
            });

            if (bHasError) {
                sap.m.MessageBox.error("Invalid data format detected. Please fix the errors below before saving:\n\n" + sErrorMessage);
                return; 
            }
            if (bIsManager || bIsAdmin) {
                sap.ui.core.BusyIndicator.show(0);

                var aFullData = JSON.parse(JSON.stringify(oView.getModel("displayModel").getProperty("/Data")));
                aFullData[this._record] = oDetailModel;

                SaveToDatabase.onSaveDB(tableName, oView, [oDetailModel]).then(function () {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Updated to database successfully!");

                    oView.getModel("viewModel").setProperty("/isEditMode", false);
                    this._updateDisplayModelAfterSave(oDetailModel);
                }.bind(this)).catch(function () {
                    sap.ui.core.BusyIndicator.hide();
                });
                return;
            }

            var codeData = GetData.encodeFunction(aPromises);
            var path = "/Data(uuid=" + enUuid + ")";

            var oContext = oModel.bindContext(path).getBoundContext();
            oContext.setProperty("table_name", tableName);
            oContext.setProperty("data", codeData);

            sap.ui.core.BusyIndicator.show(0);
            oModel.submitBatch("updateGroup").then(function(){
                sap.ui.core.BusyIndicator.hide();

                if (oModel.hasPendingChanges()) {
                    var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
                    var sErrorMsg = "System validation failed! Request was not sent.";
                    if (aMessages && aMessages.length > 0) {
                        var aErrors = aMessages.filter(function(m) { return m.type === "Error"; });
                        if (aErrors.length > 0) { sErrorMsg = aErrors[aErrors.length - 1].message; }
                    }
                    sap.m.MessageBox.error(sErrorMsg);
                    return; 
                }

                sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval!");
                this.onCancelEdit();

            }.bind(this)).catch(function(oError){
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Error updating temporary table: " + (oError.message || "Unknown error"));
            });
        },

        onCancelEdit: function () {
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
            var tableName = this._tableName;
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
            var tableName = this.getView().getModel("overall").getProperty("/tableName");

            if (oDataRaw.length === 0) return;
            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteFromDatabase(...)";
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsClerk = oAuthModel ? oAuthModel.getProperty("/isClerk") : false;
            sap.m.MessageBox.confirm("Do you want to delete this record?", {
                onClose: function (sAction) {
                    if (sAction !== sap.m.MessageBox.Action.OK) {
                        return;
                    }
                    oView.setBusy(true);

                    if (bIsClerk) {
                        sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.deleteActiveRecord(...)";
                    }

                    var aPromises = {};
                    var aCells = Object.values(oDataRaw);
                    aCells.forEach(oCell => {
                        if (oCell && oCell.fieldname) {
                            aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                        }
                    });
                    var sBase64Data = GetData.encodeFunction(aPromises);
                    var oActionContext = oModel.bindContext(sActionPath);
                    oActionContext.setParameter("table_name", tableName);
                    oActionContext.setParameter("data", sBase64Data);

                    return oActionContext.execute().then(function () { 
                        oView.setBusy(false);
                        this._cleanUpAfterDelete(aCells[0].row_id, bIsClerk);
                    }.bind(this)).catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.error("Something is wrong, try another time: ");
                         oView.setBusy(false);
                        console.error(oError);
                    });
                }.bind(this)
            });
        },

        _cleanUpAfterDelete: function (sRowId, bIsClerk) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var aData = oDisplayModel.getProperty("/Data");
            var aNewData = aData.filter(function (row) {
                return !(row[0] && row[0].row_id === sRowId);
            });
            if (bIsClerk) {
                sap.m.MessageToast.show("Request sent successfully! Please wait for Manager approval!");
            }else {
                sap.m.MessageToast.show("Deleted successfully from database!");
            }
            this.getView().getModel("overall").setProperty("/count", aNewData.length);
            oDisplayModel.setProperty("/Data", aNewData);
            oDisplayModel.refresh(true);
            sap.m.MessageBox.success("Delete record " + sRowId + " successfully", {
                title: "Successfull",
                onClose: function () {
                    this.onRollback();
                }.bind(this)
            });
        },

_loadImpactAnalysisData: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();

            // Set biểu đồ về trạng thái trống ban đầu
            var oEmptyGraphModel = new sap.ui.model.json.JSONModel({ nodes: [], lines: [] });
            oView.setModel(oEmptyGraphModel, "graph");

            var sTableName = this._tableName;

            // 1. LẤY DỮ LIỆU ĐỂ TÌM KEY VALUE VÀ UUID CỦA BẢN GHI ĐANG XEM
            var oDetailData = oView.getModel("detailRecord").getProperty("/Data");
            var aCells = Object.values(oDetailData).filter(i => typeof i === 'object');
            
            var sKeyValue = ""; 
            var sUuid = "";

            if (aCells.length > 0) {
                sKeyValue = aCells[0].value; // Lấy giá trị của ô đầu tiên làm Key
                
                // Lấy UUID của bản ghi
                var oCellWithUuid = aCells.find(cell => cell.uuid);
                if (oCellWithUuid) {
                    sUuid = oCellWithUuid.uuid;
                }
            }

            if (!sTableName || !sKeyValue || !sUuid) {
                console.warn("Impact Analysis: Missing Table Name, Key Value, or UUID");
                return;
            }

            // 2. ĐIỂM SỬA LỖI Ở ĐÂY: Chèn UUID vào đường dẫn OData V4 cho Bound Function
            var sActionPath = "/Data(uuid=" + sUuid + ")/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.getimpactanalysis(...)"; 
            
            var oActionContext = oModel.bindContext(sActionPath);
            
            // 3. Truyền tham số
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("key_value", sKeyValue);

            // 4. Gọi Backend
            oActionContext.execute().then(function () {
                var oResult = oActionContext.getBoundContext().getObject();
                
                if (oResult && oResult.json_string) {
                    try {
                        var oParsedGraphData = JSON.parse(oResult.json_string);
                        var oGraphModel = new sap.ui.model.json.JSONModel(oParsedGraphData);
                        oView.setModel(oGraphModel, "graph");
                    } catch (e) {
                        console.error("Lỗi parse JSON Impact Analysis: ", e);
                    }
                }
            }.bind(this)).catch(function (oError) {
                console.error("Lỗi gọi Impact Analysis: ", oError);
                // Nếu backend trả về lỗi, bạn có thể hiện MessageToast ở đây
            });
        },

        onDynamicValueHelp: function (oEvent) {
            var oInput = oEvent.getSource();
            var sTableName = oInput.data("tableName") || oInput.data("table_name");
            var sFieldName = oInput.data("fieldName") || oInput.data("fieldname");

            console.log("Edit Value Help - Table:", sTableName, "Field:", sFieldName);

            if (!sTableName || !sFieldName) {
                sap.m.MessageToast.show("Cannot find metadata for this field");
                return;
            }

            if (!this._oDynamicVHDialog) {
                this._oDynamicVHDialog = new sap.m.SelectDialog({
                    title: "Select Value",
                    confirm: this.onValueHelpConfirm.bind(this)
                });
                this.getView().addDependent(this._oDynamicVHDialog);
            }

            var aFilters = [
                new sap.ui.model.Filter("TableName", "EQ", sTableName),
                new sap.ui.model.Filter("FieldName", "EQ", sFieldName)
            ];

            this._oDynamicVHDialog.bindAggregation("items", {
                path: "/DynamicVHSet",
                template: new sap.m.StandardListItem({
                    title: "{KeyValue}",
                    description: "{Description}",
                    info: "{FieldName}"
                }),
                filters: aFilters
            });

            this._oDynamicVHDialog.data("targetInput", oInput);
            this._oDynamicVHDialog.open();
        },

        onValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var oInput = oEvent.getSource().data("targetInput");
                var sSelectedKey = oSelectedItem.getTitle();

                oInput.setValue(sSelectedKey);

                oInput.fireChange({ value: sSelectedKey });
            }
        }
    });
});