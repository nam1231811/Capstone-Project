sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/TablePersoController"
], function (Controller, JSONModel, Filter, FilterOperator, BusyIndicator, MessageBox, MessageToast, TablePersoController) {
    "use strict";

    // Lưu trữ cấu hình (Local Storage)
    var DemoPersoService = {
        oData: { _persoSchemaVersion: "1.0", aColumns: [] },
        getPersData: function () {
            var oDeferred = new jQuery.Deferred();
            var sData = window.localStorage.getItem("myAppTableConfig");
            var oBundle = sData ? JSON.parse(sData) : this.oData;
            oDeferred.resolve(oBundle);
            return oDeferred.promise();
        },
        setPersData: function (oBundle) {
            var oDeferred = new jQuery.Deferred();
            window.localStorage.setItem("myAppTableConfig", JSON.stringify(oBundle));
            oDeferred.resolve();
            return oDeferred.promise();
        },
        getResetPersData: function () {
            var oDeferred = new jQuery.Deferred();
            window.localStorage.removeItem("myAppTableConfig");
            setTimeout(function () { oDeferred.resolve(this.oData); }.bind(this), 500);
            return oDeferred.promise();
        }
    };

    return Controller.extend("zapp.controller.Main", {

        onInit: function () {
            // Khởi tạo Model cục bộ để chứa dữ liệu bảng đã gộp
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");
            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");
            
            // Khai báo biến toàn cục
            this._oODataListBinding = null;

            // Khởi tạo model personalization
            this._oTPC = new TablePersoController({
                table: this.byId("dynamicTable"),
                componentName: "demoApp",
                persoService: DemoPersoService
            }).activate();
        },

        // Hàm mở personalization
        onPersonalization: function (oEvent) {
            this._oTPC.openDialog();
        },

        // Hàm mở settings chọn ngôn ngữ
        onOpenSettings: function () {
            if (!this._oLangDialog) {
                this._oLangDialog = new sap.m.SelectDialog({
                    title: "Select Language / Chọn ngôn ngữ",
                    items: [
                        new sap.m.StandardListItem({ title: "English", description: "EN", type: "Active" }),
                        new sap.m.StandardListItem({ title: "Tiếng Việt", description: "VI", type: "Active" })
                    ],
                    confirm: function (oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sLangCode = oSelectedItem.getDescription();

                            sap.ui.getCore().getConfiguration().setLanguage(sLangCode);

                            var sBackendLang = (sLangCode === "vi") ? "V" : "E";
                            this.getView().getModel("settingsModel").setProperty("/selectedLanguage", sBackendLang);
                            
                            MessageToast.show("Switched to " + oSelectedItem.getTitle());
                            
                            this.onSearch();
                        }
                    }.bind(this)
                });
            }
            this._oLangDialog.open();
        },

        // Hàm search và gọi ODataV4
        onSearch: function () {
            var sQuery = this.byId("searchInput").getValue();
            
            if (!sQuery || sQuery.trim() === "") {
                return MessageToast.show("Please input table name!");
            }

            sQuery = sQuery.trim().toUpperCase();
            this.byId("dynamicTable").setBusy(true);

            if (!this._oODataListBinding) {
                var oModel = this.getOwnerComponent().getModel();
                this._oODataListBinding = oModel.bindList("/Meta", null, null, null, {
                    $$groupId: "$direct"
                });
            }

            this.getView().getModel("realData").setProperty("/UniqueTables", []);

            var sSelectedLang = this.getView().getModel("settingsModel").getProperty("/selectedLanguage");

            var aFilters = [
                new Filter("table_name", FilterOperator.Contains, sQuery),
                //new Filter("language", FilterOperator.EQ, sSelectedLang)
            ];
            this._oODataListBinding.filter(aFilters);

            // Lấy dữ liệu
            this._oODataListBinding.requestContexts(0, 1000).then(function (aContexts) {
                this.byId("dynamicTable").setBusy(false);

                if (aContexts.length === 0) {
                    return MessageBox.information("Cannot found table: " + sQuery);
                }

                var aRawData = aContexts.map(function(oContext) { 
                    return oContext.getObject(); 
                });

                // Gộp bảng + Đếm cột (Tạm thời)
                var oUniqueMap = {};
                aRawData.forEach(function (item) {
                    var sTableName = item.table_name;
                    if (sTableName) {
                        if (!oUniqueMap[sTableName]) {
                            oUniqueMap[sTableName] = {
                                table_name: sTableName,
                                table_description: item.table_description,
                                field_count: 1,
                                user_name: item.user_name 
                            };
                        } else {
                            oUniqueMap[sTableName].field_count += 1;
                        }
                    }
                });

                // Đẩy ra màn hình
                var aUniqueTables = Object.values(oUniqueMap);
                this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);
                MessageToast.show("Load data successfully!");

            }.bind(this)).catch(function (oError) {
                this.byId("dynamicTable").setBusy(false);
                MessageBox.error("Error while connecting!: " + oError.message);
            });
        },

        // Hàm xóa bộ lọc
        onClear: function () {
            this.byId("searchInput").setValue("");
            this.getView().getModel("realData").setProperty("/UniqueTables", []);
            MessageToast.show("Filter cleared");
        },

        // Hàm bấm vào dòng sang Object Page
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("realData");
            var sTableName = oContext.getProperty("table_name");

            try {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteObjectPage", {
                    tableName: sTableName
                });
            } catch (e) {
                console.log("Router error: " + e.message);
            }
        }   
    });
});