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
    "zapp/utils/TablePaginationData"
], function (Controller, JSONModel, fioriLibrary, MessageToast, MessageBox, BusyIndicator, SearchData, FilterData, SortData, PersonalizationData, TablePaginationData
) {
    "use strict";

    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [], 
        _oDataRaw: [],

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();
            this.oRouter = oOwnerComponent.getRouter();            
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);

            var oDetailRecord = new JSONModel({ Data: [] });
            this.getView().setModel(oDetailRecord, "detailRecord");
        },
        
        _onObjectMatched: function () {      
            var oModel = this.getOwnerComponent().getModel();
            
            var oMetaBinding = oModel.bindList("/Meta"); 
            var oDataBinding = oModel.bindList("/Data"); 
                
            this._oDataBindingGoc = oDataBinding; 

            this.getView().getModel("displayModel").setProperty("/searchQuery", "");

            Promise.all([
                this._loadMeta(oMetaBinding),
                this._loadData(oDataBinding)
            ]).then(function() {
                this._displayData(); 
            }.bind(this)).catch(function(err) {
                console.error("Lỗi sập trang khi load Meta/Data:", err);
            });
        },

        _displayData: function() {
            var oTable = this.byId("dataTable");

            const result = this._oDataRaw.map(record => {
                return this._oFieldName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn);
                    return cell || { value: "" }; 
                });
            });
        
            this.getView().getModel("displayModel").setProperty("/UiData", result);
        
            oTable.destroyColumns(); 

            oTable.bindAggregation("columns", {
                path: "displayModel>/UiMeta",
                factory: this.createDynamicColumn.bind(this)
            });

            oTable.bindRows("displayModel>/UiData");

            //Gắn sự kiện click toàn bộ cell vào bảng
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

            var sHeaderText = (oMeta && oMeta.scrtext_l) ? oMeta.scrtext_l : "N/A";
            
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
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                this._oDataRaw = this._groupDataByRow(this._oDataRaw);
                
                const iDataLength = this._oDataRaw.length;
                const iVisibleRowCount = iDataLength < 10 ? iDataLength : 10;
                
                const bHasMore = iDataLength > iVisibleRowCount;
                const bHasLess = false;

                const oDisplayModel = this.getView().getModel("displayModel");
                oDisplayModel.setProperty("/Data", this._oDataRaw);
                oDisplayModel.setProperty("/visibleRowCount", iVisibleRowCount);
                oDisplayModel.setProperty("/hasMore", bHasMore); 
                oDisplayModel.setProperty("/hasLess", bHasLess);
                
                this.getView().getModel("overall").setProperty("/count", iDataLength);
                TablePaginationData.applyScrollLock(this.byId("dataTable"), true);
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