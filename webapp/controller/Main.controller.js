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
            //Khởi tạo các models cần thiết
            var oRealDataModel = new JSONModel({ UniqueTables: [] });
            this.getView().setModel(oRealDataModel, "realData");

            var oSettingsModel = new JSONModel({ selectedLanguage: "E" });
            this.getView().setModel(oSettingsModel, "settingsModel");

            //Khởi tạo logic cá nhân hóa bảng
            this._initPersonalization();
        },

        //Hàm search table
        onSearch: function () {
            var sTableName = this.byId("searchInput").getValue().trim().toUpperCase();
            var oDescInput = this.byId("searchDescInput");
            var sTableDesc = oDescInput ? oDescInput.getValue().trim() : "";
            var sLang = this.getView().getModel("settingsModel").getProperty("/selectedLanguage");

            //Validation cơ bản
            if (!sTableName && !sTableDesc) {
                MessageToast.show("Please input Table Name or Table Description!");
                return;
            }

            //Security check (Chỉ Z hoặc Y)
            if (sTableName && !sTableName.startsWith("Z") && !sTableName.startsWith("Y")) {
                MessageBox.warning("Access denied! Custom tables only (Z/Y).");
                return;
            }

            //Gọi action
            this.onSetTable(sTableName, sTableDesc, sLang);
        },

        //Hàm gọi action
        onSetTable: function (sName, sDesc, sLang) {
            var oView = this.getView();
            var oTable = this.byId("dynamicTable");
            var oModel = oView.getModel(); 
            
            oTable.setBusy(true);

            var sActionPath = "/Meta/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.SetTable(...)";
            var oAction = oModel.bindContext(sActionPath); 

            //Truyền tham số vào action
            oAction.setParameter("table_name", sName);
            oAction.setParameter("table_description", sDesc);
            oAction.setParameter("language", sLang);

            //Thực thi action
            oAction.execute().then(function () {
                MessageToast.show("Table loaded successfully!");

                //Load lại dữ liệu lên UI
                this._loadDataToTable(sName);
                
            }.bind(this)).catch(function (oError) {
                oTable.setBusy(false);
                MessageBox.error("Error executing Action SetTable: " + oError.message);
            });
        },

        //Hàm đọc lại dữ liệu từ entity sau khi action chạy xong
        _loadDataToTable: function(sTableName) {
            var oTable = this.byId("dynamicTable");
            if (!sTableName) return;  
            var aFilters = [
                new Filter("table_name", FilterOperator.EQ, sTableName)
            ];
            
            var oListBinding = this._loadMeta(aFilters)
            this._loadData(aFilters);

            oListBinding.requestContexts(0, 1000).then(function (aContexts) {
                console.log(aContexts),
                oTable.setBusy(false);
                
                if (!aContexts || aContexts.length === 0) {
                    this.getView().getModel("realData").setProperty("/UniqueTables", []);
                    MessageBox.information("Action executed, but no data found in ZTEMP_META.");
                    return;
                }

                //Gộp dòng và đếm số lượng field
                var oUniqueMap = {};
                aContexts.forEach(function (oContext) {
                    var item = oContext.getObject();
                    console.log(item);
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

                //Set dữ liệu vào Model để bảng hiển thị
                var aUniqueTables = Object.values(oUniqueMap);
                this.getView().getModel("realData").setProperty("/UniqueTables", aUniqueTables);

            }.bind(this)).catch(function(oError) {
                oTable.setBusy(false);
                MessageBox.error("Error reading data: " + oError.message);
            });
        },

        //Hàm ấn nút xử lý
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("realData");
            var sTableName = oContext.getProperty("table_name");
            this.getOwnerComponent().getRouter().navTo("RouteObjectPage", {
                tableName: sTableName
            });
        },

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
                        var sBackendLang = (sLangCode === "VI") ? "V" : "E";
                        this.getView().getModel("settingsModel").setProperty("/selectedLanguage", sBackendLang);
                        this.onSearch();
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
            this._oODataListBinding = oModel.bindList("/Meta", null, null, aFilters, {
                $$groupId: "$direct"
            });
            
            this.getView().getModel("displayModel").setProperty("/Meta", this._oODataListBinding); //Lưu vào displayModel
            
            return this._oODataListBinding;
        },

        //Hàm load data
        _loadData: function(aFilters) {
            var oModel = this.getView().getModel(); 
            var modelData = oModel.bindList("/Data", null, null, aFilters, {
                $$groupId: "$direct"
            });
            this.getView().getModel("displayModel").setProperty("/Data", modelData);
        }
    });
});