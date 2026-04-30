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
            var oView = this.getView(),
                oDisplayModel = oView.getModel("displayModel"),
                aData = oDisplayModel.getProperty("/Data"),
                aMeta = oDisplayModel.getProperty("/Meta"),
                that = this; 
            
            if (aMeta && typeof aMeta.getContexts === "function") {
                aMeta = aMeta.getContexts().map(function(c) { return c.getObject(); });
            }

            if (!this._oAdaptFilterDialog) {
                this._oFilterGrid = new Grid({
                    defaultSpan: "XL4 L4 M6 S12", hSpacing: 1, vSpacing: 1
                }).addStyleClass("sapUiSmallMarginTop sapUiSmallMarginBegin sapUiSmallMarginEnd");

                this._oAdaptFilterDialog = new Dialog({
                    contentWidth: "900px", 
                    content: [this._oFilterGrid],
                    customHeader: new Bar({
                        contentMiddle: [new Title({ text: "Adapt Filters" })],
                        contentRight: [ new Button({ text: "Clear", type: "Transparent", press: FilterHelper._clearAdaptFilters.bind(this) }) ]
                    }),
                    beginButton: new Button({
                        type: "Emphasized", text: "Go",
                        press: function () { FilterHelper._applyAdaptFilters.call(that); that._oAdaptFilterDialog.close(); }
                    }),
                    endButton: new Button({ text: "Cancel", press: function () { that._oAdaptFilterDialog.close(); } })
                });
                oView.addDependent(this._oAdaptFilterDialog);
            }

            this._oFilterGrid.removeAllContent();
            this._aFilterInputs = [];

            aMeta.forEach(function (oMeta, index) {
                var sFieldLabel = oMeta.scrtext_l || oMeta.scrtext_m || oMeta.fieldname || "Col " + index,
                    aUniqueValues = [];
                
                if (aData) {
                    aData.forEach(function(oRow) {
                        var oCell = oRow[index];
                        if (oCell && oCell.value !== undefined && oCell.value !== null) {
                            var sValue = oCell.value.toString().trim();
                            if (sValue !== "" && aUniqueValues.indexOf(sValue) === -1) {
                                aUniqueValues.push(sValue);
                            }
                        }
                    });
                }

                if (aUniqueValues.length > 0) {
                    aUniqueValues.sort(); 
                    var oMultiInput = new MultiInput({
                        showValueHelp: true,
                        valueHelpRequest: function(oEvent) {
                            FilterHelper._openValueHelpDialog.call(that, oEvent.getSource(), aUniqueValues, sFieldLabel);
                        }
                    });
                    
                    oMultiInput.data("colIndex", index.toString());

                    if (that._oActiveFilterTokens && that._oActiveFilterTokens[index]) {
                        that._oActiveFilterTokens[index].forEach(function(sVal) {
                            oMultiInput.addToken(new Token({ key: sVal, text: sVal }));
                        });
                    }

                    that._oFilterGrid.addContent(new VBox({ items: [ new Label({ text: sFieldLabel, design: "Bold" }), oMultiInput ] }));
                    that._aFilterInputs.push(oMultiInput);
                }
            });

            this._oAdaptFilterDialog.open();
        },

        _openValueHelpDialog: function(oMultiInput, aUniqueValues, sFieldLabel) {
            var oDialogModel = new JSONModel(aUniqueValues.map(function(sValue) { return { title: sValue }; })),
                aExistingTokens = oMultiInput.getTokens().map(function(t) { return t.getKey(); }),
                oValueHelpDialog = new SelectDialog({
                    title: sFieldLabel, multiSelect: true, rememberSelections: true, contentWidth: "400px",
                    search: function(oEvent) {
                        var oFilter = new Filter("title", FilterOperator.Contains, oEvent.getParameter("value"));
                        oEvent.getSource().getBinding("items").filter([oFilter]);
                    },
                    confirm: function(oEvent) {
                        oEvent.getParameter("selectedItems").forEach(function(oItem) {
                            var sItemTitle = oItem.getTitle();
                            var bExists = oMultiInput.getTokens().some(function(t) { return t.getKey() === sItemTitle; });
                            if (!bExists) {
                                oMultiInput.addToken(new Token({ key: sItemTitle, text: sItemTitle }));
                            }
                        });
                    }
                });

            oValueHelpDialog.setModel(oDialogModel);
            oValueHelpDialog.bindAggregation("items", "/", new StandardListItem({ title: "{title}" }));

            oValueHelpDialog.getItems().forEach(function(oItem) {
                if (aExistingTokens.indexOf(oItem.getTitle()) !== -1) oItem.setSelected(true);
            });

            this.getView().addDependent(oValueHelpDialog);
            oValueHelpDialog.open();
        },

        _clearAdaptFilters: function() {
            if (this._aFilterInputs) {
                this._aFilterInputs.forEach(function(oInput) { 
                    oInput.removeAllTokens(); 
                    oInput.setValue("");
                });
            }
        },

        _applyAdaptFilters: function() {
            var oView = this.getView(),
                oTable = this.byId("dataTable") || this.byId("TablePage"),
                oBinding = oTable ? oTable.getBinding("rows") : null,
                oOverallModel = oView.getModel("overall"),
                oDisplayModel = oView.getModel("displayModel"),
                oFilterGroups = {},
                bHasFilter = false,
                iFilteredLength, iNewVisibleRows;

            if (!oBinding) return;

            this._oActiveFilterTokens = {}; 

            this._aFilterInputs.forEach(function(oInput) {
                var aTokens = oInput.getTokens(),
                    aValues = aTokens.map(function(t) { return t.getKey(); }),
                    sTypedValue = oInput.getValue().trim(),
                    sColIndex = oInput.data("colIndex");

                if (sTypedValue && aValues.indexOf(sTypedValue) === -1) {
                    aValues.push(sTypedValue);
                    oInput.setValue("");
                    oInput.addToken(new Token({ key: sTypedValue, text: sTypedValue }));
                }

                if (aValues.length > 0) {
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
                    test: function(oRow) {
                        if (!oRow || typeof oRow !== "object") return false;
                        for (var sColIndex in oFilterGroups) {
                            var aAllowedValues = oFilterGroups[sColIndex],
                                oCell = oRow[sColIndex];
                                
                            if (!oCell) return false;
                            
                            var sCellVal = oCell.value !== undefined && oCell.value !== null ? oCell.value.toString().trim() : "",
                                bMatch = aAllowedValues.some(function(sAllowed) { return sCellVal === sAllowed; });
                            
                            if (!bMatch) return false; 
                        }
                        return true; 
                    }
                });
                oBinding.filter([oCustomFilter]);
            }

            iFilteredLength = oBinding.getLength(); 
            iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            if (oOverallModel) {
                oOverallModel.setProperty("/count", iFilteredLength);
                oOverallModel.setProperty("/minRecord", iNewVisibleRows);
            }

            if (oDisplayModel) {
                oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
            }

            if (oTable) {
                oTable.setFirstVisibleRow(0);
            }
        }
    };

    return FilterHelper;
});