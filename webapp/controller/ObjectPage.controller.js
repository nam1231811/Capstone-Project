sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library"
], function (Controller, JSONModel, fioriLibrary) {
    "use strict";

    // Đã sửa lại tên controller cho đúng với tên file ObjectPage
    return Controller.extend("zapp.controller.ObjectPage", {
        _oFieldName: [], 
        _oDataRaw: [], 

        // onInit: function () {
            
        //     var oViewModel = new JSONModel({
        //         count: 0,
        //         tableName: "" 
        //     });
        //     this.getView().setModel(oViewModel, "view");

        //     var oDisplayModel = new JSONModel({
        //         Meta: [], // Dữ liệu thật từ Backend sẽ chèn vào đây
        //         Data: [], // Dữ liệu thật từ Backend sẽ chèn vào đây
                
        //         AuditLogs: [
        //             {
        //                 ChangedAt: "2026-03-08 10:30:00",
        //                 ChangedBy: "NGUYENTP8",
        //                 Action: "I", // Insert (Thêm mới)
        //                 RecordKey: "SV001",
        //                 OldData: "",
        //                 NewData: '{"ID": "SV001", "Name": "Nguyen Van A", "City": "HCM"}'
        //             },
        //             {
        //                 ChangedAt: "2026-03-08 11:15:22",
        //                 ChangedBy: "MINHDH5",
        //                 Action: "U", // Update (Sửa)
        //                 RecordKey: "SV001",
        //                 OldData: '{"ID": "SV001", "Name": "Nguyen Van A", "City": "HCM"}',
        //                 NewData: '{"ID": "SV001", "Name": "Nguyen Van A", "City": "Pleiku"}'
        //             },
        //             {
        //                 ChangedAt: "2026-03-08 14:00:05",
        //                 ChangedBy: "ADMIN",
        //                 Action: "D", // Delete (Xóa)
        //                 RecordKey: "SV002",
        //                 OldData: '{"ID": "SV002", "Name": "Tran Thi B", "Salary": 5000}',
        //                 NewData: ""
        //             }
        //         ]
        //     });
            
        //     this.getView().setModel(oDisplayModel, "displayModel");

        //     this._loadOData();
        // },

        onInit: function () {
            var oOwnerComponent = this.getOwnerComponent();

	    	this.oRouter = oOwnerComponent.getRouter();            
            this.oRouter.getRoute("RouteObjectPage").attachPatternMatched(this._onObjectMatched, this);

            var oDetailRecord = new JSONModel({
                    Data: []
                });
            this.getView().setModel(oDetailRecord, "detailRecord");
        },
        
        _onObjectMatched: function () {      
            // if (aData[this._record] != "undefined") {
            //     this.getView().getModel("detailRecord").setProperty("/Data", aData[this._record]);
            // }
            // console.log(this.getView().getModel("displayModel").getProperty("/Meta"));

            var oMeta = this.getView().getModel("displayModel").getProperty("/Meta"); 
            var oData = this.getView().getModel("displayModel").getProperty("/Data"); 
               
            Promise.all([
                this._loadMeta(oMeta),
                this._loadData(oData)
            ]).then(function() {
                this._displayData(oData); 
            }.bind(this));
        },

        // _loadOData: function () {
        //     var oModel = this.getOwnerComponent().getModel(); 
        //     var oViewModel = this.getView().getModel("view");
        //     var oDisplayModel = this.getView().getModel("displayModel");

        //     var oMetaBinding = oModel.bindList("/Meta"); 
        //     oMetaBinding.requestContexts().then(function (aMetaContexts) {
        //         this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
        //         console.log("Dữ liệu Meta:", this._oMetaRaw);

        //         if (this._oMetaRaw.length > 0) {
        //             oViewModel.setProperty("/tableName", this._oMetaRaw[0].table_name);
        //             oDisplayModel.setProperty("/Meta", this._oMetaRaw);
        //         }

        //         return oModel.bindList("/Data").requestContexts();

        //     }.bind(this)).then(function (aDataContexts) {
        //         this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
        //         console.log("Dữ liệu Data thực tế:", this._oDataRaw);

        //         oDisplayModel.setProperty("/Data", this._oDataRaw);
        //         oViewModel.setProperty("/count", this._oDataRaw.length);

        //     }.bind(this)).catch(function (oError) {
        //         console.error("Lỗi khi load dữ liệu OData:", oError);
        //     });
        // },

        _displayData: function() {
            var oTable = this.byId("dataTable");
            var oTemplate = this.byId("columnTemplate")
            // chỉ có thể sửa data không thể thay thế thứ th hhhk,qự hiển thị 
            const result = this._oDataRaw.map(record => {
                return this._oFieldName.map(nameColumn => {
                    const cell = record.find(column => column.fieldname === nameColumn)
                    return cell;
                })
            });
            console.log(result);
            
            this.getView().getModel("displayModel").setProperty("/Data", result);
            oTemplate.bindCells({
                path: "displayModel>", 
                factory: function(sId, oContext) {
                    // oContext lúc này là từng object như {fieldname: "ID", value: "10001", ...}
                    return new sap.m.Text({
                        text: "{displayModel>value}"
                    });
                }
            });
            
            oTable.bindItems({
                path: "displayModel>/Data",
                template: oTemplate
            });
        },
        
        _loadMeta: function(meta) {
            return meta.requestContexts().then(function (aMetaContexts) {
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                console.log(this._oMetaRaw);
                this._oFieldName = this._oMetaRaw.map( prop => prop.fieldname)
                
                this.getView().getModel("view").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
            }.bind(this));
        },
        
        _loadData: function(data) {
            return data.requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                this._oDataRaw = this._groupDataByRow(this._oDataRaw)
                console.log(this._oDataRaw);
                this.getView().getModel("displayModel").setProperty("/Data", this._oDataRaw);
                this.getView().getModel("overall").setProperty("/count", this._oDataRaw.length);
            }.bind(this));
        },
        
        _groupDataByRow: function (data) {
            if(!data || !Array.isArray(data)){
                return [];
            }

            const groupData = data.reduce(function (acc, obj) {
                var sKey = obj.row_id;
                if (!acc[sKey]) {
                    acc[sKey] = [];
                }
                acc[sKey].push(obj);
                return acc;
            }, {});

            //[ [Array(5)], [ Array(5)],... ]
            return Object.values(groupData);;
        },


        onViewLogDetail: function (oEvent) {
            // 1. Lấy dữ liệu của dòng (Row) vừa được click
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("displayModel");
            var oRowData = oContext.getObject();

            // 2. Hàm phụ trợ: Format chuỗi JSON cho đẹp (thụt lề 4 ô)
            var formatJson = function (sJsonString) {
                if (!sJsonString || sJsonString === "") {
                    return "Không có dữ liệu (Blank)";
                }
                try {
                    var oJson = JSON.parse(sJsonString);
                    return JSON.stringify(oJson, null, 4); // Số 4 là số khoảng trắng thụt lề
                } catch (e) {
                    return sJsonString; // Nếu lỗi không phải JSON thì in ra chuỗi gốc
                }
            };

            var sOldDataFormatted = formatJson(oRowData.OldData);
            var sNewDataFormatted = formatJson(oRowData.NewData);

            // 3. Khởi tạo Giao diện Popup (Dialog) bằng JavaScript nếu chưa có
            if (!this._oLogDialog) {
                this._oLogDialog = new sap.m.Dialog({
                    title: "Chi tiết dữ liệu thay đổi (JSON)",
                    contentWidth: "600px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.VBox({
                            items: [
                                new sap.m.Label({ text: "Dữ liệu CŨ (Old Data):", design: "Bold" }).addStyleClass("sapUiTinyMarginTop"),
                                new sap.m.TextArea({ value: "{dialogModel>/oldData}", width: "100%", rows: 6, editable: false }),
                                
                                new sap.m.Label({ text: "Dữ liệu MỚI (New Data):", design: "Bold" }).addStyleClass("sapUiSmallMarginTop"),
                                new sap.m.TextArea({ value: "{dialogModel>/newData}", width: "100%", rows: 6, editable: false })
                            ]
                        }).addStyleClass("sapUiMediumMargin")
                    ],
                    beginButton: new sap.m.Button({
                        type: "Emphasized",
                        text: "Đóng",
                        press: function () {
                            this._oLogDialog.close();
                        }.bind(this)
                    })
                });
                // Kết nối Popup với View hiện tại
                this.getView().addDependent(this._oLogDialog);
            }

            // 4. Đẩy dữ liệu đã format vào Popup
            var oDialogModel = new sap.ui.model.json.JSONModel({
                oldData: sOldDataFormatted,
                newData: sNewDataFormatted
            });
            this._oLogDialog.setModel(oDialogModel, "dialogModel");

            // 5. Hiển thị Popup lên màn hình
            this._oLogDialog.open();
        },

        onMedataPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                var tableName = this.getView().getModel("view").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("Metadata", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
		},
        onListItemPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                var tableName = this.getView().getModel("view").getProperty("/tableName");
                this.getOwnerComponent().getRouter().navTo("DetailData", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                    tableName: tableName
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
		}
    });
});