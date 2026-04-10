sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (MessageToast, MessageBox, BusyIndicator) {
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
        // --- HÀM 2: VẼ MÀN HÌNH POPUP CHỈNH SỬA & VALIDATE ---
        _openPreviewDialog: function (sTableName, aData) {
            var oView = this.getView();
            var oDisplayModel = oView.getModel("displayModel");
            var aMeta = oDisplayModel ? oDisplayModel.getProperty("/Meta") : [];

            // LẤY DỮ LIỆU DATABASE HIỆN TẠI ĐỂ CHECK TRÙNG LẶP DB (CHỐNG GHI ĐÈ)
            var aOldData = oDisplayModel ? oDisplayModel.getProperty("/Data") : [];

            // 1. CHUẨN BỊ MÔ HÌNH DỮ LIỆU JSON
            var oJSONModel = new sap.ui.model.json.JSONModel(aData);

            // --- HÀM THỰC HIỆN QUÉT TOÀN BỘ LƯỚI ĐỂ TÔ ĐỎ (VALIDATION) ---
            var _performFullGridValidation = function () {
                var aCurrentData = oJSONModel.getData();
                if (!aCurrentData || aCurrentData.length === 0) return;

                // TÌM KHÓA CHÍNH ĐÚNG CHUẨN (Ưu tiên cấu hình từ Backend)
                var aKeyFields = [];
                aMeta.forEach(function (col) {
                    if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true || col.IsKey === true) {
                        aKeyFields.push((col.fieldname || col.fieldName).toUpperCase());
                    }
                });

                // Nếu Backend không gửi Key, chỉ bốc DUY NHẤT 1 CỘT (tránh bốc nhầm DEPT_ID)
                if (aKeyFields.length === 0 && aMeta.length > 0) {
                    var oFallbackCol = aMeta.find(function (col) {
                        var name = (col.fieldname || col.fieldName || "").toUpperCase();
                        return name === "ID" || name === "CODE" || name.indexOf("_ID") !== -1 || name.indexOf("_CODE") !== -1;
                    });
                    if (oFallbackCol) {
                        aKeyFields.push((oFallbackCol.fieldname || oFallbackCol.fieldName).toUpperCase());
                    } else {
                        aKeyFields.push((aMeta[0].fieldname || aMeta[0].fieldName).toUpperCase());
                    }
                }

                var mapIds = {};
                var bHasDuplicateId = false;

                // BƯỚC A: Reset trạng thái lỗi về None
                aCurrentData.forEach(function (row) {
                    aMeta.forEach(function (colMeta) {
                        var sKey = colMeta.fieldname || colMeta.fieldName;
                        if (sKey && sKey.toUpperCase() !== "MANDT") {
                            row["_state_" + sKey.toUpperCase()] = "None";
                            row["_msg_" + sKey.toUpperCase()] = "";
                        }
                    });
                });

                // BƯỚC B: Quét Format và Validation Từng Dòng
                aCurrentData.forEach(function (row, rowIndex) {
                    var aDateFields = []; // Hỗ trợ Start Date < End Date

                    aMeta.forEach(function (colMeta) {
                        var sKey = colMeta.fieldname || colMeta.fieldName;
                        if (sKey && sKey.toUpperCase() !== "MANDT") {
                            var sUpperKey = sKey.toUpperCase();
                            var valResult = UploadExcelData._validateCellFormat(row[sUpperKey], colMeta.datatype || colMeta.dataType, colMeta);

                            if (!valResult.valid) {
                                row["_state_" + sUpperKey] = "Error";
                                row["_msg_" + sUpperKey] = valResult.msg;
                            }

                            // Thu thập ngày tháng
                            if (row[sUpperKey]) {
                                var rStart = /(START|STRAT|BEG|FROM|DATAB)/i;
                                var rEnd = /(END|TO|UNTIL|DATBI)/i;
                                var sType = rStart.test(sUpperKey) ? "START" : (rEnd.test(sUpperKey) ? "END" : "UNKNOWN");
                                if (sType !== "UNKNOWN") {
                                    aDateFields.push({ baseName: sUpperKey.replace(rStart, "").replace(rEnd, "").replace(/_$/, ""), type: sType, name: sUpperKey, value: String(row[sUpperKey]).trim() });
                                }
                            }
                        }
                    });

                    // So sánh Start Date < End Date
                    var oDateGroups = {};
                    aDateFields.forEach(function (f) {
                        if (!oDateGroups[f.baseName]) oDateGroups[f.baseName] = {};
                        oDateGroups[f.baseName][f.type] = f;
                    });
                    Object.keys(oDateGroups).forEach(function (key) {
                        var group = oDateGroups[key];
                        if (group.START && group.END && group.START.value !== "" && group.END.value !== "") {
                            var dStart = new Date(group.START.value);
                            var dEnd = new Date(group.END.value);
                            if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && (dEnd < dStart)) {
                                row["_state_" + group.END.name] = "Error";
                                row["_msg_" + group.END.name] = "Cannot be smaller than " + group.START.name;
                                row["_state_" + group.START.name] = "Error";
                                row["_msg_" + group.START.name] = "Must be smaller than " + group.END.name;
                            }
                        }
                    });

                    // BƯỚC C: GOM KHÓA CHÍNH ĐỂ CHECK TRÙNG LẶP
                    var sCompositeKey = aKeyFields.map(function (key) { return row[key] ? String(row[key]).trim().toUpperCase() : ""; }).join("|");

                    if (sCompositeKey !== "" && sCompositeKey.replace(/\|/g, "") !== "") {
                        // C.1 Check trùng trong file
                        if (!mapIds[sCompositeKey]) { mapIds[sCompositeKey] = []; }
                        mapIds[sCompositeKey].push(rowIndex);

                        // C.2 Check trùng Database (Chống ghi đè)
                        var bExistsInDB = aOldData.some(function (oldRow) {
                            var sOldCompKey = aKeyFields.map(function (keyField) {
                                // Lục tìm value từ object cũ của Fiori
                                var oCell = Object.values(oldRow).find(function (c) { return c && c.fieldname && c.fieldname.toUpperCase() === keyField; });
                                return oCell && oCell.value ? String(oCell.value).trim().toUpperCase() : "";
                            }).join("|");
                            return sOldCompKey === sCompositeKey;
                        });

                        if (bExistsInDB) {
                            aKeyFields.forEach(function (keyField) {
                                row["_state_" + keyField] = "Error";
                                row["_msg_" + keyField] = "ID này đã tồn tại! Không thể Upload.";
                            });
                        }
                    }
                });

                // BƯỚC D: TÔ ĐỎ NẾU BỊ TRÙNG BÊN TRONG FILE
                for (var sCompKey in mapIds) {
                    if (mapIds[sCompKey].length > 1) {
                        mapIds[sCompKey].forEach(function (index) {
                            aKeyFields.forEach(function (keyField) {
                                aCurrentData[index]["_state_" + keyField] = "Error";
                                aCurrentData[index]["_msg_" + keyField] = "ID này bị trùng lặp bên trong File Excel!";
                            });
                        });
                    }
                }

                // Cập nhật lại model để view vẽ lại màu
                oJSONModel.setData(aCurrentData);
            };

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
                                    // Chúng ta không gọi validate lẻ, mà gọi quét TOÀN BỘ LƯỚI
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

            sap.ui.core.BusyIndicator.show(0);

            // 2. RẼ NHÁNH ĐƯỜNG DẪN API DỰA TRÊN QUYỀN
            var sActionPath = "";
            if (bIsManager || bIsAdmin) {
                // Luồng quyền cao: Ghi thẳng vào DB vật lý (Bỏ qua ZTEMP)
                sActionPath = "/Data/com.sap.gateway.srvd.zsd_dynamic_meta.v0001.saveToDatabase(...)";
            } else {
                // Luồng Clerk: Đẩy file Excel vào bảng tạm ZTEMP để chờ duyệt
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
                sap.ui.core.BusyIndicator.hide();

                // Báo Toast Message tùy theo luồng
                var sSuccessMsg = (bIsManager || bIsAdmin)
                    ? "Data saved directly to Physical Database!"
                    : "Excel Uploaded successfully! Waiting for approval.";
                sap.m.MessageToast.show(sSuccessMsg);

                // Load lại bảng
                if (typeof this._refreshData === "function") {
                    this._refreshData(sTableName);
                }
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Upload error: " + (oError.message || "Please see Console."));
            });
        },

        // --- HÀM 4: KIỂM TRA ĐỊNH DẠNG DỮ LIỆU ---
        _validateCellFormat: function (sValue, sDataType, oColMeta) {
            if (sValue === null || sValue === undefined || sValue === "") {
                return { valid: true, msg: "" };
            }
            var sStrVal = String(sValue).trim();
            // Đảm bảo sDataType luôn in hoa để so sánh không bị trượt
            sDataType = sDataType ? sDataType.toUpperCase() : "";
            var sFieldName = "";
            if (oColMeta) {
                sFieldName = (oColMeta.fieldname || oColMeta.fieldName || "").toUpperCase();
            }

            // 1. Kiểm tra Kiểu Số / Tiền tệ / NUMC (Thường dùng cho ID/Mã số)
            var aNumTypes = ["INT1", "INT2", "INT4", "INT8", "DEC", "CURR", "QUAN", "NUMC", "FLTP"];

            if (aNumTypes.indexOf(sDataType) !== -1) {
                // Dùng Regex quét cực gắt: Chỉ cho phép chứa chữ số (chấp nhận dấu âm và thập phân)
                var numRegex = /^-?\d+(\.\d+)?$/;
                if (!numRegex.test(sStrVal)) {
                    return { valid: false, msg: "Please enter only numbers." };
                }

                if (sFieldName.indexOf("MONTH") !== -1 || sFieldName.indexOf("MONAT") !== -1) {
                    var iMonthNum = parseInt(sStrVal, 10);
                    if (isNaN(iMonthNum) || iMonthNum < 1 || iMonthNum > 12) {
                        return { valid: false, msg: "Month must be from 1 to 12." };
                    }
                }
            }
            // 2. Kiểm tra Kiểu Ngày Tháng (DATS)
            else if (sDataType === "DATS") {
                var dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{8})$/; // YYYY-MM-DD hoặc YYYYMMDD
                if (!dateRegex.test(sStrVal)) {
                    return { valid: false, msg: "Incorrect format (YYYY-MM-DD)" };
                }


                var iYear;
                var iMonth;
                var iDay;

                if (/^\d{8}$/.test(sStrVal)) {
                    iYear = parseInt(sStrVal.substring(0, 4), 10);
                    iMonth = parseInt(sStrVal.substring(4, 6), 10);
                    iDay = parseInt(sStrVal.substring(6, 8), 10);
                } else {
                    var aDateParts = sStrVal.split("-");
                    iYear = parseInt(aDateParts[0], 10);
                    iMonth = parseInt(aDateParts[1], 10);
                    iDay = parseInt(aDateParts[2], 10);
                }

                var oDate = new Date(iYear, iMonth - 1, iDay);
                var bIsValidDate = oDate.getFullYear() === iYear &&
                    (oDate.getMonth() + 1) === iMonth &&
                    oDate.getDate() === iDay;

                if (!bIsValidDate) {
                    return { valid: false, msg: "Invalid date value." };
                }
            }
            return { valid: true, msg: "" };
        }
    };

    return UploadExcelData;
});