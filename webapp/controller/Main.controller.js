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
            //Khởi tạo các models cần thiết
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");

            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            this._initPersonalization(); //Khởi tạo logic personalization
        },

        //Hàm search table
        onSearch: function () {
            var sTableName = this.byId("searchInput").getValue().trim().toUpperCase();
            var oDescInput = this.byId("searchDescInput");
            var sTableDesc = oDescInput ? oDescInput.getValue().trim() : "";
            var sLang = this.getView().getModel("settingsModel").getProperty("/selectedLanguage");
            
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            //Validation cơ bản
            if (!sTableName && !sTableDesc) {
                MessageToast.show(oBundle.getText("msgEnterKeyword"));
                return;
            }

            //Security check (Chỉ Z hoặc Y)
            if (sTableName && !sTableName.startsWith("Z") && !sTableName.startsWith("Y")) {
                MessageBox.warning(oBundle.getText("msgAccessDenied"));
                return;
            }

            this.onSetTable(sTableName, sTableDesc, sLang); //Gọi action
        },

        //Hàm clear
        onClear: function () {
            //Xóa nội dung các ô nhập liệu
            var oSearchInput = this.byId("searchInput");
            var oDescInput = this.byId("searchDescInput");
            
            if (oSearchInput) {
                oSearchInput.setValue("");
            }
            if (oDescInput) {
                oDescInput.setValue("");
            }

            this.getView().getModel("realData").setProperty("/UniqueTables", []); //Xóa dữ liệu đang hiển thị trên bảng

            //Dọn cache của displayModel
            var oDisplayModel = this.getView().getModel("displayModel");
            if (oDisplayModel) {
                oDisplayModel.setProperty("/Meta", null);
                oDisplayModel.setProperty("/Data", null);
            }

            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            MessageToast.show(oBundle.getText("msgDataCleared"));
        },

        //Hàm gọi action
        onSetTable: function (sName, sDesc, sLang) {
            var oView = this.getView();
            var oTable = this.byId("dynamicTable");
            var oModel = oView.getModel(); 
            var oBundle = oView.getModel("i18n").getResourceBundle();
            
            oTable.setBusy(true);

            var sActionPath = "/Meta/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.SetTable(...)";
            var oAction = oModel.bindContext(sActionPath); 

            //Truyền tham số vào action
            oAction.setParameter("table_name", sName);
            oAction.setParameter("table_description", sDesc);
            oAction.setParameter("language", sLang);

            //Execute action
            oAction.execute().then(function () {
                MessageToast.show(oBundle.getText("msgTableLoaded"));

                this._loadDataToTable(sName); //Load lại dữ liệu lên UI
                
            }.bind(this)).catch(function (oError) {
                oTable.setBusy(false);
                MessageBox.error(oBundle.getText("msgTableNotFound", [sName]));
                console.error("Backend Error Details:", oError);
            });
        },

        //Hàm đọc lại dữ liệu từ entity sau khi action chạy xong
        _loadDataToTable: function(sTableName) {
            var oTable = this.byId("dynamicTable");
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!sTableName) return;  

            var oListBinding = this._loadMeta(sTableName)
 
            oListBinding.requestContexts(0, 1000).then(function (aContexts) {
                oTable.setBusy(false);
                
                if (!aContexts || aContexts.length === 0) {
                    this.getView().getModel("realData").setProperty("/UniqueTables", []);
                    MessageBox.information(oBundle.getText("msgNoDataFound"));
                    return;
                }

                //Gộp dòng và đếm số lượng field
                var oUniqueMap = {};
                aContexts.forEach(function (oContext) {
                    var item = oContext.getObject();
                    var sId = item.table_name;
                    if (sId) {
                        if (!oUniqueMap[sId]) {
                            oUniqueMap[sId] = {
                                table_name: sId,
                                table_description: item.table_description,
                                user_name: item.user_name,
                                change_at: item.change_at || item.created_at,
                                field_count: 1
                            };
                        } else {
                            oUniqueMap[sId].field_count += 1;
                        }
                    }
                });

                //Set dữ liệu vào model để bảng hiển thị
                var aUniqueTables = Object.values(oUniqueMap);
                this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);

            }.bind(this)).catch(function(oError) {
                oTable.setBusy(false);
                MessageBox.error(oBundle.getText("msgLoadError", [sTableName]));
                console.error("Read Data Error:", oError);
            });
        },

        //Hàm xử lý khi ấn nút Go
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("realData");
            var sTableName = oContext.getProperty("table_name");
            this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                tableName: sTableName,
                newTable: true
            });
        },

        //Hàm chọn ngôn ngữ
        onOpenSettings: function () {
            if (!this._oLangDialog) {
                this._oLangDialog = new sap.m.SelectDialog({
                    title: "Select Language",
                    items: [
                        new sap.m.StandardListItem({ title: "English", description: "EN", type: "Active" }),
                        new sap.m.StandardListItem({ title: "Tiếng Việt", description: "VI", type: "Active" })
                    ],
                    confirm: function (oEvent) {
                        var sLangCode = oEvent.getParameter("selectedItem").getDescription();
                        
                        //Xử lý ngôn ngữ
                        var sBackendLang = (sLangCode === "VI") ? "V" : "E";
                        this.getView().getModel("settingsModel").setProperty("/selectedLanguage", sBackendLang);
                        
                        //Đổi file i18n
                        var sUiLang = (sLangCode === "VI") ? "vi" : "en";
                        sap.ui.getCore().getConfiguration().setLanguage(sUiLang);
                        
                        //Kiểm tra xem người dùng đã nhập từ khóa tìm kiếm chưa
                        var sTableName = this.byId("searchInput").getValue().trim();
                        var oDescInput = this.byId("searchDescInput");
                        var sTableDesc = oDescInput ? oDescInput.getValue().trim() : "";

                        //Chỉ tự động gọi search nếu đã có từ khóa
                        if (sTableName || sTableDesc) {
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
                    oDeferred.resolve(sData ? JSON.parse(sData) : { _persoSchemaVersion: "1.0", aColumns: [] });
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

        //Hàm load meta
        _loadMeta: function(aFilters) {
            var oModel = this.getView().getModel(); 
            this._oODataListBinding = GetData.loadMeta(oModel, aFilters)
            return this._oODataListBinding;
        }
    });
});