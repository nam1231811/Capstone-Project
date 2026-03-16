sap.ui.define([
    "sap/ui/model/Filter"
], function(Filter) {
    "use strict";

    return {
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = this.byId("dataTable");
            var oBinding = oTable.getBinding("rows");

            //Lưu từ khóa tìm kiếm vào displayModel để Formatter ở UI lấy ra dùng
            this.getView().getModel("displayModel").setProperty("/searchQuery", sQuery || "");

            //Execute search
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

            var iFilteredLength = oBinding.getLength(); 
            
            var iNewVisibleRows = iFilteredLength === 0 ? 1 : (iFilteredLength < 10 ? iFilteredLength : 10);
            
            //Cập nhật lại trạng thái các nút
            var bHasMore = iFilteredLength > iNewVisibleRows;
            var bHasLess = false;
            
            var oDisplayModel = this.getView().getModel("displayModel");
            oDisplayModel.setProperty("/visibleRowCount", iNewVisibleRows);
            oDisplayModel.setProperty("/hasMore", bHasMore);
            oDisplayModel.setProperty("/hasLess", bHasLess);
        }
    };
});