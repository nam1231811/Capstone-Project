sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";

    return {
        formatDateTime: function (sDateString) {
            if (!sDateString) return "";
            
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "HH:mm:ss || dd/MM/yyyy"
            });
            
            var oDate;
            
            var sSafeDate = String(sDateString).trim();
            
            if (/^\d{14}/.test(sSafeDate)) {
                var yyyy = parseInt(sSafeDate.substring(0, 4), 10);
                var MM = parseInt(sSafeDate.substring(4, 6), 10) - 1;
                var dd = parseInt(sSafeDate.substring(6, 8), 10);
                var hh = parseInt(sSafeDate.substring(8, 10), 10);
                var mm = parseInt(sSafeDate.substring(10, 12), 10);
                var ss = parseInt(sSafeDate.substring(12, 14), 10);
                
                oDate = new Date(Date.UTC(yyyy, MM, dd, hh, mm, ss)); //change to current timezone
            } else {
                oDate = new Date(sDateString);
            }

            if (!isNaN(oDate.getTime())) {
                return oDateFormat.format(oDate);
            }

            return sSafeDate;
        },
        
        formatValueByType: function(vValue, sType) {
            if (vValue === undefined || vValue === null) return "";

            var sTypeUpper = sType ? sType.toUpperCase() : "";
                
            if (["INT1", "INT2", "INT4", "DEC", "CURR", "QUAN", "FLTP"].includes(sTypeUpper)) {
                if (vValue === "" || isNaN(vValue)) return 0; 
                return Number(vValue);
            }

            if (sTypeUpper === "DATS" && vValue instanceof Date) {
                return vValue.toISOString().split('T')[0].replace(/-/g, '');
            }
            return String(vValue).trim();
        },
    };
});