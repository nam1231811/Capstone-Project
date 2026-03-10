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
            var oSearchInput = this.byId("searchInput");
            var sQuery = oSearchInput.getValue();
           
            if (!sQuery || sQuery.trim() === "") {
                sap.m.MessageToast.show("Please input table name!");
                return;
            }
       
            sQuery = sQuery.trim().toUpperCase();
            var oTable = this.byId("dynamicTable");
            oTable.setBusy(true);
       
            // 1. Gọi hàm tạo binding
            this._loadMeta(sQuery);
       
            // 2. Kiểm tra xem binding có tồn tại không trước khi gọi requestContexts
            if (this._oODataListBinding) {
                this._oODataListBinding.requestContexts(0, 1000).then(function (aContexts) {
                    oTable.setBusy(false);
               
                    if (!aContexts || aContexts.length === 0) {
                        sap.m.MessageBox.information("Cannot find table: " + sQuery);
                        return;
                    }
               
                    // 3. LẤY DỮ LIỆU TỪ CONTEXTS (Đây là phần bạn đang thiếu)
                    var oUniqueMap = {};
                    aContexts.forEach(function (oContext) {
                        var item = oContext.getObject(); // Lấy data thực tế từ Backend trả về
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
               
                    var aUniqueTables = Object.values(oUniqueMap);
                    this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);
                    sap.m.MessageToast.show("Load data successfully!");
               
                }.bind(this)).catch(function (oError) {
                    oTable.setBusy(false);
                    sap.m.MessageBox.error("Backend Error: " + (oError.message || "Unknown Error"));
                }.bind(this));
            }
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
        },  

        _loadMeta: function(sQuery) {
        var oModel = this.getView().getModel(); // Model OData V4
            var aFilters = [
                new sap.ui.model.Filter("table_name", sap.ui.model.FilterOperator.EQ, sQuery)
            ];
            // Khởi tạo binding và gán vào biến global của controller
            this._oODataListBinding = oModel.bindList("/Meta", null, null, aFilters, {
                $$groupId: "$direct"
            });
       
            return this._oODataListBinding;
        },
    });
});