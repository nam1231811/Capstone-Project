sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "zapp/api/LoadData",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, LoadData, MessageBox) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {

        onInit: function () {
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");

            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            this._loadColumnState(); 

            var oTableInput = this.byId("searchInput");
            if (oTableInput) {
                oTableInput.setShowSuggestion(false);
                if (oTableInput.setAutocomplete) oTableInput.setAutocomplete(false);
            }

            var oDescInput = this.byId("searchDescInput");
            if (oDescInput) {
                oDescInput.setShowSuggestion(false);
                if (oDescInput.setAutocomplete) oDescInput.setAutocomplete(false);
            }
        },

        onValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            var oBundle = oView.getModel("i18n").getResourceBundle();

            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = new sap.m.TableSelectDialog({
                    title: oBundle.getText("listTableTitle"), 
                    busyIndicatorDelay: 0, 
                    noDataText: oBundle.getText("noDataText"), 
                    contentWidth: "50%",
                    growing: true,                           
                    growingThreshold: 20,                    

                    search: function (oEvt) {
                        var sValue = oEvt.getParameter("value");
                        var oFilter = new Filter({
                            filters: [
                                new Filter("TableName", FilterOperator.Contains, sValue),
                                new Filter("Description", FilterOperator.Contains, sValue)
                            ],
                            and: false
                        });
                        oEvt.getSource().getBinding("items").filter([oFilter]);
                    },
                    
                    confirm: function (oEvt) {
                        var oSelectedItem = oEvt.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sName = oSelectedItem.getCells()[0].getTitle(); 
                            var sDesc = oSelectedItem.getCells()[1].getText();  
                            this.byId("searchInput").setValue(sName);
                            this.byId("searchDescInput").setValue(sDesc);
                            this.onSearch(); 
                        }
                    }.bind(this),
                    
                    columns: [
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableName"), design: "Bold" }) 
                        }),
                        new sap.m.Column({ 
                            header: new sap.m.Label({ text: oBundle.getText("tableDesc"), design: "Bold" }),
                            minScreenWidth: "Tablet", 
                            demandPopin: true         
                        })
                    ]
                });

                oView.addDependent(this._pValueHelpDialog);

                this._pValueHelpDialog.bindAggregation("items", {
                    path: "/TableLookup", 
                    template: new sap.m.ColumnListItem({
                        type: "Active", 
                        cells: [
                            new sap.m.ObjectIdentifier({ 
                                title: "{TableName}",
                            }),
                            new sap.m.Text({ 
                                text: "{Description}", 
                                wrapping: true 
                            })
                        ]
                    })
                });
            }

            var oBinding = this._pValueHelpDialog.getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
            if (this._pValueHelpDialog._oSearchField) {
                this._pValueHelpDialog._oSearchField.setValue("");
            }

            this._pValueHelpDialog.open();
        },

        onSearch: function () {
            var sTableName = this.byId("searchInput").getValue().trim().toUpperCase();
            var sTableDesc = this.byId("searchDescInput").getValue().trim();

            this._fetchTableList(sTableName, sTableDesc);
        },

        _fetchTableList: function(sName, sDesc) {
            var oView = this.getView();
            var oTable = this.byId("dynamicTable");
            var oModel = oView.getModel();
            var oBundle = oView.getModel("i18n").getResourceBundle();
            
            oTable.setBusy(true);
            this.getView().getModel("realData").setProperty("/UniqueTables", []); 

            var sSearchName = sName;
            var sSearchDesc = sDesc;

            if (sSearchName && sSearchName.indexOf("*") === -1) {
                sSearchName = sSearchName + "*";
            }
            
            if (sSearchDesc && sSearchDesc.indexOf("*") === -1) {
                sSearchDesc = "*" + sSearchDesc + "*";
            }

            LoadData.searchTables(oModel, sSearchName, sSearchDesc).then(function (oPayload) {
                oTable.setBusy(false);
                
                if (oPayload && oPayload.status === "MULTIPLE" && oPayload.matches) {
                    var aMatchedTables = oPayload.matches.map(function (m) {
                        var sDate = m.changeDate;
                        var sTime = m.changeTime; 
                        var oFullDate = null;

                        if (sDate && sDate !== "0000-00-00") {
                            var sFormattedTime = "00:00:00";
                            if (sTime) {
                                var sTimeStr = sTime.toString().replace(/:/g, ""); 
                                if (sTimeStr.length >= 6) {
                                    sFormattedTime = sTimeStr.substring(0, 2) + ":" + sTimeStr.substring(2, 4) + ":" + sTimeStr.substring(4, 6);
                                } else {
                                    sFormattedTime = sTime.toString();
                                }
                            }
                            oFullDate = new Date(sDate + "T" + sFormattedTime);
                        }

                        return {
                            table_name: m.tableName || m.table_name,
                            table_description: m.tableDescription || m.table_description,
                            user_name: m.userName || m.user_name || "Unknown",
                            change_at: oFullDate,
                            field_count: m.fieldCount || m.field_count || 0
                        };
                    });

                    this.getView().getModel("realData").setProperty("/UniqueTables", aMatchedTables);
                    
                    var oDisplayModel = oView.getModel("displayModel");
                    if (oDisplayModel) {
                        oDisplayModel.setProperty("/Meta", null);
                        oDisplayModel.setProperty("/Data", null);
                    }

                    MessageToast.show(oBundle.getText("msgFoundTables", [aMatchedTables.length]));
                } else {
                    MessageBox.information(oBundle.getText("msgNoMatchingTables"));
                }
            }.bind(this)).catch(function (oError) {
                oTable.setBusy(false);
                var sErrMsg = oError.message ? oError.message.toLowerCase() : "";
                if (sErrMsg.includes("not found") || sErrMsg.includes("không tìm thấy") || sErrMsg.includes("không tồn tại") || sErrMsg.includes("does not exist") || sErrMsg.includes("009") || sErrMsg.includes("007")) {
                    MessageBox.warning(oBundle.getText("msgTableNotFound", [sName || sDesc]));
                } else {
                    MessageBox.error(oError.message);
                }
            });
        },

        onSuggestionSelect: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sTableName = oSelectedItem.getKey(); 
                var sDescription = oSelectedItem.getText(); 
                
                this.byId("searchInput").setValue(sTableName);
                this.byId("searchDescInput").setValue(sDescription);
                
            }
        },

        onClear: function () {
            this.byId("searchInput").setValue("");
            this.byId("searchDescInput").setValue("");
            this.getView().getModel("realData").setProperty("/UniqueTables", []);
            
            var oDisplayModel = this.getView().getModel("displayModel");
            if (oDisplayModel) {
                oDisplayModel.setProperty("/Meta", null);
                oDisplayModel.setProperty("/Data", null);
            }

            MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("msgDataCleared"));
        },

        onRowPress: function (oEvent) {
            var oRowContext = oEvent.getParameter("rowContext");
            if (!oRowContext) return;
            
            var sTableName = oRowContext.getProperty("table_name");

            this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                tableName: sTableName,
                newTable: true
            });
        },

        _updateUniqueTablesList: function(oPayload) {
            if (!oPayload || !oPayload.metadata || oPayload.metadata.length === 0) return;

            var oMeta = oPayload.metadata[0];
            var oFirstRow = (oPayload.dataRows && oPayload.dataRows.length > 0) ? oPayload.dataRows[0] : {};

            var parseAbapDate = function(sDate) {
                if (!sDate) {
                    return new Date()
                };
                var s = sDate.toString().split(".")[0];
                if (s.length >= 14) {
                    return new Date(Date.UTC(
                        parseInt(s.substring(0, 4), 10),   
                        parseInt(s.substring(4, 6), 10) - 1, 
                        parseInt(s.substring(6, 8), 10),   
                        parseInt(s.substring(8, 10), 10),  
                        parseInt(s.substring(10, 12), 10),
                        parseInt(s.substring(12, 14), 10)  
                    ));
                }
                return new Date(sDate);
            };

            var oNewTable = {
                table_name: oMeta.tableName || oMeta.table_name,
                table_description: oMeta.tableDescription || oMeta.table_description,
                user_name: oFirstRow.changedBy || oFirstRow.createdBy || oFirstRow.user_name || "Unknown",
                change_at: parseAbapDate(oFirstRow.changedAt || oFirstRow.createdAt),
                field_count: oPayload.metadata.length
            };

            var oRealDataModel = this.getView().getModel("realData");
            var aUniqueTables = oRealDataModel.getProperty("/UniqueTables") || [];

            var iIndex = aUniqueTables.findIndex(function(t) { 
                return t.table_name === oNewTable.table_name; 
            });

            if (iIndex !== -1) {
                aUniqueTables[iIndex] = oNewTable;
            } else {
                aUniqueTables.push(oNewTable);
            }

            oRealDataModel.setProperty("/UniqueTables", aUniqueTables);
        },

        onOpenSettings: function () {
            if (!this._oLangDialog) {
                var oBundle = this.getView().getModel("i18n").getResourceBundle();
                this._oLangDialog = new sap.m.SelectDialog({
                    title: oBundle.getText("language"),
                    items: [
                        new sap.m.StandardListItem({ title: "English", description: "EN", type: "Active" }),
                        new sap.m.StandardListItem({ title: "Tiếng Việt", description: "VI", type: "Active" })
                    ],
                    confirm: function (oEvent) {
                        var sLangCode = oEvent.getParameter("selectedItem").getDescription();
                        var sBackendLang = (sLangCode === "VI") ? "V" : "E";
                        this.getView().getModel("settingsModel").setProperty("/selectedLanguage", sBackendLang);
                        var sUiLang = (sLangCode === "VI") ? "vi" : "en";
                        sap.ui.getCore().getConfiguration().setLanguage(sUiLang);
                        
                        var oTableInput = this.byId("searchInput");
                        var oDescInput = this.byId("searchDescInput");
                        var sName = oTableInput ? oTableInput.getValue().trim() : "";
                        var sDesc = oDescInput ? oDescInput.getValue().trim() : "";

                        if (sName || sDesc) {
                            this.onSearch();
                        }
                    }.bind(this)
                });
            }
            this._oLangDialog.open();
        },

        _loadColumnState: function() {
            var sData = window.localStorage.getItem("myAppTableConfig_UI");
            if (sData) {
                var aColStates = JSON.parse(sData);
                var oTable = this.byId("dynamicTable");
                
                setTimeout(function() {
                    var aColumns = oTable.getColumns();
                    aColStates.forEach(function(state, idx) {
                        if (aColumns[idx]) {
                            aColumns[idx].setVisible(state.visible);
                        }
                    });
                }, 100);
            }
        },

        _saveColumnState: function() {
            var oTable = this.byId("dynamicTable");
            var aColumns = oTable.getColumns();
            var aColStates = aColumns.map(function(col) {
                return { 
                    visible: col.getVisible() 
                };
            });
            window.localStorage.setItem("myAppTableConfig_UI", JSON.stringify(aColStates));
        },

        onPersonalization: function () {
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            
            if (!this._oPersoDialog) {
                this._oPersoDialog = new sap.m.Dialog({
                    title: oBundle.getText("personalization") || "Personalization",
                    contentWidth: "300px",
                    content: new sap.m.List({
                        mode: "MultiSelect",
                        includeItemInSelection: true
                    }),
                    beginButton: new sap.m.Button({
                        text: "OK",
                        type: "Emphasized",
                        press: function() {
                            var oList = this._oPersoDialog.getContent()[0];
                            var aItems = oList.getItems();
                            var oTable = this.byId("dynamicTable");
                            var aColumns = oTable.getColumns();
                            
                            aItems.forEach(function(item, idx) {
                                if (aColumns[idx]) {
                                    aColumns[idx].setVisible(item.getSelected());
                                }
                            });
                            
                            this._saveColumnState();
                            this._oPersoDialog.close();
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function() {
                            this._oPersoDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._oPersoDialog);
            }
            
            var oList = this._oPersoDialog.getContent()[0];
            oList.removeAllItems();
            var oTable = this.byId("dynamicTable");
            
            oTable.getColumns().forEach(function(col) {
                var oLabel = col.getLabel();
                var sText = oLabel ? oLabel.getText() : "Column";
                var bVisible = col.getVisible();
                
                oList.addItem(new sap.m.StandardListItem({
                    title: sText,
                    selected: bVisible
                }));
            });
            
            this._oPersoDialog.open();
        }
    });
});