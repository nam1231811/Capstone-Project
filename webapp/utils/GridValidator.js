sap.ui.define([], function () {
    "use strict";

    var _getCellValue = function (row, colInfo, bIsObjectPage) {
        if (bIsObjectPage) {
            return row[colInfo.index] ? row[colInfo.index].value : "";
        }
        return row[colInfo.fieldname];
    };

    // highlight and error msg
    var _setCellError = function (row, colInfo, msg, bIsObjectPage) {
        if (bIsObjectPage && row[colInfo.index]) {
            row[colInfo.index]._state = "Error";
            row[colInfo.index]._msg = msg;
        } else if (!bIsObjectPage) {
            row["_state_" + colInfo.fieldname] = "Error";
            row["_msg_" + colInfo.fieldname] = msg;
        }
    };

    var _clearCellError = function (row, colInfo, bIsObjectPage) {
        if (bIsObjectPage && row[colInfo.index]) {
            row[colInfo.index]._state = "None";
            row[colInfo.index]._msg = "";
        } else if (!bIsObjectPage) {
            row["_state_" + colInfo.fieldname] = "None";
            row["_msg_" + colInfo.fieldname] = "";
        }
    };

    // check Primary Key
    var _isKeyColumn = function (col) {
        var sFN = (col.fieldname || col.fieldName || "").toUpperCase();

        if (col.keyflag === "X" || col.keyFlag === "X" || col.isKey === true || col.IsKey === true) {
            return true;
        }

        if (sFN === "ID" || sFN === "CODE" || sFN === "EMP_ID" || sFN === "UUID") {
            return true;
        }

        return false;
    };


    return {
        checkCellFormat: function (sValue, sDataType, iLength) {
            var msgOnlyNum = "Please enter only numbers.";
            var msgIncorrectDate = "Incorrect format (YYYYMMDD or YYYY-MM-DD).";
            var msgInvalidDate = "Invalid date value.";
            var msgTooLong = "Maximum length exceeded (" + iLength + " chars).";
            var msgInvalidTime = "Invalid time format (HHMMSS).";
            var msgInvalidNumc = "NUMC must contain only numbers.";

            if (sValue === null || sValue === undefined || String(sValue).trim() === "") {
                return { valid: true, msg: "" };
            }

            var sStrVal = String(sValue).trim();
            var sType = sDataType ? sDataType.toUpperCase() : "";
            var iMaxLen = parseInt(iLength, 10);
            var bHasLengthLimit = !isNaN(iMaxLen) && iMaxLen > 0;

            switch (sType) {
                case "CHAR":
                case "STRING":
                case "CUKY":
                case "UNIT":
                    if (bHasLengthLimit && sStrVal.length > iMaxLen) return { 
                        valid: false, 
                        msg: msgTooLong 
                    };
                    break;
                case "NUMC":
                    if (!/^\d+$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgInvalidNumc 
                    };
                    if (bHasLengthLimit && sStrVal.length > iMaxLen) return { 
                        valid: false, 
                        msg: msgTooLong 
                    };
                    break;
                case "INT1":
                case "INT2":
                case "INT4":
                case "INT8":
                    if (!/^-?\d+$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgOnlyNum 
                    };
                    if (bHasLengthLimit && sStrVal.replace("-", "").length > iMaxLen) return { 
                        valid: false, 
                        msg: msgTooLong 
                    };
                    break;
                case "DEC":
                case "CURR":
                case "QUAN":
                case "FLTP":
                    if (!/^-?\d+(\.\d+)?$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgOnlyNum 
                    };
                    if (bHasLengthLimit && sStrVal.replace("-", "").replace(".", "").length > iMaxLen) return { 
                        valid: false, 
                        msg: msgTooLong 
                    };
                    break;
                case "DATS":
                    if (!/^(\d{4}-\d{2}-\d{2}|\d{8})$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgIncorrectDate 
                    };
                    var iY, iM, iD;
                    if (sStrVal.includes("-")) {
                        var aParts = sStrVal.split("-");
                        iY = parseInt(aParts[0], 10); 
                        iM = parseInt(aParts[1], 10); 
                        iD = parseInt(aParts[2], 10);
                    } else {
                        iY = parseInt(sStrVal.substring(0, 4), 10); 
                        iM = parseInt(sStrVal.substring(4, 6), 10); 
                        iD = parseInt(sStrVal.substring(6, 8), 10);
                    }
                    var oDate = new Date(iY, iM - 1, iD);
                    if (oDate.getFullYear() !== iY || (oDate.getMonth() + 1) !== iM || oDate.getDate() !== iD) 
                        return { 
                            valid: false, 
                            msg: msgInvalidDate 
                        };
                    break;
                case "TIMS":
                    if (!/^\d{6}$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgInvalidTime 
                    };
                    var hh = parseInt(sStrVal.substring(0, 2), 10);
                    var mm = parseInt(sStrVal.substring(2, 4), 10);
                    var ss = parseInt(sStrVal.substring(4, 6), 10);
                    if (hh > 23 || mm > 59 || ss > 59) return { 
                        valid: false, 
                        msg: msgInvalidTime 
                    };
                    break;
                default:
                    if (bHasLengthLimit && sStrVal.length > iMaxLen) return { 
                        valid: false, 
                        msg: msgTooLong 
                    };
                    break;
            }
            return { valid: true, msg: "" };
        },

        performLiveValidation: function (aData, aMeta, aOldData) {
            if (!aData || aData.length === 0) return aData;

            // Nhận diện môi trường đang chạy
            var bIsObjectPage = (aData[0] && aData[0][0] && aData[0][0].hasOwnProperty("value"));

            // BƯỚC 1: XÁC ĐỊNH CÁC CỘT KHÓA CHÍNH (PRIMARY KEYS)
            var aKeyColumns = [];
            aMeta.forEach(function (col, idx) {
                if (_isKeyColumn(col)) {
                    aKeyColumns.push({ fieldname: (col.fieldname || col.fieldName).toUpperCase(), index: idx });
                }
            });
            // Nếu không tìm thấy khóa nào, mặc định lấy cột đầu tiên làm khóa
            if (aKeyColumns.length === 0 && aMeta.length > 0) {
                aKeyColumns.push({ fieldname: (aMeta[0].fieldname || aMeta[0].fieldName).toUpperCase(), index: 0 });
            }

            var mapIds = {};
            var aDateFieldsForAllRows = [];
            var rStart = /(START|STRAT|BEG|FROM|DATAB)/i;
            var rEnd = /(END|TO|UNTIL|DATBI)/i;

            // scan line
            aData.forEach(function (row, rowIndex) {
                var aRowDateFields = []; // Chứa ngày tháng của dòng hiện tại
                var bIsNew = bIsObjectPage ? (row[0] && row[0].isNew) : true;

                aMeta.forEach(function (col, idx) {
                    var colInfo = { fieldname: (col.fieldname || col.fieldName).toUpperCase(), index: idx };

                    _clearCellError(row, colInfo, bIsObjectPage);

                    var sVal = _getCellValue(row, colInfo, bIsObjectPage);
                    var iLengthFromMeta = col.leng || col.length || 0;

                    var bIsEditable = bIsObjectPage ? (row[colInfo.index] && row[colInfo.index].isEditable) : true;
                    var valResult = this.checkCellFormat(sVal, col.datatype || col.dataType, iLengthFromMeta);

                    if (!valResult.valid && bIsEditable) {
                        _setCellError(row, colInfo, valResult.msg, bIsObjectPage);
                    }

                    if (sVal) {
                        var sType = rStart.test(colInfo.fieldname) ? "START" : (rEnd.test(colInfo.fieldname) ? "END" : "UNKNOWN");
                        if (sType !== "UNKNOWN") {
                            var sBaseName = colInfo.fieldname.replace(rStart, "").replace(rEnd, "").replace(/_$/, "");
                            aRowDateFields.push({ baseName: sBaseName, type: sType, colInfo: colInfo, value: String(sVal).trim() });
                        }
                    }
                }.bind(this));

                aDateFieldsForAllRows.push({ row: row, dateFields: aRowDateFields });

                if (bIsNew) {
                    var sCompKey = aKeyColumns.map(function (c) {
                        return String(_getCellValue(row, c, bIsObjectPage)).trim().toUpperCase();
                    }).join("|");

                    if (sCompKey.replace(/\|/g, "") !== "") {
                        if (!mapIds[sCompKey]) mapIds[sCompKey] = [];
                        mapIds[sCompKey].push(rowIndex);
                    }
                }
            }.bind(this));

            // check Logic Date
            aDateFieldsForAllRows.forEach(function (rowData) {
                var oDateGroups = {};
                rowData.dateFields.forEach(function (f) {
                    if (!oDateGroups[f.baseName]) oDateGroups[f.baseName] = {};
                    oDateGroups[f.baseName][f.type] = f;
                });

                Object.keys(oDateGroups).forEach(function (k) {
                    var g = oDateGroups[k];
                    if (g.START && g.END && g.START.value && g.END.value) {
                        var dStart = new Date(g.START.value);
                        var dEnd = new Date(g.END.value);

                        if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime()) && dEnd < dStart) {
                            _setCellError(rowData.row, g.END.colInfo, "Cannot be smaller than " + g.START.colInfo.fieldname, bIsObjectPage);
                            _setCellError(rowData.row, g.START.colInfo, "Must be smaller than " + g.END.colInfo.fieldname, bIsObjectPage);
                        }
                    }
                });
            });

            // check Duplicate ID
            var aOldRows = [];
            if (bIsObjectPage && aData) {
                aOldRows = aData.filter(function (r) { return !(r[0] && r[0].isNew); });
            } else if (!bIsObjectPage && aOldData) {
                aOldRows = aOldData || [];
            }

            Object.keys(mapIds).forEach(function (sKey) {
                var bDupDB = aOldRows.some(function (oldRow) {
                    var sOldKey = aKeyColumns.map(function (c) {
                        var cell = Object.values(oldRow).find(function (item) {
                            return item && item.fieldname && item.fieldname.toUpperCase() === c.fieldname;
                        });
                        return cell ? String(cell.value).trim().toUpperCase() : "";
                    }).join("|");
                    return sOldKey === sKey;
                });

                if (mapIds[sKey].length > 1 || bDupDB) {
                    var sErrMsg = bDupDB ? "The ID already exists!" : "ID is duplicated within the file/Grid!";
                    mapIds[sKey].forEach(function (idx) {
                        aKeyColumns.forEach(function (c) {
                            _setCellError(aData[idx], c, sErrMsg, bIsObjectPage);
                        });
                    });
                }
            });

            return aData;
        }
    };
});