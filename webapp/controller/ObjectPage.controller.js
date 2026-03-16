sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/TablePersoController",
    "sap/ui/core/HTML"
], function (Controller, JSONModel, fioriLibrary, Filter, FilterOperator, TablePersoController, HTML) {
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
            var oTemplate = this.byId("columnTemplate");
            
            const result = this._oDataRaw.map(record => {
                return this._oFieldName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn);
                    return cell;
                });
            });
            console.log(result);
            
            this.getView().getModel("displayModel").setProperty("/Data", result);
            oTemplate.bindCells({
                path: "displayModel>", 
                factory: function(sId, oContext) {
                    return new sap.m.Text({
                        text: "{displayModel>value}"
                    });
                }
            });
            
            oTable.bindItems({
                path: "displayModel>/Data",
                template: oTemplate
            });

            oTable.destroyColumns(); 
            
            //Hàm vẽ cột động
            oTable.bindAggregation("columns", {
                path: "displayModel>/Meta",
                factory: this.createDynamicColumn.bind(this)
            });

            //Set time để table render xong thì gọi hàm personalization
            setTimeout(function() {
                this._initPersonalization();
            }.bind(this), 0);
        },

        //Hàm dùng Factory để sinh ra các thẻ column với ID tĩnh và tiêu đề có thể click
        createDynamicColumn: function(sId, oContext) {
            var oMeta = oContext.getObject();
            var sColName = (oMeta && oMeta.fieldname) ? oMeta.fieldname : "unknown_col";
            var sBaseId = "col_" + sColName;

            var oExistingCol = this.getView().byId(sBaseId);
            if (oExistingCol) {
                oExistingCol.destroy();
            }

            var sStableId = this.getView().createId(sBaseId);
            
            var sPath = oContext.getPath(); //Trả về đúng chuỗi
            var iIndex = parseInt(sPath.split("/").pop(), 10); //Cắt lấy số cuối cùng làm thứ tự cột
            var bVisibleDefault = (iIndex < 10); //Mặc định hiển thị 10 cột đầu tiên

            var sHeaderText = (oMeta && oMeta.scrtext_l) ? oMeta.scrtext_l : "N/A";
            var oHeaderButton = new sap.m.Button({
                text: sHeaderText,
                type: "Transparent",
                press: this.onColumnHeaderPress.bind(this)
            });

            //Gắn vị trí index của cột vào nút bấm
            oHeaderButton.addCustomData(new sap.ui.core.CustomData({
                key: "colIndex",
                value: iIndex
            }));
            oHeaderButton.addCustomData(new sap.ui.core.CustomData({ 
                key: "colName", 
                value: sHeaderText 
            }));

            return new sap.m.Column(sStableId, {
                header: oHeaderButton, 
                visible: bVisibleDefault 
            });
        },
        
        _loadMeta: function(meta) {
            return meta.requestContexts().then(function (aMetaContexts) {
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                console.log(this._oMetaRaw);
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
                console.log(this._oDataRaw);
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
        _initPersonalization: function () {
            var sTableName = this.getView().getModel("overall").getProperty("/tableName") || "DefaultTable";
            var sStorageKey = "myApp_" + sTableName + "_Config";

            var oPersoService = {
                oData: { _persoSchemaVersion: "1.0", aColumns: [] },
                getPersData: function () {
                    var oDeferred = new jQuery.Deferred();
                    var sData = window.localStorage.getItem(sStorageKey);
                    var oBundle = sData ? JSON.parse(sData) : this.oData;
                    oDeferred.resolve(oBundle);
                    return oDeferred.promise();
                }.bind(this),
                
                setPersData: function (oBundle) {
                    var oDeferred = new jQuery.Deferred();
                    window.localStorage.setItem(sStorageKey, JSON.stringify(oBundle));
                    oDeferred.resolve();
                    return oDeferred.promise();
                }.bind(this),
                
                getResetPersData: function () {
                    var oDeferred = new jQuery.Deferred();
                    window.localStorage.removeItem(sStorageKey);
                    setTimeout(function () { oDeferred.resolve(this.oData); }.bind(this), 500);
                    return oDeferred.promise();
                }.bind(this)
            };

            if (this._oTPC) {
                this._oTPC.destroy();
            }

            this._oTPC = new TablePersoController({
                table: this.byId("dataTable"),
                componentName: "demoAppObjPage",
                persoService: oPersoService
            }).activate();
        },

        onPersonalization: function () {
            if (this._oTPC) {
                this._oTPC.openDialog();
            }
        },

        //Action menu khi bấm vào tiêu đề cột
        onColumnHeaderPress: function(oEvent) {
            var oButton = oEvent.getSource(); 
            var iColIndex = oButton.data("colIndex"); 
            var sColName = oButton.data("colName"); 
            var that = this;

            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("items");
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
            var oBinding = oTable.getBinding("items");

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
            var oBinding = oTable.getBinding("items");

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

        //Hàm sort
        onSort: function () {
            if (!this._oSortDialog) {
                this._oSortDialog = new sap.m.ViewSettingsDialog({
                    title: "Sort",
                    confirm: this.onSortConfirm.bind(this)
                });
                this.getView().addDependent(this._oSortDialog);
            }
            
            this._oSortDialog.removeAllSortItems();
            this._oFieldName.forEach(function (sFieldName, index) {
                this._oSortDialog.addSortItem(new sap.m.ViewSettingsItem({
                    key: index, 
                    text: sFieldName
                }));
            }.bind(this));

            this._oSortDialog.open();
        },

        //Execute logic khi bấm ok
        onSortConfirm: function (oEvent) {
            var oTable = this.byId("dataTable"),
                mParams = oEvent.getParameters(),
                oBinding = oTable.getBinding("items"),
                sPath,
                bDescending,
                aSorters = [];

            var oSortItem = mParams.sortItem;
            if (oSortItem) {
                var sColIndex = oSortItem.getKey(); 
                bDescending = mParams.sortDescending;
                sPath = sColIndex + "/value";
                aSorters.push(new sap.ui.model.Sorter(sPath, bDescending));
            }
            oBinding.sort(aSorters);
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
                oBinding = oTable.getBinding("items");

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
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                var tableName = this.getView().getModel("view").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("DetailData", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
        }
    });
});