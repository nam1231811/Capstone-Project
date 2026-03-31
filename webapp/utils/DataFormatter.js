sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";

    return {
        /**
         * @param {string} sDateString
         * @returns {string}
         */
        formatDateTime: function (sDateString) {
            if (!sDateString) return "";
            
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "HH:mm:ss || dd/MM/yyyy"
            });
            
            var oDate = new Date(sDateString);
            if (!isNaN(oDate.getTime())) {
                return oDateFormat.format(oDate);
            }
            return sDateString;
        }
    };
});