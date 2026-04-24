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

        _getPreviewData: function (sTableName, sBase64String) {
            var oModel = this.getView().getModel();
            BusyIndicator.show(0);

            var sPreviewPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.previewExcel(...)";
            var oActionContext = oModel.bindContext(sPreviewPath);
            oActionContext.setParameter("table_name", sTableName);
            oActionContext.setParameter("file_content", sBase64String);

            // 1. Khởi tạo request lấy danh sách đang Pending
            var oPendingBinding = oModel.bindList("/Data", null, null, [
                new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "P")
            ]);

            // 2. Chạy song song cả 2 request (Preview và Pending)
            Promise.all([
                oActionContext.execute(),
                oPendingBinding.requestContexts(0, 5000)
            ]).then(function (aResults) {
                BusyIndicator.hide();
                var oResult = oActionContext.getBoundContext().getObject();
                var aPendingContexts = aResults[1] || [];

                // 3. Trích xuất dữ liệu Pending của đúng bảng hiện tại
                var aPendingData = [];
                aPendingContexts.forEach(function (ctx) {
                    var oData = ctx.getObject();
                    var sTbl = oData.table_name || oData.TableName || "";
                    if (sTbl.toUpperCase() === sTableName.toUpperCase()) {
                        try {
                            var oParsed = JSON.parse(oData.data || oData.Data || "{}");
                            aPendingData.push(oParsed);
                        } catch (e) { }
                    }
                });

                if (oResult && oResult.json_string) {
                    try {
                        var sDecodedString = decodeURIComponent(escape(atob(oResult.json_string)));
                        var aParsedData = JSON.parse(sDecodedString);

                        // 4. Truyền thêm aPendingData vào hàm mở Dialog
                        UploadExcelData._openPreviewDialog.call(this, sTableName, aParsedData, aPendingData);
                    } catch (e) {
                        MessageBox.error("Preview data reading error: " + e.message);
                    }
                }
            }.bind(this)).catch(function (oError) {
                BusyIndicator.hide();
                MessageBox.error("Preview error: " + (oError.message || "Please see Console."));
            });
        },

        _openPreviewDialog: function (sTableName, aData, aPendingData) {
            var oView = this.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var aMeta = oDisplayModel ? oDisplayModel.getProperty("/Meta") : [];
            var aOldData = oDisplayModel ? oDisplayModel.getProperty("/Data") : [];
            var oJSONModel = new sap.ui.model.json.JSONModel(aData);

            var aKeyFields = [];
            if (aMeta && aMeta.length > 0) {
                aMeta.forEach(function (m) {
                    var sUpperKey = (m.fieldname || m.fieldName || m.name || "").toUpperCase();
                    if (m.keyflag === "X" || m.keyFlag === "X" || m.isKey === true) {
                        aKeyFields.push(sUpperKey);
                    }
                });
                if (aKeyFields.length === 0) {
                    var oIdCol = aMeta.find(c => {
                        var name = (c.fieldname || c.fieldName || "").toUpperCase();
                        return name === "ID" || name.includes("_ID");
                    });
                    if (oIdCol) aKeyFields.push((oIdCol.fieldname || oIdCol.fieldName).toUpperCase());
                }
            }

            var _performFullGridValidation = function () {
                var aCurrentData = oJSONModel.getData();
                var aCleanedData = GridValidator.performLiveValidation(aCurrentData, aMeta, aOldData);

                // Kiểm tra trùng Key với danh sách Pending
                aCleanedData.forEach(function (oRow) {
                    // Bỏ qua dòng trống không có dữ liệu
                    var bHasVal = false;
                    for (var key in oRow) {
                        if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                            if (oRow[key] !== undefined && oRow[key] !== null && String(oRow[key]).trim() !== "") bHasVal = true;
                        }
                    }

                    if (bHasVal && aKeyFields.length > 0 && aPendingData && aPendingData.length > 0) {
                        var bIsDuplicatePending = false;

                        aPendingData.forEach(function (oPendingRow) {
                            var bMatchAllKeys = true;
                            aKeyFields.forEach(function (kField) {
                                var sVal1 = String(oRow[kField] || "").trim().toUpperCase();
                                var sVal2 = String(oPendingRow[kField] || oPendingRow[kField.toLowerCase()] || "").trim().toUpperCase();
                                if (sVal1 !== sVal2 || sVal1 === "") {
                                    bMatchAllKeys = false;
                                }
                            });

                            if (bMatchAllKeys) {
                                bIsDuplicatePending = true;
                            }
                        });

                        // Nếu trùng -> Bôi đỏ ngay lập tức
                        if (bIsDuplicatePending) {
                            aKeyFields.forEach(function (kField) {
                                oRow["_state_" + kField] = "Error";
                                oRow["_msg_" + kField] = "Record is currently Pending. Cannot overwrite!";
                            });
                        }
                    }
                });

                oJSONModel.setData(aCleanedData);
            };

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
                                valueState: "{_state_" + sUpperKey + "}",
                                valueStateText: "{_msg_" + sUpperKey + "}",

                                change: function (oEvent) {

                                    _performFullGridValidation();
                                }
                            }),
                            width: "10rem",
                            autoResizable: true
                        }));
                    }
                });
            }

            oTable.setModel(oJSONModel);
            oTable.bindRows("/");

            _performFullGridValidation();

            var oScrollContainer = new sap.m.ScrollContainer({
                horizontal: true,
                vertical: true,
                width: "100%",
                height: "100%",
                content: [oTable]
            });

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
                            var oModel = this.getView().getModel();
                            sap.ui.core.BusyIndicator.show(0);

                            // --- BƯỚC A: GỌI BACKEND LẤY DANH SÁCH PENDING MỚI NHẤT TRƯỚC KHI GỬI ---
                            var oPendingBinding = oModel.bindList("/Data", null, null, [
                                new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "P")
                            ]);

                            oPendingBinding.requestContexts(0, 5000).then(function (aContexts) {
                                sap.ui.core.BusyIndicator.hide();

                                // Lọc lấy danh sách Pending của bảng hiện tại
                                var aFreshPendingData = [];
                                aContexts.forEach(function (ctx) {
                                    var oData = ctx.getObject();
                                    var sTbl = oData.table_name || oData.TableName || "";
                                    if (sTbl.toUpperCase() === sTableName.toUpperCase()) {
                                        try {
                                            var oParsed = JSON.parse(oData.data || oData.Data || "{}");
                                            aFreshPendingData.push(oParsed);
                                        } catch (e) { }
                                    }
                                });

                                // Cập nhật lại biến Pending của Dialog và chạy lại bộ quét lỗi (để bôi đỏ nếu có trùng)
                                aPendingData = aFreshPendingData;
                                _performFullGridValidation();

                                // --- BƯỚC B: CHẠY LOGIC LÀM SẠCH VÀ CHUẨN BỊ UPLOAD NHƯ CŨ ---
                                var aCurrentData = oJSONModel.getData();
                                var bHasError = false;
                                var aCleanData = [];

                                // TỰ ĐỘNG TÌM CỘT KEY TỪ METADATA
                                var aKeyFields = [];
                                if (aMeta && aMeta.length > 0) {
                                    aMeta.forEach(function (m) {
                                        var sUpperKey = (m.fieldname || m.fieldName || m.name || "").toUpperCase();
                                        if (m.keyflag === "X" || m.keyFlag === "X" || m.isKey === true) {
                                            aKeyFields.push(sUpperKey);
                                        }
                                    });
                                    if (aKeyFields.length === 0) {
                                        var oIdCol = aMeta.find(c => {
                                            var name = (c.fieldname || c.fieldName || "").toUpperCase();
                                            return name === "ID" || name.includes("_ID");
                                        });
                                        if (oIdCol) aKeyFields.push((oIdCol.fieldname || oIdCol.fieldName).toUpperCase());
                                    }
                                }

                                // QUÉT TỪNG DÒNG DỮ LIỆU
                                aCurrentData.forEach(function (oRow) {
                                    var oCleanRow = {};
                                    var bIsEmptyRow = true;
                                    var bHasKeyData = true;
                                    var bHasOtherData = false;

                                    for (var key in oRow) {
                                        if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                            var sValue = oRow[key];
                                            oCleanRow[key] = sValue;

                                            var bHasVal = (sValue !== undefined && sValue !== null && String(sValue).trim() !== "");
                                            if (bHasVal) {
                                                bIsEmptyRow = false;
                                                if (!aKeyFields.includes(key)) {
                                                    bHasOtherData = true;
                                                }
                                            }
                                        }
                                    }

                                    if (aKeyFields.length > 0) {
                                        aKeyFields.forEach(function (kField) {
                                            var val = oRow[kField];
                                            if (val === undefined || val === null || String(val).trim() === "") {
                                                bHasKeyData = false;
                                            }
                                        });
                                    }

                                    // ÁP DỤNG LOGIC NGHIỆP VỤ
                                    if (!bIsEmptyRow) {
                                        if (!bHasKeyData && bHasOtherData) {
                                            aKeyFields.forEach(function (kField) {
                                                var val = oRow[kField];
                                                if (val === undefined || val === null || String(val).trim() === "") {
                                                    oRow["_state_" + kField] = "Error";
                                                    oRow["_msg_" + kField] = "Primary Key is required!";
                                                }
                                            });
                                        } else if (bHasKeyData) {
                                            for (var key in oRow) {
                                                if (!key.startsWith("_state_") && !key.startsWith("_msg_")) {
                                                    var sVal = oRow[key];
                                                    var bIsFieldEmpty = (sVal === undefined || sVal === null || String(sVal).trim() === "");

                                                    if (bIsFieldEmpty) {
                                                        oRow["_state_" + key] = "None";
                                                        oRow["_msg_" + key] = "";
                                                    }
                                                }
                                            }
                                        }

                                        // Chốt lỗi cuối cùng (Bao gồm cả lỗi trùng Pending vừa quét ở trên)
                                        for (var key in oRow) {
                                            if (key.startsWith("_state_") && oRow[key] === "Error") {
                                                bHasError = true;
                                            }
                                        }

                                        aCleanData.push(oCleanRow);
                                    }
                                });

                                oJSONModel.refresh();

                                // --- BƯỚC C: CHẶN HOẶC CHO PHÉP GỬI ---
                                if (aCleanData.length === 0) {
                                    sap.m.MessageBox.warning("There is no valid data to upload. Please check again!");
                                    return;
                                }

                                if (bHasError) {
                                    sap.m.MessageBox.error("Data conflict detected or format error! Please check the red cells before uploading.");
                                    return;
                                }

                                var sNewJsonString = JSON.stringify(aCleanData);
                                var sNewBase64String = btoa(unescape(encodeURIComponent(sNewJsonString)));

                                UploadExcelData._sendExcelToBackend.call(this, sTableName, sNewBase64String);
                                oDialog.close();

                            }.bind(this)).catch(function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                sap.m.MessageBox.error("System error when verifying pending status. Please try again!");
                            });

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

        _sendExcelToBackend: function (sTableName, sBase64String) {
            var oView = this.getView();
            var oModel = oView.getModel();

            var oAuthModel = this.getOwnerComponent().getModel("auth");
            var bIsManager = oAuthModel ? oAuthModel.getProperty("/isManager") : false;
            var bIsAdmin = oAuthModel ? oAuthModel.getProperty("/isAdmin") : false;

            BusyIndicator.show(0);

            var sActionPath = "";
            if (bIsManager || bIsAdmin) {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            } else {
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.uploadExcel(...)";
            }

            var oActionContext = oModel.bindContext(sActionPath);

            oActionContext.setParameter("table_name", sTableName.toUpperCase());

            if (bIsManager || bIsAdmin) {
                oActionContext.setParameter("json_data", sBase64String);
            } else {
                oActionContext.setParameter("file_content", sBase64String);
            }

            oActionContext.execute().then(function () {
                BusyIndicator.hide();

                var sSuccessMsg = (bIsManager || bIsAdmin)
                    ? "Data saved directly to Physical Database!"
                    : "Excel Uploaded successfully! Waiting for approval.";
                MessageToast.show(sSuccessMsg);

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
