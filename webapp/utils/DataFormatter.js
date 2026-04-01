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
            
            if (sSafeDate.length === 14 && !sSafeDate.includes("-")) {
                var yyyy = parseInt(sSafeDate.substring(0, 4), 10);
                var MM = parseInt(sSafeDate.substring(4, 6), 10) - 1;
                var dd = parseInt(sSafeDate.substring(6, 8), 10);
                var hh = parseInt(sSafeDate.substring(8, 10), 10);
                var mm = parseInt(sSafeDate.substring(10, 12), 10);
                var ss = parseInt(sSafeDate.substring(12, 14), 10);
                
                oDate = new Date(yyyy, MM, dd, hh, mm, ss);
            } else {
                oDate = new Date(sDateString);
            }

            if (!isNaN(oDate.getTime())) {
                return oDateFormat.format(oDate);
            }

            return sSafeDate;
        }
    };
});