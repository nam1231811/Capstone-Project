sap.ui.define([], function () {
    "use strict";

    return {
        // 1. CHUYỂN HÀM KIỂM TRA FORMAT TỪ UPLOAD EXCEL SANG ĐÂY
        checkCellFormat: function (sValue, sDataType, oColMeta) {
            if (sValue === null || sValue === undefined || sValue === "") return { valid: true, msg: "" };
            var sStrVal = String(sValue).trim();
            sDataType = sDataType ? sDataType.toUpperCase() : "";

            var aNumTypes = ["INT1", "INT2", "INT4", "INT8", "DEC", "CURR", "QUAN", "NUMC", "FLTP"];
            if (aNumTypes.indexOf(sDataType) !== -1) {
                if (!/^-?\d+(\.\d+)?$/.test(sStrVal)) return { valid: false, msg: "Please enter only numbers." };
            } else if (sDataType === "DATS") {
                if (!/^(\d{4}-\d{2}-\d{2}|\d{8})$/.test(sStrVal)) return { valid: false, msg: "Incorrect format (YYYY-MM-DD)" };
                var iY, iM, iD;
                if (/^\d{8}$/.test(sStrVal)) {
                    iY = parseInt(sStrVal.substring(0, 4), 10); iM = parseInt(sStrVal.substring(4, 6), 10); iD = parseInt(sStrVal.substring(6, 8), 10);
                } else {
                    var aParts = sStrVal.split("-"); iY = parseInt(aParts[0], 10); iM = parseInt(aParts[1], 10); iD = parseInt(aParts[2], 10);
                }
                var oDate = new Date(iY, iM - 1, iD);
                if (oDate.getFullYear() !== iY || (oDate.getMonth() + 1) !== iM || oDate.getDate() !== iD) return { valid: false, msg: "Invalid date value." };
            }
            return { valid: true, msg: "" };
        },

        // 2. HÀM QUÉT LỖI TỔNG HỢP (HỖ TRỢ CẢ 2 MÔI TRƯỜNG)
        performLiveValidation: function (aData, aMeta, aOldData) {
            if (!aData || aData.length === 0) return aData;

            // Nhận diện môi trường: ObjectPage (dữ liệu bọc theo index) hay UploadExcel (dữ liệu phẳng)
            var bIsObjectPage = (aData[0] && aData[0][0] && aData[0][0].hasOwnProperty("value"));

            // Xác định Khóa chính
            var aKeyColumns = [];
            aMeta.forEach(function (col, idx) {
                var sFN = (col.fieldname || col.fieldName || "").toUpperCase();
                if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true || col.IsKey === true ||
                    sFN === "ID" || sFN === "CODE" || sFN.indexOf("_ID") !== -1 || sFN.indexOf("_CODE") !== -1) {
                    aKeyColumns.push({ fieldname: sFN, index: idx });
                }
            });
            if (aKeyColumns.length === 0 && aMeta.length > 0) aKeyColumns.push({ fieldname: (aMeta[0].fieldname || aMeta[0].fieldName).toUpperCase(), index: 0 });

            var mapIds = {};
            var rStart = /(START|STRAT|BEG|FROM|DATAB)/i;
            var rEnd = /(END|TO|UNTIL|DATBI)/i;

            // Hàm Helper để set màu tùy môi trường
            var setCellError = function (row, colInfo, msg) {
                if (bIsObjectPage && row[colInfo.index]) { row[colInfo.index]._state = "Error"; row[colInfo.index]._msg = msg; }
                else if (!bIsObjectPage) { row["_state_" + colInfo.fieldname] = "Error"; row["_msg_" + colInfo.fieldname] = msg; }
            };

            // BƯỚC 1: Quét Format và Ngày
            aData.forEach(function (row, rowIndex) {
                var aDateFields = [];
                var bIsNew = bIsObjectPage ? (row[0] && row[0].isNew) : true;

                aMeta.forEach(function (col, idx) {
                    var colInfo = { fieldname: (col.fieldname || col.fieldName).toUpperCase(), index: idx };

                    // Reset lỗi
                    if (bIsObjectPage && row[colInfo.index]) { row[colInfo.index]._state = "None"; row[colInfo.index]._msg = ""; }
                    else if (!bIsObjectPage) { row["_state_" + colInfo.fieldname] = "None"; row["_msg_" + colInfo.fieldname] = ""; }

                    // Quét Format
                    var sVal = bIsObjectPage ? (row[colInfo.index] ? row[colInfo.index].value : "") : row[colInfo.fieldname];
                    var valResult = this.checkCellFormat(sVal, col.datatype || col.dataType, col);
                    if (!valResult.valid && ((bIsObjectPage && row[colInfo.index] && row[colInfo.index].isEditable) || !bIsObjectPage)) {
                        setCellError(row, colInfo, valResult.msg);
                    }

                    // Gom ngày tháng
                    if (sVal) {
                        var sType = rStart.test(colInfo.fieldname) ? "START" : (rEnd.test(colInfo.fieldname) ? "END" : "UNKNOWN");
                        if (sType !== "UNKNOWN") aDateFields.push({ baseName: colInfo.fieldname.replace(rStart, "").replace(rEnd, "").replace(/_$/, ""), type: sType, colInfo: colInfo, value: String(sVal).trim() });
                    }
                }.bind(this));

                // So sánh ngày
                var oDateGroups = {};
                aDateFields.forEach(function (f) { if (!oDateGroups[f.baseName]) oDateGroups[f.baseName] = {}; oDateGroups[f.baseName][f.type] = f; });
                Object.keys(oDateGroups).forEach(function (k) {
                    var g = oDateGroups[k];
                    if (g.START && g.END && g.START.value && g.END.value) {
                        var dS = new Date(g.START.value), dE = new Date(g.END.value);
                        if (!isNaN(dS.getTime()) && !isNaN(dE.getTime()) && dE < dS) {
                            setCellError(row, g.END.colInfo, "Cannot be smaller than " + g.START.colInfo.fieldname);
                            setCellError(row, g.START.colInfo, "Must be smaller than " + g.END.colInfo.fieldname);
                        }
                    }
                });

                // Gom Khóa
                if (bIsNew) {
                    var sCompKey = aKeyColumns.map(function (c) { return String(bIsObjectPage ? (row[c.index] ? row[c.index].value : "") : row[c.fieldname]).trim().toUpperCase(); }).join("|");
                    if (sCompKey.replace(/\|/g, "") !== "") {
                        if (!mapIds[sCompKey]) mapIds[sCompKey] = []; mapIds[sCompKey].push(rowIndex);
                    }
                }
            }.bind(this));

            // BƯỚC 2: Báo đỏ ID Trùng
            var aOldRows = [];
            if (bIsObjectPage && aData) aOldRows = aData.filter(function (r) { return !(r[0] && r[0].isNew); });
            else if (!bIsObjectPage && aOldData) aOldRows = aOldData;

            for (var sKey in mapIds) {
                var bDupDB = aOldRows.some(function (oldR) {
                    var sOldK = aKeyColumns.map(function (c) {
                        var cell = Object.values(oldR).find(function (item) { return item && item.fieldname && item.fieldname.toUpperCase() === c.fieldname; });
                        return cell ? String(cell.value).trim().toUpperCase() : "";
                    }).join("|");
                    return sOldK === sKey;
                });

                if (mapIds[sKey].length > 1 || bDupDB) {
                    mapIds[sKey].forEach(function (idx) {
                        aKeyColumns.forEach(function (c) { setCellError(aData[idx], c, bDupDB ? "The ID already exists in the database!" : "Duplicate IDs are found inside a File/Grid!"); });
                    });
                }
            }
            return aData;
        }
    };
});