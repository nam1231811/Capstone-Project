sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/m/MessageToast",   
    "sap/m/MessageBox",     
    "sap/ui/core/BusyIndicator",
    "zapp/utils/SearchData",
    "zapp/utils/FilterData",
    "zapp/utils/SortData",
    "zapp/utils/PersonalizationData",
    "zapp/models/DataFormatter",
    "zapp/models/GetData",
    "zapp/utils/TablePaginationData",
    "zapp/utils/UploadExcelData",
    "zapp/utils/DownloadExcelData",
    "zapp/api/ActivateCreate",
    "zapp/utils/LogDialogHelper"
], function (
    Controller, JSONModel, fioriLibrary,MessageToast, MessageBox, BusyIndicator, SearchData, FilterData, SortData, PersonalizationData,DataFormatter,GetData,TablePaginationData, UploadExcelData, DownloadExcelData, ActivateCreate, LogDialogHelper
) {
    "use strict";

    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [], 
        _oDataRaw: [],

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();
            this.oRouter = oOwnerComponent.getRouter();            
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);
        },
        
        // nếu chuyển xong -> viết sao cho console.log ra mảng object
        _onObjectMatched: function (oEvent) {
            var oDisplayModel = this.getView().getModel("displayModel");
            var sNewTableName = oEvent.getParameter("arguments").tableName || "";
            var sCurrentTableName = oDisplayModel.getProperty("/CurrentTable");

            if (sCurrentTableName === sNewTableName && oDisplayModel.getProperty("/Meta")?.length > 0) {
                return; 
            }
        
            var state = oEvent.getParameter("arguments").newTable || false;
            if (!state) {
                return; 
            }

            oDisplayModel.setProperty("/CurrentTable", sNewTableName); 
            oDisplayModel.setProperty("/searchQuery", "");

            var oTable = this.byId("TablePage") || this.byId("dataTable");
            if(oTable) oTable.setBusy(true);
            var oModel = this.getOwnerComponent().getModel();

            var oSettingsModel = this.getView().getModel("settingsModel");
            var sLang = oSettingsModel ? oSettingsModel.getProperty("/selectedLanguage") : "E";

            GetData.loadMeta(oModel, sNewTableName, "", sLang).then(function(oPayload) {
                this._processPayload(oPayload);
                this._displayData(); 
                }.bind(this))
                .catch(function(err) {
                    console.error("Load Meta/Data Error:", err);
                    sap.m.MessageBox.error("Lỗi khi tải dữ liệu bảng.");
                })
                .finally(function () {
                    if(oTable) oTable.setBusy(false); 
                });
        },


        _processPayload: function(oPayload) {
            var aRawMeta = oPayload.metadata || [];
            console.log(aRawMeta);
            
            var oUniqueMap = new Map();
            aRawMeta.forEach(item => {
                var sFieldName = item.fieldname || item.fieldName; 
                if (sFieldName && !oUniqueMap.has(sFieldName)) {
                    item.field_pos = item.fieldPos;
                    item.scrtext_m = item.scrTextM;
                    oUniqueMap.set(sFieldName, item);
                }
            });
            
            this._oMetaRaw = Array.from(oUniqueMap.values());
            console.log(this._oMetaRaw);
            
            this._oMetaRaw.sort((a, b) => parseInt(b.fieldPos) - parseInt(a.fieldPos));
            this._oFieldName = this._oMetaRaw.map(prop => prop.fieldname || prop.fieldName);
            
            var sActualTableName = this._oMetaRaw[0]?.tableName || this._oMetaRaw[0]?.table_name || "Unknown";
            this.getView().getModel("view")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("overall")?.setProperty("/tableName", sActualTableName);
            this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
            this.getView().getModel("displayModel").setProperty("/Data", oPayload.dataRows);
            this.getView().getModel("displayModel").setProperty("/UiMeta", this._oMetaRaw);

            var aRawData = oPayload.dataRows|| this.getView().getModel("displayModel").getProperty("/Data") || [];
            var aFormattedData = [];

            aRawData.forEach(function(rowObj, rowIndex) {
                var oNewRow = {};
                
                var oActualData = {};
                if (rowObj.data) {
                    try {
                        oActualData = JSON.parse(rowObj.data);
                    } catch (e) {
                        console.error("Lỗi parse JSON ở dòng " + rowIndex, e);
                    }
                }

                var sRowUuid = rowObj.uuid || "";

                this._oMetaRaw.forEach(function(colMeta, iIndex) {
                    var sFieldName = colMeta.fieldname || colMeta.fieldName;
                    
                    var sValue = "";
                    if (oActualData[sFieldName] !== undefined) {
                        sValue = oActualData[sFieldName];
                    } else {
                        var sMatchingKey = Object.keys(oActualData).find(k => k.toUpperCase() === sFieldName.toUpperCase());
                        if (sMatchingKey) {
                            sValue = oActualData[sMatchingKey];
                        }
                    }

                    oNewRow[iIndex] = {
                        value: sValue,
                        isEditable: false, 
                        isNew: false,
                        fieldname: sFieldName,
                        table_name: colMeta.tableName || colMeta.table_name,
                        field_pos: colMeta.fieldPos || colMeta.field_pos,
                        datatype: colMeta.datatype || colMeta.dataType,
                        row_id: rowObj.rowId || rowObj.row_id || (rowIndex + 1).toString(),
                        uuid: sRowUuid
                    };
                });
                
                aFormattedData.push(oNewRow);
            }.bind(this));

            this._oDataRaw = aFormattedData; 
            
            var minRec = this._oDataRaw.length < 10 ? this._oDataRaw.length : 10;
            var oOverallModel = this.getView().getModel("overall");
            if(oOverallModel) {
                oOverallModel.setProperty("/minRecord", minRec);
                oOverallModel.setProperty("/count", this._oDataRaw.length);
            }
            
            this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
        },
        

        _displayData: function() {
            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var result = this._oDataRaw;
            console.log(result);

            oTable.destroyColumns(); 
            oTable.bindAggregation("columns", {
                path: "displayModel>/Meta",
                factory: this.createDynamicColumn.bind(this)
            });
           
            oTable.bindRows("displayModel>/Data");
            oTable.detachColumnSelect(this.onColumnSelect, this); 
            oTable.attachColumnSelect(this.onColumnSelect, this);
        },

        // đọc lại code khúc này
        createDynamicColumn: function(sId, oContext) {
            var oMeta = oContext.getObject();
            var sPath = oContext.getPath(); 
            var iIndex = parseInt(sPath.split("/").pop(), 10); 

            var sColName = (oMeta && oMeta.fieldname) ? oMeta.fieldname : "unknown_col";
            var sBaseId = "col_" + sColName + "_" + iIndex;

            var oExistingCol = this.getView().byId(sBaseId);
            if (oExistingCol) {
                oExistingCol.destroy();
            }

            var sStableId = this.getView().createId(sBaseId);
            var sTableName = this.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
            var sSavedData = window.localStorage.getItem(sStorageKey);
            
            var bVisibleDefault = (iIndex < 10); 
            if (sSavedData) {
                try {
                    var aSavedCols = JSON.parse(sSavedData);
                    var oMatch = aSavedCols.find(function(c) { return c.index === iIndex; });
                    if (oMatch) {
                        bVisibleDefault = oMatch.visible;
                    }
                } catch(e) {}
            }

            var sHeaderText = "N/A";
            if (oMeta) {
                sHeaderText = oMeta.scrtext_l || oMeta.scrtext_m || oMeta.scrtext_s || oMeta.fieldname || "N/A";
            }
            
            var oColumn = new sap.ui.table.Column(sStableId, {
                label: new sap.m.Label({ text: sHeaderText, design: "Bold" }), 
                visible: bVisibleDefault,
                width: "auto",
                template: new sap.m.VBox({
                    items: [
                        new sap.m.FormattedText({
                            visible: "{= ${displayModel>" + iIndex + "/isEditable} !== true }",
                            htmlText: {
                                parts: [
                                    "displayModel>" + iIndex + "/value", 
                                    "displayModel>/searchQuery"          
                                ],
                                formatter: function (sValue, sQuery) {
                                    if (!sValue) 
                                        return "";
                                    sValue = sValue.toString();
                                    var sSafeValue = sValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

                                    if (!sQuery) 
                                        return sSafeValue;
                                    var sEscapedQuery = sQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
                                    var regex = new RegExp("(" + sEscapedQuery + ")", "gi");
                                    return sSafeValue.replace(regex, "<span style='background-color: #8ce8fa; font-weight: bold;'>$1</span>");
                                }
                            }
                        }),
                        
                        new sap.m.Input({
                            value: "{displayModel>" + iIndex + "/value}",
                            visible: "{= ${displayModel>" + iIndex + "/isEditable} === true }",
                            change: function(oEvent) {
                                var sColUUID = oMeta.uuid; 
                                var oModel = this.getView().getModel("displayModel");
                                var sPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                                oModel.setProperty(sPath + "/uuid", sColUUID);
                                oModel.setProperty(sPath + "/fieldname", oMeta.fieldname);
                            }.bind(this)
                        })
                    ]
                })
            });

            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colIndex", value: iIndex }));
            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colName", value: sHeaderText }));

            return oColumn;
        },

        onPressLoadMore: function () {
            TablePaginationData.onPressLoadMore.call(this);
        },

        onPressShowLess: function () {
            TablePaginationData.onPressShowLess.call(this);
        },

        //Các hàm search, sort, filter, personalization
        onPersonalization: function () {
            PersonalizationData.onPersonalization.call(this);
        },

        onColumnSelect: function(oEvent) {
            SortData.onColumnSelect.call(this, oEvent);
        },

        onSortColumnDirect: function(bDescending, iColIndex, bMultiSort, bGroup) {
            SortData.onSortColumnDirect.call(this, bDescending, iColIndex, bMultiSort, bGroup);
        },

        onSearch: function (oEvent) {
            SearchData.onSearch.call(this, oEvent);
        },

        onFilter: function () {
            FilterData.onFilter.call(this);
        },

        onFilterConfirm: function (oEvent) {
            FilterData.onFilterConfirm.call(this, oEvent);
        },

        onAdd: function() {
            var footer = this._onEditToggleButtonPress()
            var oModel = this.getView().getModel("displayModel");
            var aData = oModel.getProperty("/Data") || [];
            console.log(footer);
            
            if (footer) {
                return; 
            }

            var aMeta = oModel.getProperty("/Meta"); 
            var oNewRow = {};

            aMeta.forEach(function(colMeta, iIndex) {
                oNewRow[iIndex] = {
                    value: "",               
                    isEditable: true,        
                    isNew: true,         
                    fieldname: colMeta.fieldname,
                    table_name: colMeta.tableName,
                    field_pos: colMeta.field_pos,
                    datatype: colMeta.datatype,
                };

            }.bind(this));
        
            aData.unshift(oNewRow);
        
            oModel.setProperty("/Data", aData);
            console.log(aData);
            
            var oTable = this.byId("dataTable");
            oTable.setFirstVisibleRow(0);
        },

        onSave: function() {
            var oTable = this.byId("dataTable");
            var aData = this.getView().getModel("displayModel").getProperty("/Data");
            var aNewRows = aData.filter(row => row[0] && row[0].isNew);
            console.log(aData);
            
            oTable.setBusy(true);

            if (aNewRows.length === 0) return;

            var aPromises = {};
            var tableName = "";

            aNewRows.forEach(oRow => {
                Object.keys(oRow).forEach(key => {
                    if (!isNaN(key)) {
                        var oCell = oRow[key];
                        if (oCell && oCell.fieldname) {
                            tableName = oCell.table_name
                            aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                        } else {
                            console.warn("On Save" + key + "error");
                        }
                    }
                });
            });
            
            var codeData = GetData.encodeFunction(aPromises)
            if(codeData){
                this._sendToBackend(tableName, codeData)
            } else{
                oTable.setBusy(false)
                sap.m.MessageBox.error("Can't add more row", {
                    title: "Warning",
                onClose: function() {
                    this.onRollback(); 
                }.bind(this)})
            }
        },

        _sendToBackend: function(table, data) {
            var oModel = this.getView().getModel();
            var oFinalPayload = {
                "table_name": table,
                "data": data
            };
            var oListBinding = oModel.bindList("/Data");

            var oContext = oListBinding.create(oFinalPayload)
            oContext.created().then(function () {
                sap.m.MessageToast.show("Add new successfull");
                this._onSaveDB(oFinalPayload.table_name)
                this._onEditToggleButtonPress()
            }.bind(this)).catch(function(oError) {
                this.byId("dataTable").setBusy(false);
                if (oContext.isTransient()) {
                    oContext.delete(); 
                }
                sap.m.MessageBox.error("Dupplicate record, try another pls!" + oError.message);
            }.bind(this));
        },

        _onEditToggleButtonPress: function() {
			var oObjectPage = this.getView().byId("TableContent"),
				bCurrentShowFooterState = oObjectPage.getShowFooter(),
                oModel = this.getView().getModel("displayModel"),
                aData = oModel.getProperty("/Data") || [];

			oObjectPage.setShowFooter(!bCurrentShowFooterState);
            if(bCurrentShowFooterState){
                if (aData.length > 0 && aData[0][0] && aData[0][0].isNew) {
                        aData.shift(); 
                        oModel.setProperty("/Data", aData);
                    }
            }
            return bCurrentShowFooterState
		},

        
        onViewLogDetail: function (oEvent) {
            // 1. Lấy dữ liệu từ cái nút vừa bấm
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("displayModel");
            var oRowData = oContext.getObject();

            // 2. Khai báo hàm format định dạng JSON 
            var formatJson = function (sJsonString) {
                if (!sJsonString || sJsonString === "") {
                    return "No data available";
                }
                try {
                    var oJson = JSON.parse(sJsonString);
                    return JSON.stringify(oJson, null, 4); 
                } catch (e) {
                    return sJsonString; 
                }
            };

            // 3. Thực hiện Format dữ liệu Cũ và Mới
            var sOldDataFormatted = formatJson(oRowData.OldData);
            var sNewDataFormatted = formatJson(oRowData.NewData);

            // 4. Bàn giao phần việc vẽ vời cho Utils xử lý
            LogDialogHelper.onViewLogDetail(this, sOldDataFormatted, sNewDataFormatted);
        },

        onMedataPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                var tableName = this.getView().getModel("view").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("Metadata", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                });
            } else {
                console.error("FCL object with ID not found 'fcl'");
            }
        },

        onListItemPress: function (oEvent) {
            var oRowContext = oEvent.getParameter("rowContext");
            
            if (!oRowContext) {
                return;
            }
        
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var sPath = oRowContext.getPath();
                var row_id = sPath.split("/").pop();
                var tableName = this.getView().getModel("overall").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("DetailData", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                });
            } else {
                console.error("FCL object not found");
            }
        },

        onUploadExcelPress: function (oEvent) {
            UploadExcelData.onUploadExcelPress.call(this, oEvent);
        },

        onDownloadExcelPress: function () {
            DownloadExcelData.onDownloadExcelPress(this);
        },

        _refreshData: function(sTableName) {
            var oTable = this.byId("dataTable") || this.byId("TablePage");
            var oModel = this.getOwnerComponent().getModel();
            var oSettingsModel = this.getView().getModel("settingsModel");
            var sLang = oSettingsModel ? oSettingsModel.getProperty("/selectedLanguage") : "E";

            if (oTable) {
                oTable.setBusy(true);
            }
                
            GetData.loadMeta(oModel, sTableName, "", sLang)
                .then(function(oPayload) {
                    this._processPayload(oPayload); 
                    this._displayData();           
                    sap.m.MessageToast.show("Data already update.");
                }.bind(this))
                .catch(function(err) {
                    console.error("Refresh Error:", err);
                })
                .finally(function() {
                    if (oTable) {
                        oTable.setBusy(false);
                    }
                });
        },

        _onSaveDB: function (sTableName) {
            var oView = this.getView();
            var oModel = this.getView().getModel();
            var aData = this.getView().getModel("displayModel").getProperty("/Data") || [];
            var dataUpdate = []
            console.log(aData);
            
            if (!sTableName) {
                sap.m.MessageBox.error("Table is unknow");
                return;
            }
        
            var aDataToSave = oView.getModel("displayModel").getProperty("/Data");
        
            if (!aDataToSave || aDataToSave.length === 0) {
                sap.m.MessageToast.show("No data to update");
                return;
            }

            aData.forEach(oRow => {
                var aPromises = {};
                Object.keys(oRow).forEach(key => {
                    if (!isNaN(key)) {
                        var oCell = oRow[key];
                        if (oCell && oCell.fieldname) {
                            aPromises[oCell.fieldname] = DataFormatter.formatValueByType(oCell.value, oCell.datatype);
                        } else {
                            console.warn("On Save" + key + "error");
                        }
                    }
                });
                dataUpdate.push(aPromises)
            });
            console.log(dataUpdate);
            
            var sBase64Data = GetData.encodeFunction(dataUpdate)

            var sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("json_data", sBase64Data);

            oActionContext.execute().then(function () {
                sap.m.MessageToast.show("Already update to database");
                this._refreshData(sTableName)
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Something is wrong, try another time: " + (oError.message || "Xem Console"));
                console.error(oError);
            });
        }
  
    });
});