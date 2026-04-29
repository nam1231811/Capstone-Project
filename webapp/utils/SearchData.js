sap.ui.define([
    "sap/ui/model/Filter"
], function (Filter) {
    "use strict";

    return {
        onSearch: function (oEvent) {
            var oView = this.getView(),
                oDisplayModel = oView.getModel("displayModel"),
                oOverallModel = oView.getModel("overall"),
                oTable = this.byId("dataTable"),
                oBinding = oTable ? oTable.getBinding("rows") : null,
                sQuery = oEvent.getParameter("query") !== undefined ? oEvent.getParameter("query") : oEvent.getParameter("newValue"),
                iFilteredLength, 
                iNewVisibleRows;

            sQuery = sQuery ? sQuery.toString().toLowerCase().trim() : "";

            if (oDisplayModel) {
                oDisplayModel.setProperty("/searchQuery", sQuery);
            }

            if (!oBinding) return;

            if (!sQuery) {
                oBinding.filter([]);
            } else {
                oBinding.filter([new Filter({
                    path: "",
                    test: function (oRow) {
                        if (!oRow || typeof oRow !== "object") return false;

                        for (var sKey in oRow) {
                            var oCell = oRow[sKey];
                            if (oCell && oCell.value !== undefined && oCell.value !== null && 
                                oCell.value.toString().toLowerCase().includes(sQuery)) {
                                return true;
                            }
                        }
                        return false;
                    }
                })]);
            }

            iFilteredLength = oBinding.getLength();
            iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            if (oOverallModel) {
                oOverallModel.setProperty("/count", iFilteredLength);
                oOverallModel.setProperty("/minRecord", iNewVisibleRows);
            }

            if (oDisplayModel) {
                oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
            }

            if (oTable) {
                oTable.setFirstVisibleRow(0);
            }
        }
    };
});