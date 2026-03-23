sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zapp/models/GetData"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {

        onInit: function () {
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");

            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            this._loadColumnState(); 
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
            var sLang = this.getView().getModel("settingsModel").getProperty("/selectedLanguage") || "E";
            
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            this.getView().getModel("realData").setProperty("/UniqueTables", []);

            if (!sTableName && !sTableDesc) {
                MessageToast.show(oBundle.getText("msgEnterKeyword"));
                return;
            }

            if (sTableName && !sTableName.startsWith("Z") && !sTableName.startsWith("Y")) {
                MessageBox.warning(oBundle.getText("msgAccessDenied"));
                return;
            }

            this.onSetTable(sTableName, sTableDesc, sLang);
        },

        onSuggestionSelect: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sTableName = oSelectedItem.getKey(); 
                var sDescription = oSelectedItem.getText(); 
                
                this.byId("searchInput").setValue(sTableName);
                this.byId("searchDescInput").setValue(sDescription);
                this.onSearch();
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

        onSetTable: function (sName, sDesc, sLang) {
            var oView = this.getView();
            var oTable = this.byId("dynamicTable");
            var oModel = oView.getModel(); 
            var oBundle = oView.getModel("i18n").getResourceBundle();
            
            oTable.setBusyIndicatorDelay(0);
            oTable.setBusy(true);
            
            GetData.loadMeta(oModel, sName, sDesc, sLang).then(function (oPayload) {
                oTable.setBusy(false);
                console.log(oPayload);

                var oDisplayModel = oView.getModel("displayModel");
                if (!oDisplayModel) {
                    oDisplayModel = new sap.ui.model.JSON.JSONModel();
                    oView.setModel(oDisplayModel, "displayModel");
                }
                oDisplayModel.setProperty("/Meta", oPayload.metadata);
                oDisplayModel.setProperty("/Data", oPayload.dataRows);

                var oOverall = oView.getModel("overall");
                if (oOverall) {
                    oOverall.setProperty("/tableName", sName);
                    oOverall.setProperty("/tabDes", sDesc);
                    oOverall.setProperty("/lang", sLang);
                    oOverall.setProperty("/count", oPayload.dataRows ? oPayload.dataRows.length : 0);
                }

                this._updateUniqueTablesList(oPayload);

                sap.m.MessageToast.show(oBundle.getText("msgTableLoaded"));
            }.bind(this))
            .catch(function (oError) {
                    oTable.setBusy(false);
                    console.error("Main [onSetTable] - Có lỗi xảy ra:", oError);
                    
                    var sErrorMsg = oError.message || oBundle.getText("msgTableNotFound", [sName || sDesc]);
                    sap.m.MessageBox.error(sErrorMsg);
                });
        },
        
        _updateUniqueTablesList: function(oPayload) {
            // Hàm này thay thế hoàn toàn việc gọi OData GET để nạp danh sách bảng
            if (!oPayload || !oPayload.metadata || oPayload.metadata.length === 0) return;

            // ABAP JSON trả về CamelCase nên các trường sẽ có dạng tableName thay vì table_name
            var oMeta = oPayload.metadata[0];
            var oFirstRow = (oPayload.dataRows && oPayload.dataRows.length > 0) ? oPayload.dataRows[0] : {};

            var oNewTable = {
                table_name: oMeta.tableName || oMeta.table_name,
                table_description: oMeta.tableDescription || oMeta.table_description,
                user_name: oFirstRow.createdBy || oFirstRow.user_name || "Unknown",
                change_at: oFirstRow.createdAt ? new Date(oFirstRow.createdAt) : new Date(),
                field_count: oPayload.metadata.length
            };

            var oRealDataModel = this.getView().getModel("realData");
            var aUniqueTables = oRealDataModel.getProperty("/UniqueTables") || [];

            // Tránh thêm trùng 1 bảng nhiều lần
            var iIndex = aUniqueTables.findIndex(function(t) { return t.table_name === oNewTable.table_name; });
            if (iIndex !== -1) {
                aUniqueTables[iIndex] = oNewTable;
            } else {
                aUniqueTables.push(oNewTable);
            }

            oRealDataModel.setProperty("/UniqueTables", aUniqueTables);
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
                return { visible: col.getVisible() };
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
        },
    });
});