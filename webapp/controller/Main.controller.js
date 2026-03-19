sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/TablePersoController",
    "zapp/models/GetData"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, TablePersoController, GetData) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {

        onInit: function () {
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");

            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            this._initPersonalization(); 
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

            //Gọi action
            var sActionPath = "/Meta/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.SetTable(...)";
            var oAction = oModel.bindContext(sActionPath); 

            //Đóng gói gửi xuống backend
            oAction.setParameter("table_name", sName || "");
            oAction.setParameter("table_description", sDesc || "");
            oAction.setParameter("language", sLang);

            oAction.execute().then(function () {
                MessageToast.show(oBundle.getText("msgTableLoaded"));
                
                oModel.refresh();
                this._loadDataToTable(sName); 

            }.bind(this)).catch(function (oError) {
                oTable.setBusy(false); 
                var sErrorMsg = oError.message || oBundle.getText("msgTableNotFound", [sName || sDesc]);
                MessageBox.warning(sErrorMsg);
            });
        },

        _loadDataToTable: function(sTableName) {
            var oTable = this.byId("dynamicTable");
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!sTableName) return;  

            var oListBinding = this._loadMeta(sTableName);
 
            oListBinding.requestContexts(0, 1000).then(function (aContexts) {
                oTable.setBusy(false);
                
                if (!aContexts || aContexts.length === 0) {
                    this.getView().getModel("realData").setProperty("/UniqueTables", []);
                    MessageBox.information(oBundle.getText("msgNoDataFound"));
                    return;
                }

                var oUniqueMap = {};
                aContexts.forEach(function (oContext) {
                    var item = oContext.getObject();
                    var sId = item.table_name;
                    if (sId) {
                        var rawDate = item.change_at || item.created_at;
                        var oValidDate = rawDate ? new Date(rawDate) : null;

                        if (!oUniqueMap[sId]) {
                            oUniqueMap[sId] = {
                                table_name: sId,
                                table_description: item.table_description,
                                user_name: item.user_name,
                                change_at: oValidDate,
                                field_count: 1
                            };
                        } else {
                            oUniqueMap[sId].field_count += 1;
                        }
                    }
                });

                var aUniqueTables = Object.values(oUniqueMap);
                this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);

            }.bind(this)).catch(function(oError) {
                oTable.setBusy(false);
                MessageBox.error(oBundle.getText("msgLoadError", [sTableName]));
            });
        },

        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("realData");
            var sTableName = oContext.getProperty("table_name");
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
                        
                        //Lấy lại Input
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

        _initPersonalization: function () {
            var oPersoService = {
                getPersData: function () {
                    var oDeferred = new jQuery.Deferred();
                    var sData = window.localStorage.getItem("myAppTableConfig");
                    var oParsedData = sData ? JSON.parse(sData) : { _persoSchemaVersion: "1.0", aColumns: [] };
                    oDeferred.resolve(oParsedData);
                    return oDeferred.promise();
                },
                setPersData: function (oBundle) {
                    var oDeferred = new jQuery.Deferred();
                    window.localStorage.setItem("myAppTableConfig", JSON.stringify(oBundle));
                    oDeferred.resolve();
                    return oDeferred.promise();
                }
            };

            this._oTPC = new TablePersoController({
                table: this.byId("dynamicTable"),
                componentName: "demoApp",
                persoService: oPersoService
            }).activate();
        },

        onPersonalization: function () {
            this._oTPC.openDialog();
        },

        _loadMeta: function(sTableName) {
            var oModel = this.getView().getModel(); 
            return GetData.loadMeta(oModel, sTableName);
        }
    });
});