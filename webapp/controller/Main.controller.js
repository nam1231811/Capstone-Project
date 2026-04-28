sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "zapp/api/LoadData",
    "sap/m/MessageBox",
    "zapp/utils/DataFormatter",
    "zapp/utils/ValueHelp"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, LoadData, MessageBox, DataFormatter, ValueHelp) {
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
            ValueHelp.openTableValueHelp(this, {
                inputId: "searchInput",
                descInputId: "searchDescInput",
                callback: (sName, sDesc) => { 
                    this.onSearch();
                }
            })
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
                    var aMatchedTables = oPayload.matches.map(function (match) {
                        var sDate = match.changeDate;
                        var sTime = match.changeTime; 
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
                            table_name: match.tableName || match.table_name,
                            table_description: match.tableDescription || match.table_description,
                            user_name: match.userName || match.user_name || "Unknown",
                            change_at: oFullDate,
                            field_count: match.fieldCount || match.field_count || 0
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

        onOpenSettings: function () {
            if (!this._oLangDialog) {
                var oBundle = this.getView().getModel("i18n").getResourceBundle();
                this._oLangDialog = new sap.m.SelectDialog({
                    title: oBundle.getText("language"),
                    items: [
                        new sap.m.StandardListItem({ 
                            title: "English", 
                            description: "EN", 
                            type: "Active" 
                        }),
                        new sap.m.StandardListItem({ 
                            title: "Tiếng Việt", 
                            description: "VI", 
                            type: "Active" 
                        })
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