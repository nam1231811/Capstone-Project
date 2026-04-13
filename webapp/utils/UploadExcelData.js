sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "zapp/utils/GridValidator"
], function (MessageToast, MessageBox, BusyIndicator, GridValidator) {
    "use strict";

    var UploadExcelData = {
        onUploadExcelPress: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles ? aFiles[0] : null;

            if (!oFile) {
                MessageToast.show("File not found. Please try again!");
                return;
            }

            var oReader = new FileReader();
            oReader.onload = function (e) {
                var sDataURL = e.target.result;
                var sBase64String = sDataURL.split(",")[1];
                var sTableName = this.getView().getModel("overall").getProperty("/tableName");

                UploadExcelData._getPreviewData.call(this, sTableName, sBase64String);

                this.byId("excelUploader").clear();
            }.bind(this);

            oReader.readAsDataURL(oFile);
        },

        // --- HÀM 1: GỌI BACKEND LẤY JSON PREVIEW ---
        _getPreviewData: function (sTableName, sBase64String) {
            var oModel = this.getView().getModel();
            BusyIndicator.show(0);

            var sPreviewPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.previewExcel(...)";
            var oActionContext = oModel.bindContext(sPreviewPath);

            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            oActionContext.execute().then(function () {
                BusyIndicator.hide();
                var oResult = oActionContext.getBoundContext().getObject();

                if (oResult && oResult.json_string) {
                    try {
                        var sDecodedString = decodeURIComponent(escape(atob(oResult.json_string)));
                        var aParsedData = JSON.parse(sDecodedString);
                        UploadExcelData._openPreviewDialog.call(this, sTableName, aParsedData);
                    } catch (e) {
                        MessageBox.error("Preview data reading error: " + e.message);
                    }
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Preview error: " + (oError.message || "Please see Console."));
            });
        },

        // --- HÀM 2: VẼ MÀN HÌNH POPUP CHỈNH SỬA & VALIDATE ---
        _openPreviewDialog: function (sTableName, aData) {
            var oView = this.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var aMeta = oDisplayModel ? oDisplayModel.getProperty("/Meta") : [];

            // LẤY DỮ LIỆU DATABASE HIỆN TẠI ĐỂ CHECK TRÙNG LẶP DB (CHỐNG GHI ĐÈ)
            var aOldData = oDisplayModel ? oDisplayModel.getProperty("/Data") : [];

            // 1. CHUẨN BỊ MÔ HÌNH DỮ LIỆU JSON
            var oJSONModel = new sap.ui.model.json.JSONModel(aData);

            // ====================================================================
            // GỌI "BỘ NÃO" GRID VALIDATOR TỪ FILE TIỆN ÍCH DÙNG CHUNG
            // ====================================================================
            var _performFullGridValidation = function () {
                var aCurrentData = oJSONModel.getData();
                // Truyền aOldData vào để check trùng với Database
                var aCleanedData = GridValidator.performLiveValidation(aCurrentData, aMeta, aOldData);
                oJSONModel.setData(aCleanedData);
            };
            // ====================================================================

            // 2. TẠO CỘT VỚI INPUT ĐỘNG
            var oTable = new sap.ui.table.Table({
                selectionMode: "None",
                visibleRowCount: aData.length,
                alternateRowColors: true
            });

            if (aMeta && aMeta.length > 0) {
                aMeta.forEach(function (colMeta) {
                    var sKey = colMeta.fieldname;
                    var sUpperKey = sKey.toUpperCase();
                    var sLabelText = colMeta.scrtextL || colMeta.scrtextM || colMeta.scrtextS || sKey;

                    if (sUpperKey !== "MANDT") {
                        oTable.addColumn(new sap.ui.table.Column({
                            label: new sap.m.Label({ text: sLabelText, design: "Bold" }),
                            template: new sap.m.Input({
                                value: "{" + sUpperKey + "}",
                                valueState: "{_state_" + sUpperKey + "}", // Đỏ hay Bình thường
                                valueStateText: "{_msg_" + sUpperKey + "}", // Câu báo lỗi

                                change: function (oEvent) {
                                    // BẮT SỰ KIỆN KHI NGƯỜI DÙNG SỬA DỮ LIỆU TẠI Ô NÀY
                                    _performFullGridValidation();
                                }
                            }),
                            width: "10rem",
                            autoResizable: true
                        }));
                    }
                });
            }

            // Bind dữ liệu vào Table
            oTable.setModel(oJSONModel);
            oTable.bindRows("/");

            // 3. THỰC HIỆN QUÉT LỖI LẦN ĐẦU TIÊN (Khi vừa mở Popup)
            _performFullGridValidation();

            var oScrollContainer = new sap.m.ScrollContainer({
                horizontal: true,
                vertical: true,
                width: "100%",
                height: "100%",
                content: [oTable]
            });

            // 4. TẠO DIALOG CHỐT HẠ
            var oDialog = new sap.m.Dialog({
                title: "Check data before uploading - Table " + sTableName + " (" + aData.length + " line)",
                contentWidth: "1200px",
                contentHeight: "600px",
                resizable: true,
                draggable: true,
                content: [oScrollContainer],
                buttons: [
                    new sap.m.Button({
                        text: "Confirm Upload",
                        type: "Emphasized",
                        icon: "sap-icon://upload",
                        press: function () {
                            var aCurrentData = oJSONModel.getData();
                            var bHasError = false;
                            var aCleanData = [];

                            // Quét lại lần cuối xem còn ô nào đỏ không
                            aCurrentData.forEach(function (oRow) {
                                var oCleanRow = {};
                                for (var key in oRow) {
                                    // Kiểm tra xem ô ID có bị Error không
                                    if (key.startsWith("_state_") && oRow[key] === "Error") {
                                        bHasError = true;
                                    }
                                    // Loại bỏ các cột phụ trợ UI trước khi gửi xuống DB
                                    if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                        oCleanRow[key] = oRow[key];
                                    }
                                }
                                aCleanData.push(oCleanRow);
                            });

                            // CHẶN KHÔNG CHO UPLOAD NẾU CÒN LỖI (VÍ DỤ ID TRÙNG)
                            if (bHasError) {
                                MessageBox.error("Please correct the faulty cells (highlighted in red) before uploading!");
                                return;
                            }

                            // Nếu sạch lỗi: Mã hóa Base64 cái JSON này rồi Gửi đi!
                            var sNewJsonString = JSON.stringify(aCleanData);
                            var sNewBase64String = btoa(unescape(encodeURIComponent(sNewJsonString)));

                            UploadExcelData._sendExcelToBackend.call(this, sTableName, sNewBase64String);
                            oDialog.close();
                        }.bind(this)
                    }),
                    new sap.m.Button({
                        text: "Cancel",
                        press: function () { oDialog.close(); }
                    })
                ],
                afterClose: function () { oDialog.destroy(); }
            });

            oView.addDependent(oDialog);
            oDialog.open();
        },

        // --- HÀM 3: GỌI ACTION UPLOAD XUỐNG DB ---
        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oView = this.getView();
            var oModel = oView.getModel();

            // 1. LẤY QUYỀN TỪ AUTH MODEL (Giống y hệt ObjectPage)
            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            BusyIndicator.show(0);

            // 2. RẼ NHÁNH ĐƯỜNG DẪN API DỰA TRÊN QUYỀN
            var sActionPath = "";
            if (bIsManager || bIsAdmin) {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            } else {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";
            }

            var oActionContext = oModel.bindContext(sActionPath);

            // 3. TRUYỀN THAM SỐ TƯƠNG ỨNG VỚI TỪNG API
            oActionContext.setParameter("table_name", sTableName.toUpperCase());

            if (bIsManager || bIsAdmin) {
                // API saveToDatabase nhận biến tên là json_data
                oActionContext.setParameter("json_data", sBase64String);
            } else {
                // API uploadExcel nhận biến tên là file_content
                oActionContext.setParameter("file_content", sBase64String);
            }

            // 4. THỰC THI GỬI REQUEST
            oActionContext.execute().then(function () {
                BusyIndicator.hide();

                // Báo Toast Message tùy theo luồng
                var sSuccessMsg = (bIsManager || bIsAdmin)
                    ? "Data saved directly to Physical Database!"
                    : "Excel Uploaded successfully! Waiting for approval.";
                MessageToast.show(sSuccessMsg);

                // Load lại bảng
                if (typeof this._refreshData === "function") {
                    this._refreshData(sTableName);
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Upload error: " + (oError.message || "Please see Console."));
            });
        }
    };

    return UploadExcelData;
});