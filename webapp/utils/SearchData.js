sap.ui.define([
    "sap/ui/model/Filter"
], function(Filter) {
    "use strict";

    return {
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");

            if (sQuery) {
                var oFilter = new Filter({ 
                    path: "",
                    test: function (aRow) {
                        if (!aRow || !Array.isArray(aRow)) return false;
                        return aRow.some(function (oCell) { 
                            return oCell && oCell.value && oCell.value.toString().toLowerCase().includes(sQuery.toLowerCase());
                        });
                    }
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]); 
            }
        }
    };
});