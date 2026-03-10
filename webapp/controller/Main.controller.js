sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/m/MessageToast",   // thư viện hiển thị thông báo
    "sap/m/MessageBox",     // thư viện hiển thị lỗi
    "sap/ui/core/BusyIndicator" // thư viện icon xoay chờ loading
], function (Controller, JSONModel, fioriLibrary, MessageToast, MessageBox, BusyIndicator) {
    "use strict";

    return Controller.extend("zapp.controller.Main", {
        _oMetaRaw: [], 
        _oDataRaw: [], 

        onInit: function () {
            this._loadOData();
            
        },

        _loadOData: function () {
            Promise.all([
                this._loadMeta(),
                this._loadData()
            ]).then(function() {
                this._displayData(); 
            }.bind(this));
        },  
        _loadMeta: function() {
            var oModel = this.getOwnerComponent().getModel();
            console.log(oModel);
            
            return oModel.bindList("/Meta").requestContexts().then(function (aMetaContexts) {
                console.log(this._oMetaRaw);
                
                this._oMetaRaw = aMetaContexts.map(oContext => oContext.getObject());
                this._oMetaRaw.sort((a, b) => parseInt(a.field_pos) - parseInt(b.field_pos));
                
                this.getView().getModel("displayModel").setProperty("/Meta", this._oMetaRaw);
                this.getView().getModel("overall").setProperty("/tableName", this._oMetaRaw[0]?.table_name);
            }.bind(this));
        },

        _loadData: function() {
            var oModel = this.getOwnerComponent().getModel();
            return oModel.bindList("/Data").requestContexts().then(function (aDataContexts) {
                this._oDataRaw = aDataContexts.map(oContext => oContext.getObject());
                this._oDataRaw = this._groupDataByRow(this._oDataRaw)
                console.log(this._oDataRaw);

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

        _displayData: function() {
            var oTable = this.byId("dataTable");
            var oTemplate = this.byId("columnTemplate")
            var listColumns = oTable.getColumns();
            var listColumnName = listColumns.map(column => column.getHeader().getText())
            // chỉ có thể sửa data không thể thay thế thứ tự hiển thị 
            
            const result = this._oDataRaw.map(record => {
                return listColumnName.map(nameColumn => {
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

        onListItemPress: function (oEvent) {
            var oFCL = this.oView.getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
                var oItemPath = oEvent.getSource().getBindingContext("displayModel").getPath();
                var row_id = oItemPath.split("/").slice(-1).pop();
                this.getOwnerComponent().getRouter().navTo("detail", {
                    layout: fioriLibrary.LayoutType.TwoColumnsMidExpanded,
                    rowId: row_id,
                });
            } else {
                console.error("Không tìm thấy đối tượng FCL với ID 'fcl'");
            }
        },

        
        onUploadExcelPress: function (oEvent) {
            // Lấy trực tiếp file từ sự kiện 'change' của nút
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles ? aFiles[0] : null;

            if (!oFile) {
                MessageToast.show("Không tìm thấy file. Vui lòng thử lại!");
                return;
            }

            // Dùng FileReader để băm file thành Base64
            var oReader = new FileReader();
            
            oReader.onload = function (e) {
                // Kết quả trả về có dạng: "data:application/vnd...;base64,UEsDBBQ..."
                var sDataURL = e.target.result;
                
                // Cắt lấy phần ruột Base64 (sau dấu phẩy)
                var sBase64String = sDataURL.split(",")[1];
                
                // Lấy tên bảng hiện tại từ model overall
                var sTableName = this.getView().getModel("overall").getProperty("/tableName");

                // Đẩy xuống Backend
                this._sendExcelToBackend(sTableName, sBase64String);
                
                // Reset lại công cụ chọn file để lần sau chọn lại file cũ không bị lỗi
                this.byId("excelUploader").clear();
                
            }.bind(this);

            // Bắt đầu đọc file
            oReader.readAsDataURL(oFile);
        },

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oModel = this.getOwnerComponent().getModel();
            
            // Lấy UUID của bảng hiện tại (Vì Action được khai báo gắn với 1 Entity cụ thể)
            if (!this._oMetaRaw || this._oMetaRaw.length === 0) {
                MessageBox.error("Không tìm thấy thông tin Metadata của bảng!");
                return;
            }
            var sUuid = this._oMetaRaw[0].uuid;

            BusyIndicator.show(0); // Bật hiệu ứng chờ tải

            // Cấu trúc đường dẫn gọi Action trong OData V4 
            // Cú pháp: /ZI_DYNAMIC_META(uuid=...)/com.sap.gateway.srvd...uploadExcel
            var sActionPath = "/Meta(" + sUuid + ")/uploadExcel(...)";
            
            var oActionContext = oModel.bindContext(sActionPath);
            
            // Truyền 2 biến vào Action
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            // Thực thi gửi xuống Backend
            oActionContext.execute().then(function () {
                BusyIndicator.hide();
                MessageToast.show("Tải file Excel và lưu vào hệ thống thành công!");
                
                // Load lại dữ liệu để bảng hiển thị các dòng vừa upload
                this._loadData().then(function() {
                    this._displayData();
                }.bind(this));
                
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Lỗi khi tải file: " + (oError.message || "Lỗi không xác định"));
                console.error("Chi tiết lỗi Upload:", oError);
            });
        }

    });
});