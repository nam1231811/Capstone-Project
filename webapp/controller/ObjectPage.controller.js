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
    "zapp/utils/DownloadExcelData"
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
    UploadExcelData,
    DownloadExcelData
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

            oDisplayModel.setProperty("/Meta", []);
            oDisplayModel.setProperty("/Data", []);
            oDisplayModel.setProperty("/CurrentTable", sNewTableName); 
            oDisplayModel.setProperty("/searchQuery", "");
            var oTable = this.byId("TablePage");
            oTable.setBusy(true); 

            var oModel = this.getOwnerComponent().getModel();
            var oMeta = GetData.loadMeta(oModel,sNewTableName)
            var oData = GetData.loadData(oModel,sNewTableName)

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
            // var oHeaderLabel = new sap.m.Label({
            //     text: sHeaderText,
            //     design: "Bold"
            // });

            // var oColumn = new sap.ui.table.Column(sStableId, {
            //     label: new sap.m.Label({ text: sHeaderText, design: "Bold" }), 
            //     visible: bVisibleDefault,
            //     width: "auto",
            //     template: new sap.m.FormattedText({
            //         htmlText: {
            //             parts: [
            //                 "displayModel>" + iIndex + "/value", 
            //                 "displayModel>/searchQuery"          
            //             ],
            //             formatter: function (sValue, sQuery) {
            //                 if (!sValue) return "";
            //                 sValue = sValue.toString();
                            
            //                 var sSafeValue = sValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            //                 if (!sQuery) return sSafeValue;
                            
            //                 var sEscapedQuery = sQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
            //                 var regex = new RegExp("(" + sEscapedQuery + ")", "gi");
            //                 return sSafeValue.replace(regex, "<span style='background-color: #8ce8fa; font-weight: bold;'>$1</span>");
            //             }
            //         }
            //     })
            // });
            var oColumn = new sap.ui.table.Column(sStableId, {
                label: new sap.m.Label({ text: sHeaderText, design: "Bold" }), 
                visible: bVisibleDefault,
                width: "auto",
                template: new sap.m.VBox({
                    items: [
                        new sap.m.FormattedText({
                            visible: "{= !${displayModel>" + iIndex + "/isEditable} }",
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
                        // new sap.m.Input({
                        //     value: "{displayModel>" + iIndex + "/value}",
                        //     visible: "{= ${displayModel>" + iIndex + "/isEditable} === true }", // Hiện nếu là dòng mới
                        //     width: "100%"
                        // })
                        new sap.m.Input({
                            value: "{displayModel>" + iIndex + "/value}",
                            visible: "{= ${displayModel>" + iIndex + "/isEditable} === true }",
                            change: function(oEvent) {
                                // Lấy giá trị vừa nhập
                                var sNewValue = oEvent.getParameter("value");
                                // Lấy UUID của cột từ Meta (đã có sẵn trong context của factory)
                                var sColUUID = oMeta.uuid; 

                                // Cập nhật UUID vào model Data để khi Save có cái mà dùng
                                var oModel = this.getView().getModel("displayModel");
                                var sPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                                oModel.setProperty(sPath + "/uuid", sColUUID);
                                oModel.setProperty(sPath + "/fieldname", oMeta.fieldname);
                            }.bind(this)
                        })
                    ]
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
                console.log(this._oMetaRaw);
                
                this.getView().getModel("view").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
                this.getView().getModel("displayModel").setProperty("/UiMeta", this._oMetaRaw);
            }.bind(this));
        },
        
        _loadData: function(data) {
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                
                this._oDataRaw = DataFormatter.groupDataByRow(this._oDataRaw);
                if(this._oDataRaw.length < 10){
                    this.getView().getModel("overall").setProperty("/minRecord", this._oDataRaw.length); 
                }else{
                    this.getView().getModel("overall").setProperty("/minRecord", 10);
                }
                this.getView().getModel("overall").setProperty("/count", this._oDataRaw.length);
                this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
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

        onAdd: function() {
            var oModel = this.getView().getModel("displayModel");
            var aData = oModel.getProperty("/Data") || [];
            var aMeta = oModel.getProperty("/Meta"); 
            var oNewRow = {};
            var sCommonRowId = (aData.length + 1);

            // Duyệt qua từng cột trong Meta để copy thông tin định danh
            aMeta.forEach(function(colMeta, iIndex) {
                var sNewRowUUID = DataFormatter.generateUUID();
                oNewRow[iIndex] = {
                    value: "",               
                    isEditable: true,        
                    isNew: true,             
                    uuid: sNewRowUUID, 
                    fieldname: colMeta.fieldname,
                    table_name: colMeta.table_name,
                    field_pos: colMeta.field_pos,
                    datatype: colMeta.datatype,
                    row_id: sCommonRowId,

                };
            }.bind(this));
        
            aData.unshift(oNewRow);
        
            oModel.setProperty("/Data", aData);

            var oTable = this.byId("dataTable");
            oTable.setFirstVisibleRow(0);
            sap.m.MessageToast.show("add row successful.");
        },

        onSave: function() {
            var aData = this.getView().getModel("displayModel").getProperty("/Data");

            // 1. Lọc lấy các dòng mới
            var aNewRows = aData.filter(row => row[0] && row[0].isNew);

            aNewRows.forEach(oRow => {
                // 2. Lấy tất cả các key (0, 1, 2...) trong dòng oRow
                Object.keys(oRow).forEach(key => {
                    // Chỉ xử lý các key là số (đại diện cho các cột dữ liệu)
                    if (!isNaN(key)) {
                        var oCell = oRow[key];

                        // 3. Kiểm tra dữ liệu trước khi gửi để tránh lỗi 'undefined'
                        if (oCell && oCell.uuid && oCell.fieldname) {
                            var oCellPayload = {
                                "uuid": oCell.uuid,
                                "fieldname": oCell.fieldname,
                                "table_name": oCell.table_name,
                                "field_pos": oCell.field_pos,
                                "datatype": oCell.datatype,
                                "row_id": oCell.row_id,
                                "fieldname": oCell.fieldname,
                                "table_name": oCell.table_name,
                                "value": oCell.value,
                            }
                            console.log("Đang gửi ô:", oCell.fieldname, "với UUID:", oCell.uuid, oCellPayload);
                            this._sendToBackend(oCellPayload);
                        } else {
                            console.warn("Bỏ qua ô tại cột " + key + " do thiếu thông tin định danh.");
                        }
                    }
                });
            });  
        },

        _sendToBackend: function(oCellPayload) {
            var oModel = this.getView().getModel();
                
            // Gửi trực tiếp vào đầu mục /Meta
            var oListBinding = oModel.bindList("/Meta", null, null, null, {
                "$$groupId": "$direct"
            });
            // Cấu trúc Payload 
            var oFinalPayload = {
                "uuid": oCellPayload.uuid, 
                "fieldname": oCellPayload.fieldname,
                "table_name": oCellPayload.table_name,
                "field_pos": oCellPayload.field_pos,
                "datatype": oCellPayload.datatype,
                "_Data": [{
                    "row_id": oCellPayload.row_id,
                    "fieldname": oCellPayload.fieldname,
                    "table_name": oCellPayload.table_name,
                    "value": oCellPayload.value
                }]
            };

            var oContext = oListBinding.create(oFinalPayload);
        
            oContext.created().then(function() {
                console.log("Đã tạo nháp Meta & Data thành công cho: " + oCellPayload.fieldname);
            }.bind(this)).catch(function(oError) {
                console.error("Lỗi khi tạo nháp: ", oError);
            });
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
        },

        onDownloadExcelPress: function () {
            DownloadExcelData.onDownloadExcelPress(this);
        }
        
    });
});