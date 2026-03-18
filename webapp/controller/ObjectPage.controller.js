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
    "zapp/utils/UploadExcelData"
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
    GetData,
    TablePaginationData,
    UploadExcelData
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
            
            var aCurrentMeta = this.getView().getModel("displayModel").getProperty("/Meta"); 
            
            if (aCurrentMeta && aCurrentMeta.length > 0) {
                return; 
            }

            var state = oEvent.getParameter("arguments").newTable|| false;
            if (!state) {
                return; 
            }
            var oTable = this.byId("TablePage");
            oTable.setBusy(true); 
            var tableName = oEvent.getParameter("arguments").tableName|| "";
            var oModel = this.getOwnerComponent().getModel();
            var oMeta = GetData.loadMeta(oModel,tableName)
            var oData = GetData.loadData(oModel,tableName)

            this.getView().getModel("displayModel").setProperty("/searchQuery", "");

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
          
           
           const result = DataFormatter.mapDataForDisplay(this._oDataRaw,this._oFieldName)
                  
           this.getView().getModel("displayModel").setProperty("/Data", result);
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
            
            //Sử dụng label thông thường để fill toàn bộ cell
            var oHeaderLabel = new sap.m.Label({
                text: sHeaderText,
                design: "Bold"
            });

            var oColumn = new sap.ui.table.Column(sStableId, {
                label: oHeaderLabel, 
                visible: bVisibleDefault,
                width: "auto",
                template: new sap.m.FormattedText({
                    htmlText: {
                        parts: [
                            "displayModel>" + iIndex + "/value", 
                            "displayModel>/searchQuery"          
                        ],
                        formatter: function (sValue, sQuery) {
                            if (!sValue) return "";
                            sValue = sValue.toString();
                            
                            var sSafeValue = sValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            if (!sQuery) return sSafeValue;
                            
                            var sEscapedQuery = sQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
                            var regex = new RegExp("(" + sEscapedQuery + ")", "gi");
                            return sSafeValue.replace(regex, "<span style='background-color: #8ce8fa; font-weight: bold;'>$1</span>");
                        }
                    }
                })
            });

            //Gắn định vị CustomData thẳng vào cột
            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colIndex", value: iIndex }));
            oColumn.addCustomData(new sap.ui.core.CustomData({ key: "colName", value: sHeaderText }));

            return oColumn;
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
                this.getView().getModel("displayModel").setProperty("/UiMeta", this._oMetaRaw);
            }.bind(this));
        },
        
        _loadData: function(data) {
            console.log(data);
            
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                
                this._oDataRaw = DataFormatter.groupDataByRow(this._oDataRaw);
                if(this._oDataRaw.length < 10){
                    this.getView().getModel("overall").setProperty("/minRecord", this._oDataRaw.length); 
                }else{
                    this.getView().getModel("overall").setProperty("/minRecord", "10");
                }
                this.getView().getModel("overall").setProperty("/count", this._oDataRaw.length);
                this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
                // TablePaginationData.applyScrollLock(this.byId("dataTable"), true);
            }.bind(this));
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

        onAdd: function () {
            MessageToast.show("...");
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
            UploadExcelData.onUploadExcelPress.call(this, oEvent);
        }
    });
});