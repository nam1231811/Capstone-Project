sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/ui/table/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/HTML"
], function (Controller, JSONModel, fioriLibrary, tableLibrary, Filter, FilterOperator, HTML) {
    "use strict";

    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [], 
        _oDataRaw: [],

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();

            this.oRouter = oOwnerComponent.getRouter();            
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);

            var oDetailRecord = new JSONModel({
                    Data: []
                });
            this.getView().setModel(oDetailRecord, "detailRecord");
        },
        
        _onObjectMatched: function () {      
            var oMeta = this.getView().getModel("displayModel").getProperty("/Meta");
            var oData = this.getView().getModel("displayModel").getProperty("/Data"); 
               
            Promise.all([
                this._loadMeta(oMeta),
                this._loadData(oData)
            ]).then(function() {
                this._displayData(oData); 
            }.bind(this));
        },

        _displayData: function() {
            var oTable = this.byId("dataTable");

            const result = this._oDataRaw.map(record => {
                return this._oFieldName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn);
                    return cell || { value: "" }; 
                });
            });
        
            this.getView().getModel("displayModel").setProperty("/Data", result);
        
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
            
            //Đọc local storage
            var sTableName = this.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
            var sSavedData = window.localStorage.getItem(sStorageKey);
            
            var bVisibleDefault = (iIndex < 10); 
            if (sSavedData) {
                try {
                    var aSavedCols = JSON.parse(sSavedData);
                    //Tìm cấu hình lưu trữ của đúng cột
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

            return Object.values(groupData);
        },

        //Hàm logic personalization
        onPersonalization: function () {
            var that = this;
            var oTable = this.byId("dataTable");
            var aColumns = oTable.getColumns(); //Lấy mảng các cột đang có trên bảng

            if (!this._oPersoDialog) {
                this._oPersoDialog = new sap.m.Dialog({
                    title: "Personalization",
                    contentWidth: "400px",
                    contentHeight: "450px",
                    resizable: true,
                    draggable: true,
                    content: new sap.m.List({
                        mode: sap.m.ListMode.MultiSelect,
                        includeItemInSelection: true
                    }),
                    beginButton: new sap.m.Button({
                        type: "Emphasized",
                        text: "Save",
                        press: function () {
                            var oList = that._oPersoDialog.getContent()[0];
                            var aItems = oList.getItems();
                            var aSavedCols = [];

                            //Quét qua danh sách để xem người dùng chọn ẩn/hiện cột nào
                            aItems.forEach(function(oItem, index) {
                                var bSelected = oItem.getSelected();
                                var oColumn = aColumns[index];
                                
                                oColumn.setVisible(bSelected); //Ép bảng thay đổi trạng thái cột ngay lập tức

                                //Ghi nhận để lưu vào ổ cứng
                                aSavedCols.push({
                                    index: index,
                                    visible: bSelected
                                });
                            });

                            //Lưu mảng cấu hình vào local storage của trình duyệt
                            var sTableName = that.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
                            var sStorageKey = "myApp_" + sTableName + "_GridPerso";
                            window.localStorage.setItem(sStorageKey, JSON.stringify(aSavedCols));

                            that._oPersoDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oPersoDialog.close();
                        }
                    })
                });
                this.getView().addDependent(this._oPersoDialog);
            }

            //Làm mới nội dung danh sách mỗi khi mở dialog
            var oList = this._oPersoDialog.getContent()[0];
            oList.removeAllItems();
            
            aColumns.forEach(function(oColumn, index) {
                //Trích xuất tên cột từ nút bấm header
                var oHeaderControl = oColumn.getLabel();
                var sText = "Column " + index;
                if (oHeaderControl && typeof oHeaderControl.getText === "function") {
                    sText = oHeaderControl.getText();
                }
                
                //Tạo một dòng checkbox
                var oItem = new sap.m.StandardListItem({
                    title: sText,
                    selected: oColumn.getVisible()
                });
                oList.addItem(oItem);
            });

            this._oPersoDialog.open();
        },

        //Action sheet menu từ tiêu đề cột
        onColumnHeaderPress: function(oEvent) {
            var oButton = oEvent.getSource(); 
            var iColIndex = oButton.data("colIndex"); 
            var sColName = oButton.data("colName"); 
            var that = this;

            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");
            var aSorters = oBinding ? oBinding.aSorters : [];
            
            var sCurrentSortKey = "none"; 
            if (aSorters && aSorters.length > 0) {
                var oCurrentSorter = aSorters[0];
                if (oCurrentSorter.sPath === (iColIndex + "/value")) {
                    sCurrentSortKey = oCurrentSorter.bDescending ? "desc" : "asc";
                }
            }

            if (this._oColumnPopover) {
                this._oColumnPopover.destroy();
            }

            this._oColumnPopover = new sap.m.ResponsivePopover({
                showHeader: true,
                customHeader: new sap.m.Bar({
                    contentMiddle: [
                        new sap.m.Title({ text: "Column Settings" })
                    ],
                    contentRight: [
                        new sap.m.Button({
                            icon: "sap-icon://decline",
                            type: "Transparent",
                            press: function() {
                                that._oColumnPopover.close();
                            }
                        })
                    ]
                }),
                contentWidth: "220px", 
                placement: "Bottom",
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: "Sort By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween", 
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({ text: sColName }), 
                                    new sap.m.SegmentedButton({
                                        selectedKey: sCurrentSortKey,
                                        selectionChange: function(oEventSelect) {
                                            var oItem = oEventSelect.getParameter("item");
                                            var sKey = oItem ? oItem.getKey() : oEventSelect.getSource().getSelectedKey();
                                            var bDescending = (sKey === "desc");
                                            
                                            that.onSortColumnDirect(bDescending, iColIndex);
                                        },
                                        items: [
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-ascending", key: "asc", tooltip: "Ascending" }),
                                            new sap.m.SegmentedButtonItem({ icon: "sap-icon://sort-descending", key: "desc", tooltip: "Descending" })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            new HTML({ content: "<hr style='border: 0; border-top: 1px solid #e5e5e5; margin: 10px 0;'/>" }),

                            new sap.m.Label({ text: "Group By", design: "Bold" }).addStyleClass("sapUiTinyMarginBottom"),
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                width: "100%",
                                items: [
                                    new sap.m.Text({ text: sColName }),
                                    new sap.m.Switch({
                                        state: false,
                                        customTextOn: " ", customTextOff: " ",
                                        change: function(oEventSwitch) {
                                            sap.m.MessageToast.show("Group By function is under development.");
                                        }
                                    })
                                ]
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin") 
                ]
            });

            this.getView().addDependent(this._oColumnPopover);
            this._oColumnPopover.openBy(oButton);
        },

        onSortColumnDirect: function(bDescending, iColIndex) {
            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");

            if (!oBinding) return;

            var sPath = iColIndex + "/value";
            
            var oSorter = new sap.ui.model.Sorter({
                path: sPath,
                descending: bDescending,
                comparator: function(a, b) {
                    if (a === b) return 0;
                    if (a === null || a === undefined) return -1;
                    if (b === null || b === undefined) return 1;
                    
                    var numA = parseFloat(a);
                    var numB = parseFloat(b);
                    
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    
                    return a.toString().localeCompare(b.toString());
                }
            });

            oBinding.sort([oSorter]);
        },

        //Hàm search 
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");

            if (sQuery) {
                var oFilter = new Filter({ 
                    path: "",
                    test: function (aRow) {
                        if (!aRow || !Array.isArray(aRow)) return false;
                        return aRow.some(function (oCell) { 
                            return oCell && oCell.value && oCell.value.toString().toLowerCase().includes(sQuery.toLowerCase());
                        });
                    }
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]); 
            }
        },

        //Mở popup Filter
        onFilter: function () {
            if (!this._oFilterDialog) {
                this._oFilterDialog = new sap.m.ViewSettingsDialog({
                    title: "Filter",
                    confirm: this.onFilterConfirm.bind(this)
                });
                this.getView().addDependent(this._oFilterDialog);
            }
            
            this._oFilterDialog.removeAllFilterItems();
            var aData = this.getView().getModel("displayModel").getProperty("/Data");
            
            this._oFieldName.forEach(function (sFieldName, index) {
                var oFilterItem = new sap.m.ViewSettingsFilterItem({
                    key: index,
                    text: sFieldName
                });
                
                var aUniqueValues = [];
                if (aData) {
                    aData.forEach(function(aRow) {
                        if (aRow[index] && aRow[index].value) {
                            var sValue = aRow[index].value.toString();
                            if (aUniqueValues.indexOf(sValue) === -1) {
                                aUniqueValues.push(sValue);
                            }
                        }
                    });
                }
                
                aUniqueValues.forEach(function(sValue) {
                    oFilterItem.addItem(new sap.m.ViewSettingsItem({
                        key: index + "___" + sValue, 
                        text: sValue
                    }));
                });

                this._oFilterDialog.addFilterItem(oFilterItem);
            }.bind(this));

            this._oFilterDialog.open();
        },

        //Nếu bấm ok thì execute logic lọc
        onFilterConfirm: function (oEvent) {
            var oTable = this.byId("dataTable"),
                mParams = oEvent.getParameters(),
                oBinding = oTable.getBinding("rows");

            var aSelectedItems = mParams.filterItems;
            if (aSelectedItems.length === 0) {
                oBinding.filter([]);
                return;
            }

            var oFilterGroups = {};
            aSelectedItems.forEach(function(oItem) {
                var aSplit = oItem.getKey().split("___");
                var sColIndex = aSplit[0];
                var sValue = aSplit[1];
                
                if (!oFilterGroups[sColIndex]) {
                    oFilterGroups[sColIndex] = [];
                }
                oFilterGroups[sColIndex].push(new Filter(sColIndex + "/value", FilterOperator.EQ, sValue)); 
            });

            var aAndFilters = [];
            for (var key in oFilterGroups) {
                if (oFilterGroups[key].length > 1) {
                    aAndFilters.push(new Filter({filters: oFilterGroups[key], and: false})); 
                } else {
                    aAndFilters.push(oFilterGroups[key][0]);
                }
            }

            var oFinalFilter = new Filter({filters: aAndFilters, and: true}); 
            oBinding.filter([oFinalFilter]);
        },

        //Hàm add
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
        }
    });
});