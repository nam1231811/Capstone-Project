sap.ui.define([], function () {
    "use strict";

    return {
        checkCellFormat: function (sValue, sDataType, iLength) {
            var msgOnlyNum = "Please enter only numbers.";
            var msgIncorrectDate = "Incorrect format (YYYYMMDD or YYYY-MM-DD).";
            var msgInvalidDate = "Invalid date value.";
            var msgTooLong = "Maximum length exceeded (" + iLength + " chars).";
            var msgInvalidTime = "Invalid time format (HHMMSS).";
            var msgInvalidNumc = "NUMC must contain only numbers.";

            if (sValue === null || sValue === undefined || String(sValue).trim() === "") {
                return { 
                    valid: true, 
                    msg: "" 
                };
            }

            var sStrVal = String(sValue).trim();
            var sType = sDataType ? sDataType.toUpperCase() : "";
            var iMaxLen = parseInt(iLength, 10);
            
            var bHasLengthLimit = !isNaN(iMaxLen) && iMaxLen > 0;

            switch (sType) {
                case "CHAR":
                case "STRING":
                case "CUKY": // ( VND, USD)
                case "UNIT": // ( KG, PC)
                    if (bHasLengthLimit && sStrVal.length > iMaxLen) {
                        
                        return { 
                            valid: false, 
                            msg: msgTooLong 
                        };
                    }
                    break;

                case "NUMC":
                    if (!/^\d+$/.test(sStrVal)) {
                        return { 
                            valid: false, 
                            msg: msgInvalidNumc 
                        };
                    }

                    if (bHasLengthLimit && sStrVal.length > iMaxLen) {
                        return { 
                            valid: false, 
                            msg: msgTooLong 
                        };
                    }
                    break;

                case "INT1":
                case "INT2":
                case "INT4":
                case "INT8":
                    if (!/^-?\d+$/.test(sStrVal)) return { 
                        valid: false, 
                        msg: msgOnlyNum 
                    };

                    if (bHasLengthLimit && sStrVal.replace("-", "").length > iMaxLen) {
                        return { 
                            valid: false, 
                            msg: msgTooLong 
                        };
                    }
                    break;

                case "DEC":
                case "CURR":
                case "QUAN":
                case "FLTP":
                    if (!/^-?\d+(\.\d+)?$/.test(sStrVal)) {
                        return { 
                            valid: false, 
                            msg: msgOnlyNum 
                        };
                    };

                    if (bHasLengthLimit && sStrVal.replace("-", "").replace(".", "").length > iMaxLen) {
                        return { 
                            valid: false, 
                            msg: msgTooLong 
                        };
                    }
                    break;

                case "DATS":
                    if (!/^(\d{4}-\d{2}-\d{2}|\d{8})$/.test(sStrVal)) {
                        return { 
                            valid: false, 
                            msg: msgIncorrectDate 
                        };
                    }
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
                    if (oDate.getFullYear() !== iY || (oDate.getMonth() + 1) !== iM || oDate.getDate() !== iD) {
                        return { 
                            valid: false, 
                            msg: msgInvalidDate 
                        };
                    }
                    break;

                case "TIMS":
                    if (!/^\d{6}$/.test(sStrVal)) {
                        return { 
                            valid: false, 
                            msg: msgInvalidTime 
                        };
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
                    if (bHasLengthLimit && sStrVal.length > iMaxLen) {
                        return { 
                            valid: false, 
                            msg: msgTooLong 
                        };
                    }
                    break;
            }

            return { 
                valid: true,
                msg: "" 
            };
        },


        performLiveValidation: function (aData, aMeta, aOldData) {
            if (!aData || aData.length === 0) return aData;

            var bIsObjectPage = (aData[0] && aData[0][0] && aData[0][0].hasOwnProperty("value"));
            
            var setCellError = function (row, colInfo, msg) {
                if (bIsObjectPage && row[colInfo.index]) {
                    row[colInfo.index]._state = "Error";
                    row[colInfo.index]._msg = msg;
                } else if (!bIsObjectPage) {
                    row["_state_" + colInfo.fieldname] = "Error";
                    row["_msg_" + colInfo.fieldname] = msg;
                }
            };

            aData.forEach(function (row) {
                aMeta.forEach(function (col, idx) {
                    var fieldName = col.fieldname.toUpperCase();
                    var colInfo = { 
                        fieldname: fieldName, 
                        index: idx 
                    };
                    
                    if (bIsObjectPage && row[idx]) {
                        row[idx]._state = "None"; 
                        row[idx]._msg = "";
                    } else {
                        row["_state_" + fieldName] = "None"; 
                        row["_msg_" + fieldName] = "";
                    }

                    var sVal = bIsObjectPage ? (row[idx] ? row[idx].value : "") : row[fieldName];
                    var iLengthFromMeta = col.leng || 0;
                    
                    var res = this.checkCellFormat(sVal, col.datatype, iLengthFromMeta);
                    
                    if (!res.valid) {
                        setCellError(row, colInfo, res.msg);
                    }
                }.bind(this));
            }.bind(this));

            return aData;
        }
    };
});