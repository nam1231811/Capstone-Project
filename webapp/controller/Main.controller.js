sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/TablePersoController"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, TablePersoController) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {
        
        onInit: function () {
            //Khởi tạo models
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");
            
            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            var oDisplayModel = new JSONModel({});
            this.getOwnerComponent().setModel(oDisplayModel, "displayModel");

            //Khai báo biến toàn cục
            this._oODataListBinding = null;

            //Khởi tạo hàm logic personalization
            this._initPersonalization();
        },

        //Hàm logic personalization
        _initPersonalization: function () {
            var oPersoService = {
                oData: { _persoSchemaVersion: "1.0", aColumns: [] },
                getPersData: function () {
                    var oDeferred = new jQuery.Deferred();
                    var sData = window.localStorage.getItem("myAppTableConfig");
                    var oBundle = sData ? JSON.parse(sData) : this.oData;
                    oDeferred.resolve(oBundle);
                    return oDeferred.promise();
                }.bind(this),
                
                setPersData: function (oBundle) {
                    var oDeferred = new jQuery.Deferred();
                    window.localStorage.setItem("myAppTableConfig", JSON.stringify(oBundle));
                    oDeferred.resolve();
                    return oDeferred.promise();
                }.bind(this),
                
                getResetPersData: function () {
                    var oDeferred = new jQuery.Deferred();
                    window.localStorage.removeItem("myAppTableConfig");
                    setTimeout(function () { oDeferred.resolve(this.oData); }.bind(this), 500);
                    return oDeferred.promise();
                }.bind(this)
            };

            this._oTPC = new TablePersoController({
                table: this.byId("dynamicTable"),
                componentName: "demoApp",
                persoService: oPersoService
            }).activate();
        },
        
        _groupDataByRow: function (data) {
            if(!data || !Array.isArray(data)){
                return [];
            }
        },

        onPersonalization: function (oEvent) {
            this._oTPC.openDialog();
        },

        //Hàm logic chỉnh ngôn ngữ
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

        //Hàm logic search và lấy dữ liệu OData V4 từ backend
        onSearch: function () {
            //Lấy giá trị từ cả 2 ô tìm kiếm
            var sTableName = this.byId("searchInput").getValue().trim().toUpperCase();
            
            //Lấy thêm Description
            var oDescInput = this.byId("searchDescInput");
            var sTableDesc = oDescInput ? oDescInput.getValue().trim() : "";
            
            if (!sTableName && !sTableDesc) {
                MessageToast.show("Please input Table Name or Table Description!");
                return;
            }

            //Authorization: Chỉ cho phép search tên bảng bắt đầu bằng "Z" hoặc "Y" (Chỉ check nếu có nhập Tên)
            if (sTableName && !sTableName.startsWith("Z") && !sTableName.startsWith("Y")) {
                MessageBox.warning("Access denied!: You are only allowed to search for custom tables starting with 'Z' or 'Y'. \n\n(Chỉ được phép tìm kiếm các bảng tự tạo bắt đầu bằng Z hoặc Y!)", {
                    title: "Security Warning"
                });
                return; 
            }

            var oTable = this.byId("dynamicTable");
            oTable.setBusy(true);
        
            //Gọi hàm tạo binding (Truyền cả Name và Desc)
            this._loadMeta(sTableName, sTableDesc);
            
            //Gọi hàm load Data
            this._loadData(sTableName); 
        
            //Xử lý hiển thị bảng
            if (this._oODataListBinding) {
                this._oODataListBinding.requestContexts(0, 1000).then(function (aContexts) {
                    oTable.setBusy(false);
                
                    if (!aContexts || aContexts.length === 0) {
                        MessageBox.information("Cannot find table matching your criteria.");
                        return;
                    }
                
                    //Gộp bảng, đếm cột và lấy ngày tháng/người tạo
                    var oUniqueMap = {};
                    aContexts.forEach(function (oContext) {
                        var item = oContext.getObject(); 
                        var sName = item.table_name;
                        
                        if (sName) {
                            if (!oUniqueMap[sName]) {
                                oUniqueMap[sName] = {
                                    table_name: sName,
                                    table_description: item.table_description,
                                    user_name: item.user_name,
                                    change_at: item.change_at || item.created_at,
                                    field_count: 1
                                };
                            } else {
                                oUniqueMap[sName].field_count += 1;
                            }
                        }
                    });
                
                    var aUniqueTables = Object.values(oUniqueMap);
                    this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);
                    MessageToast.show("Load data successfully!");

                }.bind(this)).catch(function (oError) {
                    oTable.setBusy(false);
                    this.getView().getModel("realData").setProperty("/UniqueTables", []);

                    var sErrorMsg = oError.message || "Unknown Error";

                    if (sErrorMsg.includes("RAISE_EXCEPTION") || sErrorMsg.includes("500")) {
                        MessageBox.information("Cannot find table or it does not exist in the system.\n\n(Không tìm thấy bảng hoặc bảng không tồn tại!)");
                    } else {
                        MessageBox.error("System Error: " + sErrorMsg);
                    }
                }.bind(this));
            }
        },

        //Hàm xóa bộ lọc
        onClear: function () {
            this.byId("searchInput").setValue("");
            var oDescInput = this.byId("searchDescInput");
            if (oDescInput) { oDescInput.setValue(""); }
            
            this.getView().getModel("realData").setProperty("/UniqueTables", []);
            MessageToast.show("Filter cleared");
        },

        //Hàm bấm vào dòng sang Object Page
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("realData");
            var sTableName = oContext.getProperty("table_name");
            try {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteObjectPage", {
                    tableName: sTableName,
                    layout: "OneColumn"
                });
            } catch (e) {
                console.log("Router error: " + e.message);
            }
        },  

        //Hàm load Meta
        _loadMeta: function(sTableName, sTableDesc) {
            var oModel = this.getView().getModel(); 
            var aFilters = [];

            if (sTableName) {
                aFilters.push(new Filter("table_name", FilterOperator.EQ, sTableName));
            }
            if (sTableDesc) {
                aFilters.push(new Filter("table_description", FilterOperator.Contains, sTableDesc));
            }
            
            this._oODataListBinding = oModel.bindList("/Meta", null, null, aFilters, {
                $$groupId: "$direct"
            });
            
            //Lưu vào displayModel
            this.getView().getModel("displayModel").setProperty("/Meta", this._oODataListBinding);
            
            return this._oODataListBinding;
        },

        //Hàm load Data
        _loadData: function(sQuery) {
            if (!sQuery) return; 

            var oModel = this.getView().getModel(); 
            var aFilters = [
                new Filter("table_name", FilterOperator.EQ, sQuery)
            ];
            
            var modelData = oModel.bindList("/Data", null, null, aFilters, {
                $$groupId: "$direct"
            });
            this.getView().getModel("displayModel").setProperty("/Data", modelData);
        }
    });
});