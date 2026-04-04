sap.ui.define([
    "sap/ui/model/Filter",
], function (Filter) {
    "use strict";

    return {
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("newValue");
            }
            sQuery = sQuery ? sQuery.toString().toLowerCase().trim() : "";

            this.getView().getModel("displayModel").setProperty("/searchQuery", sQuery);

            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            if (!sQuery) {
                oBinding.filter([]);
            } else {
                var oFilter = new Filter({
                    path: "",
                    test: function (oRow) {
                        if (!oRow || typeof oRow !== "object") return false;
                        
                        var aCells = Object.keys(oRow).map(function(key) { return oRow[key]; });
                        
                        return aCells.some(function (oCell) {
                            return oCell && oCell.value !== undefined && oCell.value !== null && 
                                   oCell.value.toString().toLowerCase().includes(sQuery);
                        });
                    }
                });
                oBinding.filter([oFilter]);
            }

            var iFilteredLength = oBinding.getLength();
            var iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            var oOverallModel = this.getView().getModel("overall");
            if (oOverallModel) {
                oOverallModel.setProperty("/count", iFilteredLength);

                oOverallModel.setProperty("/minRecord", iNewVisibleRows);
            }

            var oDisplayModel = this.getView().getModel("displayModel");
            if (oDisplayModel) {
                oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
                oDisplayModel.setProperty("/hasMore", iFilteredLength > iNewVisibleRows);
                oDisplayModel.setProperty("/hasLess", false);
            }

            if (oTable) {
                oTable.setFirstVisibleRow(0);
            }
        }
    };
});