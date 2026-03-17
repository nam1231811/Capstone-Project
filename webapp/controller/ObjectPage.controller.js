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
    "zapp/models/GetData"
], function (
    Controller, 
    JSONModel, 
    fioriLibrary,
    MessageToast, 
    MessageBox, 
    BusyIndicator, 
    SearchData, 
    FilterData, 
    SortData, 
    PersonalizationData,
    DataFormatter,
    GetData
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
        
        _onObjectMatched: function (oEvent) {
            // var loadingStatus = oEvent.getParameter("arguments").loading|| false;
             

            // if(loadingStatus){
            //     
            // }

            
            // var oMetaBinding = oModel.bindList("/Meta"); 
            // var oDataBinding = oModel.bindList("/Data"); 
            
            var aCurrentMeta = this.getView().getModel("displayModel").getProperty("/Meta"); 
            if (aCurrentMeta && aCurrentMeta.length > 0) {
                return; 
            }
             var oTable = this.byId("TablePage");
            // this._oDataBindingGoc = oDataBinding; 
            oTable.setBusy(true); 
            var tableName = oEvent.getParameter("arguments").tableName|| "";
            var oModel = this.getOwnerComponent().getModel();
            var oMeta = GetData.loadMeta(oModel,tableName)
            var oData = GetData.loadData(oModel,tableName)
            console.log(oMeta,oData);
            
            Promise.all([
                this._loadMeta(oMeta),
                this._loadData(oData)
            ]).then(function() {
                this._displayData(); 
            }.bind(this)).catch(function(err) {
                console.error("Load Meta/Data Error:", err);
            }).finally(function () {
                 oTable.setBusy(false); 
            });
        },

        _displayData: function() {
           var oTable = this.byId("dataTable");


           const result = this._oDataRaw.map(record => {
               var oRowObject = {}; 
               this._oFieldName.forEach((nameColumn, iIndex) => {
                   const cell = record.find(column => column.fieldname === nameColumn);

                   oRowObject[iIndex] = cell || { value: "" }; 
               });
               return oRowObject; 
           });
       
           this.getView().getModel("displayModel").setProperty("/Data", result);
           console.log(result);
           
           oTable.destroyColumns(); 
           oTable.bindAggregation("columns", {
               path: "displayModel>/Meta",
               factory: this.createDynamicColumn.bind(this)
           });
       
           oTable.bindRows("displayModel>/Data");
        },

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

            var sHeaderText = (oMeta && oMeta.scrtext_l) ? oMeta.scrtext_l : "N/A";
            
            var oHeaderButton = new sap.m.Button({
                text: sHeaderText,
                type: "Transparent",
                press: this.onColumnHeaderPress.bind(this)
            });

            oHeaderButton.addCustomData(new sap.ui.core.CustomData({ key: "colIndex", value: iIndex }));
            oHeaderButton.addCustomData(new sap.ui.core.CustomData({ key: "colName", value: sHeaderText }));

            return new sap.ui.table.Column(sStableId, {
                label: oHeaderButton, 
                visible: bVisibleDefault,
                width: "auto",
                template: new sap.m.Text({
                    text: "{displayModel>" + iIndex + "/value}",
                    wrapping: false
                })
            });
        },
        
        _loadMeta: function(meta) {
            return meta.requestContexts().then(function (aMetaContexts) {
                this._oMetaFirstContext = aMetaContexts[0];
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                this._oFieldName = this._oMetaRaw.map( prop => prop.fieldname);
                
                this.getView().getModel("view").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
            }.bind(this));
        },
        
        _loadData: function(data) {
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                this._oDataRaw = this._groupDataByRow(this._oDataRaw);
                this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
                this.getView().getModel("overall").setProperty("/count", this._oDataRaw.length);
            }.bind(this));
        },
        
        _groupDataByRow: function (data) {
            if(!data || !Array.isArray(data)){ return []; }
            const groupData = data.reduce(function (acc, obj) {
                var sKey = obj.row_id;
                if (!acc[sKey]) { acc[sKey] = []; }
                acc[sKey].push(obj);
                return acc;
            }, {});
            return Object.values(groupData);
        },

        //Các hàm search, sort, filter, personalization
        onPersonalization: function () {
            PersonalizationData.onPersonalization.call(this);
        },

        onColumnHeaderPress: function(oEvent) {
            SortData.onColumnHeaderPress.call(this, oEvent);
        },

        onSortColumnDirect: function(bDescending, iColIndex) {
            SortData.onSortColumnDirect.call(this, bDescending, iColIndex);
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

        onAdd: function () {
            sap.m.MessageToast.show("...");
        },

        onViewLogDetail: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("displayModel");
            var oRowData = oContext.getObject();

            var formatJson = function (sJsonString) {
                if (!sJsonString || sJsonString === "") {
                    return "Không có dữ liệu (Blank)";
                }
                try {
                    var oJson = JSON.parse(sJsonString);
                    return JSON.stringify(oJson, null, 4); 
                } catch (e) {
                    return sJsonString; 
                }
            };

            var sOldDataFormatted = formatJson(oRowData.OldData);
            var sNewDataFormatted = formatJson(oRowData.NewData);

            if (!this._oLogDialog) {
                this._oLogDialog = new sap.m.Dialog({
                    title: "Chi tiết dữ liệu thay đổi (JSON)",
                    contentWidth: "600px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Label({ text: "Dữ liệu CŨ (Old Data):", design: "Bold" }).addStyleClass("sapUiTinyMarginTop"),
                                new sap.m.TextArea({ value: "{dialogModel>/oldData}", width: "100%", rows: 6, editable: false }),
                                
                                new sap.m.Label({ text: "Dữ liệu MỚI (New Data):", design: "Bold" }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.TextArea({ value: "{dialogModel>/newData}", width: "100%", rows: 6, editable: false })
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    beginButton: new sap.m.Button({
                        type: "Emphasized",
                        text: "Đóng",
                        press: function () {
                            this._oLogDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._oLogDialog);
            }

            var oDialogModel = new sap.ui.model.json.JSONModel({
                oldData: sOldDataFormatted,
                newData: sNewDataFormatted
            });
            this._oLogDialog.setModel(oDialogModel, "dialogModel");
            this._oLogDialog.open();
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
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
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
                console.error("Không tìm thấy đối tượng FCL");
            }
        },

        onUploadExcelPress: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles ? aFiles[0] : null;

            if (!oFile) {
                MessageToast.show("File could not be found. Please try again!");
                return;
            }

            var oReader = new FileReader();
            
            oReader.onload = function (e) {
                var sDataURL = e.target.result;
                var sBase64String = sDataURL.split(",")[1];
                var sTableName = this.getView().getModel("overall").getProperty("/tableName");

                this._sendExcelToBackend(sTableName, sBase64String);
                
                this.byId("excelUploader").clear();
                
            }.bind(this);

            oReader.readAsDataURL(oFile);
        },

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oModel = this.getOwnerComponent().getModel();
            
            if (!this._oMetaFirstContext) {
                MessageBox.error("Metadata Context information not found!");
                return;
            }

            BusyIndicator.show(0);

            var sActionName = "com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";
            var oActionContext = oModel.bindContext(sActionName, this._oMetaFirstContext);
            
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            oActionContext.execute().then(function () {
                BusyIndicator.hide();
                MessageToast.show("Upload file Excel và lưu Database thành công!");
                
                if (this._oDataBindingGoc) {
                    this._oDataBindingGoc.refresh(); 
                    
                    setTimeout(function() {
                        this._loadData(this._oDataBindingGoc).then(function() {
                            this._displayData();
                        }.bind(this));
                    }.bind(this), 500); 
                }
                
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Lỗi khi tải file: " + (oError.message || "Lỗi không xác định"));
                console.error("Chi tiết lỗi Upload:", oError);
            });
        }
    });
});