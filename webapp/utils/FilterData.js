sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/layout/Grid",
    "sap/m/Label",
    "sap/m/MultiInput",
    "sap/m/Token",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
    "sap/m/Bar",
    "sap/m/Title",
    "sap/m/VBox",
    "sap/ui/model/json/JSONModel"
], function(Filter, FilterOperator, Dialog, Button, Grid, Label, MultiInput, Token, SelectDialog, StandardListItem, Bar, Title, VBox, JSONModel) {
    "use strict";

    var FilterHelper = {
        onFilter: function () {
            var that = this; 
            var aData = this.getView().getModel("displayModel").getProperty("/UiData");
            var aMeta = this.getView().getModel("displayModel").getProperty("/UiMeta"); 

            if (!this._oAdaptFilterDialog) { //Khởi tạo popup
                
                //Dùng grid chia layout ngang
                this._oFilterGrid = new Grid({
                    defaultSpan: "XL4 L4 M6 S12", 
                    hSpacing: 1,
                    vSpacing: 1
                }).addStyleClass("sapUiSmallMarginTop sapUiSmallMarginBegin sapUiSmallMarginEnd");

                this._oAdaptFilterDialog = new Dialog({
                    contentWidth: "900px",
                    content: [this._oFilterGrid],
                    customHeader: new Bar({
                        contentMiddle: [new Title({ text: "Adapt Filters" })],
                        contentRight: [
                            new Button({
                                text: "Clear",
                                type: "Transparent",
                                press: function() {
                                    FilterHelper._clearAdaptFilters.call(that);
                                }
                            })
                        ]
                    }),
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "Go",
                        press: function () {
                            FilterHelper._applyAdaptFilters.call(that);
                            that._oAdaptFilterDialog.close();
                        }
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function () {
                            that._oAdaptFilterDialog.close();
                        }
                    })
                });
                this.getView().addDependent(this._oAdaptFilterDialog);
            }

            //Xóa sạch form cũ mỗi lần mở để render lại theo bảng mới
            this._oFilterGrid.removeAllContent();
            this._aFilterInputs = [];

            //Tự động sinh MultiInput
            aMeta.forEach(function (oMeta, index) {
                var sFieldLabel = oMeta.scrtext_l || oMeta.fieldname;
                
                var aUniqueValues = [];
                if (aData) {
                    aData.forEach(function(aRow) {
                        if (aRow[index] && aRow[index].value !== undefined && aRow[index].value !== null) {
                            var sValue = aRow[index].value.toString().trim();
                            if (aUniqueValues.indexOf(sValue) === -1 && sValue !== "") {
                                aUniqueValues.push(sValue);
                            }
                        }
                    });
                }

                if (aUniqueValues.length > 0) {
                    aUniqueValues.sort(); 

                    //Ô MultiInput
                    var oMultiInput = new MultiInput({
                        showValueHelp: true,
                        valueHelpRequest: function(oEvent) {
                            FilterHelper._openValueHelpDialog.call(that, oEvent.getSource(), aUniqueValues, sFieldLabel);
                        }
                    });
                    
                    oMultiInput.data("colIndex", index.toString());

                    //Khôi phục lại token
                    if (that._oActiveFilterTokens && that._oActiveFilterTokens[index]) {
                        that._oActiveFilterTokens[index].forEach(function(sVal) {
                            oMultiInput.addToken(new Token({ key: sVal, text: sVal }));
                        });
                    }

                    //Gói label và input vào VBox
                    var oFieldBox = new VBox({
                        items: [
                            new Label({ text: sFieldLabel, design: "Bold" }),
                            oMultiInput
                        ]
                    });

                    that._oFilterGrid.addContent(oFieldBox);
                    that._aFilterInputs.push(oMultiInput);
                }
            });

            this._oAdaptFilterDialog.open();
        },

        //Hàm mở popup
        _openValueHelpDialog: function(oMultiInput, aUniqueValues, sFieldLabel) {
            var aDataForDialog = aUniqueValues.map(function(sValue) {
                return { title: sValue };
            });
            var oDialogModel = new JSONModel(aDataForDialog);

            var oValueHelpDialog = new SelectDialog({
                title: sFieldLabel,
                multiSelect: true,
                rememberSelections: true,
                contentWidth: "400px",
                search: function(oEvent) {
                    var sValue = oEvent.getParameter("value");
                    var oFilter = new Filter("title", FilterOperator.Contains, sValue);
                    oEvent.getSource().getBinding("items").filter([oFilter]);
                },
                confirm: function(oEvent) {
                    var aSelectedItems = oEvent.getParameter("selectedItems");
                    oMultiInput.removeAllTokens(); 
                    
                    aSelectedItems.forEach(function(oItem) {
                        var sText = oItem.getTitle();
                        oMultiInput.addToken(new Token({
                            key: sText,
                            text: sText
                        }));
                    });
                }
            });

            oValueHelpDialog.setModel(oDialogModel);
            oValueHelpDialog.bindAggregation("items", "/", new StandardListItem({
                title: "{title}"
            }));

            var aExistingTokens = oMultiInput.getTokens().map(function(t) { return t.getKey(); });
            oValueHelpDialog.getItems().forEach(function(oItem) {
                if (aExistingTokens.indexOf(oItem.getTitle()) !== -1) {
                    oItem.setSelected(true);
                }
            });

            this.getView().addDependent(oValueHelpDialog);
            oValueHelpDialog.open();
        },

        //Xóa mọi bộ lọc
        _clearAdaptFilters: function() {
            if (this._aFilterInputs) {
                this._aFilterInputs.forEach(function(oInput) {
                    oInput.removeAllTokens();
                });
            }
        },

        //Áp dụng bộ lọc khi bấm Go
        _applyAdaptFilters: function() {
            var oTable = this.byId("dataTable"),
                oBinding = oTable.getBinding("rows");

            var oFilterGroups = {};
            var bHasFilter = false;
            this._oActiveFilterTokens = {}; 

            this._aFilterInputs.forEach(function(oInput) {
                var aTokens = oInput.getTokens();
                if (aTokens.length > 0) {
                    var sColIndex = oInput.data("colIndex");
                    var aValues = aTokens.map(function(t) { return t.getKey(); });
                    
                    oFilterGroups[sColIndex] = aValues;
                    this._oActiveFilterTokens[sColIndex] = aValues; 
                    bHasFilter = true;
                }
            }.bind(this));

            if (!bHasFilter) {
                oBinding.filter([]); 
            } else {
                var oCustomFilter = new Filter({
                    path: "", 
                    test: function(aRow) {
                        if (!aRow || !Array.isArray(aRow)) return false;

                        for (var sColIndex in oFilterGroups) {
                            var aAllowedValues = oFilterGroups[sColIndex]; 
                            var oCell = aRow[sColIndex];
                            
                            if (!oCell) return false;
                            var sCellVal = oCell.value !== undefined && oCell.value !== null ? oCell.value.toString().trim() : "";
                            
                            var bMatch = aAllowedValues.some(function(sAllowed) {
                                return sCellVal === sAllowed; 
                            });

                            if (!bMatch) { return false; }
                        }
                        return true; 
                    }
                });
                oBinding.filter([oCustomFilter]);
            }

            var iFilteredLength = oBinding.getLength(); 
            var iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            var bHasMore = iFilteredLength > iNewVisibleRows;
            
            var oDisplayModel = this.getView().getModel("displayModel");
            oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
            oDisplayModel.setProperty("/hasMore", bHasMore);
            oDisplayModel.setProperty("/hasLess", false);

            sap.ui.require(["zapp/utils/TablePaginationData"], function(TablePaginationData) {
                TablePaginationData.applyScrollLock(oTable, true);
            });
        }
    };

    return FilterHelper;
});